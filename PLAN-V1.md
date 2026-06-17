# pi-ultra-compact v1.0 Implementation Plan

## Overview

Transform pi-ultra-compact from a "react when full" summarizer into a **proactive, cache-conscious, always-safe context manager**. Five pillars, ordered by dependency:

1. **Graduated Eviction** — Foundation for all other improvements
2. **Generational Compaction** — Micro (frequent) + Full (rare)
3. **Preemptive Trigger** — Compress before you're in danger
4. **Cache-Aware Compaction** — Keep the prompt cache warm
5. **Snapshot-Rollback + Circuit Breaker** — Never die from a bad compaction

---

## 1. Graduated Eviction (Foundation)

### Problem

Today `generateSummary()` treats all messages uniformly with `classifyMessages()` producing a binary protected/compressible split. It doesn't try to strip content incrementally — it's all-or-nothing.

### Solution

Add `EvictionLevel` enum and a `graduatedEvict()` method that strips content in 4 levels, re-checking the token budget after each level.

### Architecture

```
evictGradually(messages, budget)
  ├─ Level 1: Strip reasoning traces (assistant thinking blocks)
  ├─ Level 2: Strip bulk tool outputs (directory listings, grep results > 100 lines)
  ├─ Level 3: Strip intermediate artifacts (all tool results except errors)
  └─ Level 4: Full message removal (oldest non-protected messages first)
```

### Code Changes

#### New types in `extensions/types/index.ts`

```typescript
export enum EvictionLevel {
  STRIP_REASONING = 1,    // Remove thinking/reasoning blocks
  STRIP_BULK_OUTPUT = 2,  // Remove large tool outputs (>100 lines)
  STRIP_ARTIFACTS = 3,    // Remove all tool outputs (keep errors)
  FULL_REMOVAL = 4,       // Remove entire messages
}
```

#### New method in `extensions/engine.ts`

```typescript
public evictGradually(
  messages: Message[],
  tokenBudget: number,
  maxLevel: EvictionLevel = EvictionLevel.FULL_REMOVAL
): { evicted: Message[]; kept: Message[]; level: EvictionLevel }
```

Logic per level:

- **Level 1**: Scan for assistant messages with `content` arrays containing `type: "thinking"` blocks. Remove those blocks. If budget satisfied, stop.
- **Level 2**: Scan for tool result blocks exceeding `MAX_TOOL_OUTPUT_CHARS` (e.g., 2000 chars). Replace with `"[output truncated: N chars]"`. If budget satisfied, stop.
- **Level 3**: Strip all non-error tool results. Keep error messages intact. If budget satisfied, stop.
- **Level 4**: Remove oldest non-protected, non-user messages until budget is met. Never remove user messages (inviolable principle from CWL paper).

#### Integration in `generateSummary()`

```typescript
// Before: throw everything at summarization
// After: try graduated eviction first, only summarize what remains
const { kept, level } = this.evictGradually(messages, budget);
if (level < EvictionLevel.FULL_REMOVAL) {
  // Budget satisfied by stripping alone → no LLM summarization needed
  return { summary: compressConversation(kept), ... };
}
// Only reach here if FULL_REMOVAL was needed → do structured summary
return this.generateStructuredSummary(kept, ...);
```

---

## 2. Generational Compaction (Micro + Full)

### Problem

There's one compaction strategy. For sessions at 60-70% usage, we pay the cost of full structured summarization when just pruning redundant tool results would suffice.

### Solution

Two-tier compaction:

| Tier | Trigger | Savings | Cost | Frequency |
|------|---------|---------|------|-----------|
| **Micro** | 60-70% usage | 10-30% | Near-zero (no LLM) | Every few turns |
| **Full** | 90-95% usage | 80-95% | Structured summary | Every 50-100 turns |

### Architecture

```typescript
enum CompactionTier {
  NONE = 0,
  MICRO = 1,   // Prune tool outputs, deduplicate reads
  FULL = 2,    // Structured summarization via generateStructuredSummary
}

public compact(messages: Message[], tier?: CompactionTier): CompactionResult {
  // Determine tier if not specified
  const actualTier = tier ?? this.determineTier(messages);
  
  switch (actualTier) {
    case CompactionTier.MICRO:
      return this.microCompact(messages);
    case CompactionTier.FULL:
      return this.generateSummary(messages);
  }
}
```

#### Micro-compact logic (`microCompact()`)

```typescript
private microCompact(messages: Message[]): CompactionResult {
  // 1. Collapse repeated file reads (keep latest, replace earlier with pointer)
  // 2. Strip redundant directory listings (same dir listed twice)
  // 3. Prune large stdout from `bash` commands where only exit code matters
  // 4. Remove empty tool results
  // 5. Summarize long file reads to first/last 50 lines
  return this.evictGradually(messages, budget, EvictionLevel.STRIP_BULK_OUTPUT);
}
```

#### Determining tier

```typescript
private determineTier(messages: Message[]): CompactionTier {
  const tokens = this.estimateTokens(messages);
  const ratio = tokens / this.contextWindow;
  
  if (ratio >= 0.90) return CompactionTier.FULL;
  if (ratio >= 0.60) return CompactionTier.MICRO;
  return CompactionTier.NONE;
}
```

#### Changes to `shouldCompact()`

```typescript
public shouldCompact(currentTokens: number): boolean {
  return currentTokens >= this.config.thresholdTokens * 0.6; // Lower threshold
}
```

The threshold drops to 60% because micro-compact is cheap enough to run early.

---

## 3. Preemptive Trigger

### Problem

Today compaction fires *after* the context is already at 80%. The turn that crosses the watermark pays compaction latency (1-5 seconds), and there's zero headroom for the model to emit a large response.

### Solution

Project next turn's token usage and fire compaction *before* the turn, at ~70% usage.

### Architecture

```typescript
public interface PreemptiveConfig {
  softWatermark: number;  // 0.70 — preemptive trigger
  hardWatermark: number;  // 0.95 — reactive fallback
  outputHeadroom: number;  // 4096 — reserved for model reply
  toolResultEstimate: number; // 8192 — expected tool result size
}

public projectNextTurn(messages: Message[], pendingToolResult?: number): number {
  return this.estimateTokens(messages)
    + (pendingToolResult ?? this.config.toolResultEstimate)
    + this.config.outputHeadroom;
}
```

#### Changes in `extensions/index.ts` — `handleBeforeCompact()`

```typescript
// Current: fires when tokens >= threshold
// New: fires when PROJECTED tokens >= threshold

const currentTokens = preparation.tokensBefore;
const projectedTokens = engine.projectNextTurn(
  preparation.messagesToSummarize,
  preparation.tokensBefore
);
const actualTokens = isManual ? currentTokens : projectedTokens;

if (!isManual && !engine.shouldCompact(actualTokens)) {
  return undefined; // no compaction needed
}

// If we're below hard watermark, try MICRO tier first
const tier = engine.determineTier(preparation.messagesToSummarize);
if (tier === CompactionTier.MICRO) {
  // Fast path: just prune tool outputs, no LLM call
  const result = engine.microCompact(preparation.messagesToSummarize);
  // ... return compaction result with micro-compacted messages
}
```

---

## 4. Cache-Aware Compaction

### Problem

Every compaction pass rewrites the entire buffer. This invalidates the LLM API's prompt cache from the rewrite boundary onward, causing **full prefill cost** (10× cache-read price) on every subsequent turn. This is the #1 cost driver in production.

### Solution

**Never rewrite the system prompt. Never rewrite the summary block between compactions.** Keep the summary block at a fixed position (right after system prompt) and treat it as immutable between compactions.

### Architecture

#### Summary Block Strategy

```
Before compaction:
  [system prompt] [recent turns 1-50]

After compaction (cache-aware):
  [system prompt] [SUMMARY BLOCK] [recent turns 41-50]

On next compaction (immutable summary):
  [system prompt] [SUMMARY BLOCK] [NEW APPENDED SUMMARY] [recent turns 91-100]
  ^^^ unchanged prefix → cache hit
```

#### Key invariants

1. System prompt: **never touched** by compaction
2. Summary block: **append-only**. Once written, it is NOT rewritten. New summaries are appended as NEW blocks.
3. Only the **tail** (recent messages) oscillates naturally.

#### New config option

```typescript
interface CacheAwareConfig {
  enabled: boolean;
  summaryBlockPosition: 'after-system' | 'before-tail';
  minSummaryImmutableTurns: number; // 20 — don't re-summarize before this many turns
}
```

#### Changes to `generateStructuredSummary()`

When cache-aware mode is enabled, the summary block format changes:

```typescript
// Before (rewrites summary position):
result.summary = "## Goals\n...";

// After (cache-aware summary block):
result.summary = previousSummary
  ? previousSummary + "\n\n## Compaction #2\n## Goals\n..."  // Append only
  : "## Compaction #1\n## Goals\n...";                       // First summary
```

#### Changes to `handleBeforeCompact()` in index.ts

```typescript
// Detect if we already have an immutable summary block in the preparation
const hasImmutableSummary = preparation.previousSummary 
  && this.compactionCount < engine.config.minSummaryImmutableTurns;

if (hasImmutableSummary) {
  // Don't re-summarize, just micro-compact the tail
  // This preserves the prefix cache
  return { cancel: true };  // Let Pi handle the tail normally
}
```

---

## 5. Snapshot-Rollback + Circuit Breaker

### Problem

If `generateSummary()` throws (model error, bad output, time out), the current catch block silently falls back to Pi's default compaction. But the session is left in an undefined state — the compaction hook returned `undefined` and Pi may or may not have done its own pass.

### Solution

Three-layer safety:

#### Layer 1: Snapshot-and-Rollback

```typescript
// In handleBeforeCompact():
const snapshot = structuredClone(preparation.messagesToSummarize);
try {
  const result = await engine.generateSummary(snapshot);
  // Validate output before committing
  if (!result.summary || result.summary.trim().length === 0) {
    throw new Error("Empty summary returned");
  }
  return { compaction: { summary: result.summary, ... } };
} catch (error) {
  // Rollback: snapshot is untouched, return undefined to fall back to default
  console.error("[ultra-compact] Compaction failed, rolling back:", error);
  return undefined;
}
```

#### Layer 2: Circuit Breaker

```typescript
// In index.ts (module-level state):
let compactionFailures = 0;
let breakerTrippedAtTurn: number | null = null;
const MAX_FAILURES = 3;
const COOLDOWN_TURNS = 5;

// In handleBeforeCompact():
if (breakerTrippedAtTurn !== null) {
  if (currentTurn - breakerTrippedAtTurn < COOLDOWN_TURNS) {
    return undefined; // Breaker is open, fall back to default
  }
  // Cool-down expired, reset
  compactionFailures = 0;
  breakerTrippedAtTurn = null;
}

// On failure:
compactionFailures++;
if (compactionFailures >= MAX_FAILURES) {
  breakerTrippedAtTurn = currentTurn;
  console.error("[ultra-compact] Circuit breaker tripped, using lossy truncation");
  return lossyTruncate(messages);
}
```

#### Layer 3: Lossy Truncation (last resort)

```typescript
function lossyTruncate(
  messages: Message[],
  tailKeep: number = 10
): { summary: string } {
  const system = messages.filter(m => m.role === "system");
  const nonSystem = messages.filter(m => m.role !== "system");
  const tail = nonSystem.slice(-tailKeep);
  const summary = [
    ...system.map(m => `[System]: ${messageContent(m)}`),
    "[earlier history truncated — circuit breaker engaged]",
    ...tail.map(m => `[${m.role}]: ${messageContent(m)}`)
  ].join("\n");
  return { compaction: { summary, ... } };
}
```

#### Integration in `handleBeforeCompact()`

```typescript
async function handleBeforeCompact(engine: UltraCompactEngine) {
  return async (event: any, ctx: any) => {
    // ... model detection, token checking ...
    
    // Layer 2: Circuit breaker check
    if (breakerActive()) {
      if (!coolDownElapsed()) return undefined; // Open breaker
      resetBreaker();
    }
    
    // Layer 1: Snapshot
    const snapshot = structuredClone(preparation.messagesToSummarize);
    
    try {
      const result = await engine.generateSummary(snapshot);
      validateSummary(result);
      resetBreaker(); // Success resets counter
      return { compaction: { ... } };
    } catch (err) {
      recordFailure();
      
      if (breakerTripped()) {
        // Layer 3: Lossy truncation
        ctx.ui.notify("Compaction failing repeatedly, using emergency truncation", "warning");
        return lossyTruncate(snapshot);
      }
      
      return undefined; // Fall back to Pi default
    }
  };
}
```

---

## Dependency Map

```
Graduated Eviction ──────┐
                         ├──> Generational Compaction ──> Preemptive Trigger
                         │         (micro uses levels 1-2)
                         │
Cache-Aware ─────────────┤
(system prompt protection)│
                         │
Snapshot-Rollback ───────┤
    + Circuit Breaker ───┘   (wraps ALL compaction paths)
```

**Implementation order:**

1. Graduated Eviction (new core method, no API changes)
2. Generational Compaction (new public method, uses graduated eviction)
3. Preemptive Trigger (modify `shouldCompact()` + `handleBeforeCompact()`)
4. Cache-Aware (modify summary format + `handleBeforeCompact()`)
5. Snapshot-Rollback + Circuit Breaker (wrap everything in index.ts)

---

## Interface Changes Summary

### `extensions/types/index.ts` — new exports

| Symbol | Kind | Description |
|--------|------|-------------|
| `EvictionLevel` | enum | STRIP_REASONING, STRIP_BULK_OUTPUT, STRIP_ARTIFACTS, FULL_REMOVAL |
| `CompactionTier` | enum | NONE, MICRO, FULL |
| `MicroCompactStats` | interface | { messagesStripped, tokensSaved, level } |
| `CircuitBreakerState` | interface | { failures, trippedAt, cooldown } |

### `UltraCompactConfig` — new fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cacheAware` | boolean | false | Enable cache-aware compaction |
| `preemptiveWatermark` | number | 0.70 | Preemptive trigger level |
| `hardWatermark` | number | 0.95 | Reactive fallback level |
| `outputHeadroom` | number | 4096 | Reserved for LLM output |
| `maxEvictionLevel` | EvictionLevel | FULL_REMOVAL | Max eviction aggressiveness |
| `circuitBreakerMaxFailures` | number | 3 | Failures before breaker trips |
| `circuitBreakerCooldown` | number | 5 | Turns before breaker resets |

### `UltraCompactEngine` — new methods

| Method | Visibility | Description |
|--------|-----------|-------------|
| `evictGradually()` | public | Strip content in incremental levels |
| `microCompact()` | public | Fast tool-output pruning (no LLM) |
| `compact()` | public | Tier-aware compaction (micro vs full) |
| `projectNextTurn()` | public | Estimate next turn's token usage |
| `determineTier()` | public | Auto-detect which compaction tier to use |

---

## Existing Methods Modified

| Method | Changes |
|--------|---------|
| `generateSummary()` | Tries graduated eviction first. Only summarizes if FULL_REMOVAL level hit. |
| `generateStructuredSummary()` | Cache-aware mode: appends summary blocks instead of rewriting. |
| `shouldCompact()` | Lowered to 60% of context window for micro-compact. |
| `preprocessMessages()` | Now also handles graduated eviction stripping. |
| `extractCriticalInfo()` | No change needed. |
| `estimateTokens()` | No change needed. |

---

## Test Suite Additions

| Test Suite | Tests | What it validates |
|-----------|-------|-------------------|
| `graduated-eviction.test.ts` | 8 | Each eviction level, budget satisfaction, user message protection |
| `generational.test.ts` | 6 | Tier detection, micro-compact speed, tier fallback |
| `preemptive.test.ts` | 5 | Projected token calculation, soft watermark, hard watermark |
| `cache-aware.test.ts` | 5 | Summary block immutability, append-only behavior |
| `circuit-breaker.test.ts` | 6 | Failure counting, trip/reset, lossy truncation output |
| Effectiveness update | +5 | Compression ratio improvement with graduated eviction |

Total new tests: ~35. Total test suite: ~100 tests.

---

## Metrics We'll Track

| Metric | Current | Target | How |
|--------|---------|--------|-----|
| Micro-compaction passes | 0 | Runs at every 60-70% usage | `CompactionTier.MICRO` |
| Full compaction passes | Every time | Only at 90-95% | `CompactionTier.FULL` |
| Avg compression ratio (200 msg) | 0.784 | 0.65-0.70 (with graduated eviction, less aggressive) | Better info retention |
| Session crash from bad compact | Possible | Impossible | Snapshot-rollback + breaker |
| Prompt cache invalidation | Every compaction | Only when FULL tier runs | Cache-aware block |
