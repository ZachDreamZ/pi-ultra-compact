# Migration Guide: v0.x → v1.0

> **pi-ultra-compact v1.0.0** — June 27, 2026

This guide covers all breaking changes and behavioral differences when upgrading from any 0.x release to v1.0.0.

---

## Table of Contents

1. [Quick Summary](#quick-summary)
2. [New Dependencies](#new-dependencies)
3. [Removed APIs](#removed-apis)
4. [Changed APIs](#changed-apis)
5. [Configuration Changes](#configuration-changes)
6. [Behavioral Changes](#behavioral-changes)
7. [Testing Changes](#testing-changes)
8. [Upgrade Steps](#upgrade-steps)

---

## Quick Summary

If you were using the default configuration and only calling `generateSummary()` or relying on auto-compaction, **no code changes are needed**. The v1.0 API is a superset of the v0.x API.

If you use any of the following, read the relevant section:
- Custom compaction implementations that bypass `generateSummary()`
- Direct calls to `shouldCompact()` or `determineTier()`
- Manual threshold configuration
- Custom test suites based on our test patterns

---

## New Dependencies

### Added

- `@vitest/coverage-v8` — version ^4.1.9 (dev dependency)
  - Required if you run `npm run coverage` or `npm test:coverage`
  - Not required for normal usage

### No changes to peer dependencies

The three peer dependencies remain unchanged:
- `@earendil-works/pi-ai` (any version)
- `@earendil-works/pi-coding-agent` (any version)
- `@earendil-works/pi-tui` (any version)

---

## Removed APIs

**None.** All public APIs from v0.x remain available in v1.0.0.

The following private/legacy files were removed in earlier 0.x releases and are still absent:
- `extensions/ultra-compact-compaction.ts` (removed in v0.4.6)

---

## Changed APIs

### `generateSummary()` — now async (v0.7+)

If you upgraded from v0.6, `generateSummary()` became async in v0.7.0. If you're still on v0.6, update:

```typescript
// v0.6 (sync) — will NOT work in v1.0
const result = engine.generateSummary(messages, config);

// v1.0 (async)
const result = await engine.generateSummary(messages, config);
```

### `compact()` — tier-aware (v0.8+)

The `compact()` method was added in v0.8.0 as a tier-aware entry point. If you were calling `microCompact()` or internal methods directly, switch to `compact()`:

```typescript
// v0.7 style — manual tier selection
const result = await engine.microCompact(messages, config);

// v1.0 — automatic tier selection
const result = await engine.compact(messages, config, contextWindow);
```

### `estimateTokens()` — now public (v0.8+)

Previously private, now public for external tooling. No signature change.

---

## Configuration Changes

### New config fields (all optional, v0.8+)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxEvictionLevel` | `EvictionLevel` | `4` | Cap on eviction aggressiveness |
| `cacheAware` | `boolean` | `false` | Preserve previous summaries as immutable prefix |
| `preemptiveWatermark` | `number` | `0.6` | Pre-trigger compaction at this utilization |
| `hardWatermark` | `number` | `0.5` | Fallback trigger if preemptive doesn't fire |
| `outputHeadroom` | `number` | `0.15` | Reserved token space for model output |
| `circuitBreakerMaxFailures` | `number` | `3` | Consecutive failures before breaker trips |
| `circuitBreakerCooldown` | `number` | `5` | Turns to wait before resetting breaker |

### `thresholdTokens` auto-detection

In v0.4.6+, `thresholdTokens` is auto-detected at 80% of the model's context window if not explicitly set. This behavior is unchanged in v1.0.

---

## Behavioral Changes

### 1. Early micro-compaction (v0.8+)

`shouldCompact()` now triggers at 60% utilization instead of 80%. This enables micro-compaction (tool-output pruning) well before full summarization is needed. If you relied on compaction only at 80%, you may see more frequent but much cheaper compaction passes.

### 2. Graduated eviction (v0.8+)

Compaction now uses 4 eviction levels instead of all-or-nothing:
- **Level 1:** Strip reasoning/thinking blocks
- **Level 2:** Strip bulk tool outputs (>100 lines, >5000 chars)
- **Level 3:** Strip artifact tool outputs (preserves errors)
- **Level 4:** Remove oldest non-protected messages (never user/system)

Each level re-checks the token budget before escalating.

### 3. Circuit breaker protection (v0.8+)

After 3 consecutive compaction failures, the breaker trips and falls back to lossy truncation (system prompt + last 10 turns). Auto-resets after 5 turns.

### 4. Snapshot-rollback (v0.8+)

Messages are deep-copied before compaction. If the result is invalid, the original state is restored.

---

## Testing Changes

### Test runner: vitest (v0.9+)

v0.9.0 migrated from Jest to Vitest. If you have custom tests using Jest:

```typescript
// Jest (0.8.x) — WILL NOT work
jest.fn();

// Vitest (1.0.0) — required
import { vi } from "vitest";
vi.fn();
```

### Test suite growth

| Version | Tests | Files |
|---------|-------|-------|
| 0.5.0 | 53 | 1 |
| 0.6.0 | 70 | 2 |
| 0.7.0 | 66 | 3 |
| 0.8.0 | 66 | 3 |
| 0.9.0 | 194 | 4 |
| 0.9.5 | 285 | 8 |
| 1.0.0 | 331 | 10 |

### Coverage thresholds (v1.0)

If you run `npm run coverage`, the current coverage is:
- Statements: 97.49%
- Branches: 88.91%
- Functions: 100%
- Lines: 98.06%

---

## Upgrade Steps

### Step 1: Update package.json

```bash
npm install pi-ultra-compact@^1.0.0
```

### Step 2: Update imports (if needed)

All imports are unchanged. Verify your import path:

```typescript
// Still correct in v1.0
import { UltraCompactEngine } from "pi-ultra-compact";
import type { CompactionConfig, CompactionResult } from "pi-ultra-compact";
```

### Step 3: Handle async generateSummary

If you see a compilation error about `generateSummary` returning a Promise, add `await`:

```typescript
// Before (v0.6)
const result = engine.generateSummary(messages, config);

// After (v1.0)
const result = await engine.generateSummary(messages, config);
```

### Step 4: Update test imports (if you wrote Jest tests)

```typescript
// Before (Jest)
const fn = jest.fn();
expect(fn).toHaveBeenCalled();

// After (Vitest)
import { vi, describe, it, expect } from "vitest";
const fn = vi.fn();
expect(fn).toHaveBeenCalled();
```

### Step 5: Install dev dependencies (optional)

```bash
# Only needed if running tests
npm install --save-dev @vitest/coverage-v8
```

---

## Rollback

If v1.0.0 introduces issues, you can pin to the last 0.x release:

```bash
npm install pi-ultra-compact@0.9.6
```

No rollback guide needed — v0.9.6 is functionally identical to v1.0.0 in API surface, just without the MIGRATION.md and with lower test coverage.

---

## Need Help?

- [GitHub Issues](https://github.com/ZachDreamZ/pi-ultra-compact/issues)
- [README](https://github.com/ZachDreamZ/pi-ultra-compact#readme)
- [EXAMPLES.md](./EXAMPLES.md) for usage patterns
