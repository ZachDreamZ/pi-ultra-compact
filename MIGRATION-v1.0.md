# Migration Guide: v0.x → v1.0

> **Applies to:** pi-ultra-compact
> **Target version:** 1.0.0
> **Upgrade command:** `pi update npm:pi-ultra-compact`

## Quick Summary

v1.0 is the first stable release — all 37 roadmap tasks complete, 337 tests passing, 97%+ coverage. There are **no breaking API changes** from v0.x. If you already use a recent v0.9.x version, you can upgrade with zero code changes.

The main additions are **graduated eviction**, **generational compaction (micro + full)**, **preemptive triggering**, **cache-aware mode**, and a **circuit breaker** for fault tolerance.

---

## What Changed

### New Types

These types are new in v1.0. They don't break existing code — they only add surface area.

| Type | Description |
|------|-------------|
| `EvictionLevel` | Enum: STRIP_REASONING=1, STRIP_BULK_OUTPUT=2, STRIP_ARTIFACTS=3, FULL_REMOVAL=4 |
| `EvictionStats` | `{ messagesStripped, tokensSaved, levelUsed }` |
| `CompactionTier` | Enum: NONE=0, MICRO=1, FULL=2 |
| `MicroCompactStats` | `{ tokensSaved, messagesStripped, filesCollapsed }` |
| `CircuitBreakerState` | `{ failures, trippedAtTurn, turn }` |
| `CompactionEntry` | `{ id, timestamp, summary, tokensBefore, tokensAfter, compressionRatio }` |

### New Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxEvictionLevel` | `EvictionLevel` | `FULL_REMOVAL` | Cap eviction aggressiveness |
| `cacheAware` | `boolean` | `false` | Immutable prefix, append-only summaries |
| `preemptiveWatermark` | `number` | `0.70` | Soft trigger — fires at 70% context usage |
| `hardWatermark` | `number` | `0.5` | Hard cap — fires even if percentage gate is not hit |
| `outputHeadroom` | `number` | `4096` | Tokens reserved for LLM response |
| `circuitBreakerMaxFailures` | `number` | `3` | Consecutive failures before fallback |
| `circuitBreakerCooldown` | `number` | `5` | Turns before circuit resets |

### New Engine Methods

All additions — no existing methods removed or renamed.

| Method | Signature | Description |
|--------|-----------|-------------|
| `reconfigure` | `(modelName?, contextWindow?)` | Adapts thresholds to current model |
| `getContextWindow` | `() => number` | Returns current context window |
| `getModelRecommendations` | `() => { modelName, recommendations }` | Model info |
| `shouldCompactDefaultThreshold` | `() => number` | Auto-calculated threshold |
| `determineTier` | `(messages) => CompactionTier` | Selects MICRO vs FULL tier |
| `microCompact` | `(messages) => MicroCompactStats` | Fast no-LLM tool-output pruning |
| `compact` | `(messages, previousSummary?) => CompactionResult` | Async full pipeline |
| `shouldCompact` | `(currentTokens) => boolean` | Preemptive check against watermarks |
| `evictGradually` | `(messages, tokenBudget, maxLevel?) => EvictionStats` | 4-level graduated eviction |
| `estimateTokens` | `(messages) => number` | Content-aware token estimation |
| `getCompressionHistory` | `() => Array<CompactionEntry>` | Compaction history |
| `clearCompressionHistory` | `() => void` | Clears history |

### Behavioral Changes

1. **`generateSummary` became async** (since v0.7). If you call it directly, `await` it.
2. **Auto-compaction uses graduated eviction first** — fewer LLM calls, faster compactions.
3. **Circuit breaker enabled by default** — after 3 failures, falls back to lossy truncation.
4. **Model detection is dynamic** — reads Pi's `ctx.model.contextWindow` at runtime.
5. **Preemptive trigger projects next turn** — zero latency impact.

---

## Upgrade Steps

### 1. Update

```bash
pi update npm:pi-ultra-compact
```

### 2. Optional: Enable Cache-Aware Mode

Keeps prompt prefix stable (saves API costs):

```json
{ "pi-ultra-compact": { "cacheAware": true } }
```

### 3. Optional: Tune Watermarks

```json
{ "pi-ultra-compact": { "preemptiveWatermark": 0.60, "hardWatermark": 0.85, "outputHeadroom": 8192 } }
```

### 4. Optional: Adjust Circuit Breaker

```json
{ "pi-ultra-compact": { "circuitBreakerMaxFailures": 5, "circuitBreakerCooldown": 10 } }
```

---

## Programmatic API

### v0.x

```typescript
import { UltraCompactEngine } from "pi-ultra-compact";
const engine = new UltraCompactEngine({ thresholdTokens: 80000 });
const result = await engine.generateSummary(messages);
```

### v1.0 (backward-compatible)

```typescript
import { UltraCompactEngine, EvictionLevel, CompactionTier } from "pi-ultra-compact";
const engine = new UltraCompactEngine({
  thresholdTokens: 80000,
  maxEvictionLevel: EvictionLevel.STRIP_ARTIFACTS,
  cacheAware: true,
});
// All v0.x methods still work
const result = await engine.generateSummary(messages);
// New: graduated eviction
engine.evictGradually(messages, tokenBudget);
// New: tier-aware compaction
engine.determineTier(messages);
// New: full pipeline
const compactResult = await engine.compact(messages, previousSummary);
```

---

## Deprecations

Nothing deprecated in v1.0. All v0.x APIs continue to work. `generateSummary` has been async since v0.7.

## Rollback

```bash
pi install npm:pi-ultra-compact@0.10.0
```

## Troubleshooting

- **Compaction not triggering**: Check `autoCompact` is `true`, verify Pi exposes `contextWindow`, check `preemptiveWatermark` (default 70%).
- **Circuit breaker keeps tripping**: Increase `circuitBreakerMaxFailures`, manually test with `/ultracompact`.
- **Import errors**: Use `import { UltraCompactEngine } from "pi-ultra-compact"`.

## References

- [CHANGELOG.md](CHANGELOG.md) — full version history
- [README.md](README.md) — full documentation
- [GitHub Issues](https://github.com/ZachDreamZ/pi-ultra-compact/issues)
