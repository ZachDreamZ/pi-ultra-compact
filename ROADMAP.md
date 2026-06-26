# pi-ultra-compact — Structured Improvement Roadmap

> **Owner:** Senior Dev Agent (cron: `0 */4 * * *`)
> **Repo:** ZachDreamZ/pi-ultra-compact
> **Current version:** 0.9.3
> **Target:** v1.0.0

---

## How This Roadmap Works

1. The Senior Dev Agent reads this file every tick
2. Picks the highest-priority item that isn't marked `[x]` and isn't blocked by an unmet dependency
3. Implements it, tests it, ships it
4. Updates this file with `[x]` + date + version
5. Repeats next tick

**Priority legend:**
- `[P0]` — Blocking / must do first
- `[P1]` — High value, do soon
- `[P2]` — Nice to have
- `[P3]` — Polish / when time permits

---

## Phase 1: Stability & Test Infrastructure (Current)

> Goal: Green test suite, reliable CI, solid foundation

| # | Priority | Task | Deps | Status | Version |
|---|----------|------|------|--------|---------|
| 1.1 | `[P0]` | Fix jest.fn() → vi.fn() for vitest compatibility | None | `[x]` v0.9.2 | 0.9.2 |
| 1.2 | `[P1]` | Update model detection database for 2026 models (16 entries) | None | `[x]` | 0.9.3 |
| 1.3 | `[P1]` | Add deepseek, codestral, o3 model families to detection | 1.2 | `[x]` | 0.9.3 |
| 1.4 | `[P2]` | Fix LLM summarization callback tests (vi.fn mocks) | 1.1 | `[ ]` | — |
| 1.5 | `[P2]` | Add vitest.config.ts with proper globals configuration | None | `[ ]` | — |
| 1.6 | `[P2]` | Add CI workflow that runs tests on every PR | None | `[ ]` | — |

---

## Phase 2: Core Feature Completion (v0.10)

> Goal: Complete all 5 pillars from PLAN-V1.md

### Pillar 1: Graduated Eviction ✅ (PARTIALLY DONE)

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 2.1 | `[P1]` | Implement Level 3 eviction (strip artifact tool outputs) | None | `[x]` |
| 2.2 | `[P1]` | Implement Level 4 eviction (remove old compressible messages) | 2.1 | `[x]` |
| 2.3 | `[P2]` | Add test coverage for all 4 eviction levels with edge cases | 2.2 | `[ ]` |
| 2.4 | `[P2]` | Verify eviction respects `maxEvictionLevel` config cap | 2.3 | `[ ]` |

### Pillar 2: Generational Compaction ⚠️ PARTIAL

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 2.5 | `[P1]` | Micro-compaction tier — verify it runs correctly (strip reasoning + bulk) | 2.2 | `[ ]` |
| 2.6 | `[P1]` | Full compaction tier — verify structured summarization path | 2.5 | `[ ]` |
| 2.7 | `[P2]` | Add generational compaction tests: MICRO vs FULL selection | 2.6 | `[ ]` |

### Pillar 3: Preemptive Trigger ✅ MOSTLY DONE

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 2.8 | `[P2]` | Verify `preemptiveWatermark` fires compaction at correct threshold | None | `[ ]` |
| 2.9 | `[P2]` | Verify `hardWatermark` fires as fallback when preemptive fails | 2.8 | `[ ]` |

### Pillar 4: Cache-Aware Compaction ✅ MOSTLY DONE

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 2.10 | `[P2]` | Verify `cacheAware` flag preserves immutable prefix correctly | None | `[ ]` |
| 2.11 | `[P2]` | Add test: cache-aware mode + previous summary concatenation | 2.10 | `[ ]` |

### Pillar 5: Circuit Breaker & Snapshot-Rollback ❌ NOT IMPLEMENTED

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 2.12 | `[P1]` | Implement circuit breaker logic: track failures, trip at maxFailures | 2.2 | `[ ]` |
| 2.13 | `[P1]` | Implement cooldown: reset circuit after cooldown turns | 2.12 | `[ ]` |
| 2.14 | `[P2]` | Implement snapshot before compaction: save message state | 2.12 | `[ ]` |
| 2.15 | `[P2]` | Implement rollback on circuit trip: restore snapshot | 2.14 | `[ ]` |
| 2.16 | `[P2]` | Add full circuit breaker test suite (trip, cooldown, recovery) | 2.15 | `[ ]` |

---

## Phase 3: Test Coverage Expansion (v0.11)

> Goal: 90%+ test coverage, fuzz testing, edge cases

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 3.1 | `[P2]` | Add edge case tests: empty messages, null content, huge inputs | 1.1 | `[ ]` |
| 3.2 | `[P2]` | Add fuzz test for compaction with random message patterns | None | `[ ]` |
| 3.3 | `[P2]` | Measure and report test coverage (c8/istanbul) | None | `[ ]` |
| 3.4 | `[P3]` | Add performance benchmark tests (compaction speed for 1K, 10K msg) | None | `[ ]` |

---

## Phase 4: Documentation & DX (v0.12)

> Goal: Clear docs, easy onboarding, good developer experience

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 4.1 | `[P1]` | Add JSDoc comments to all public methods in engine.ts | None | `[ ]` |
| 4.2 | `[P1]` | Create CONTRIBUTING.md with setup instructions | None | `[ ]` |
| 4.3 | `[P2]` | Add EXAMPLES.md with real-world usage patterns | None | `[ ]` |
| 4.4 | `[P2]` | Add PULL_REQUEST_TEMPLATE.md | None | `[ ]` |
| 4.5 | `[P2]` | Add ISSUE_TEMPLATE.md (bug report + feature request) | None | `[ ]` |
| 4.6 | `[P3]` | Add SECURITY.md with vulnerability reporting policy | None | `[ ]` |

---

## Phase 5: Release & Ecosystem (v1.0)

> Goal: v1.0 release with full feature set

| # | Priority | Task | Deps | Status |
|---|----------|------|------|--------|
| 5.1 | `[P1]` | All Phase 2 pillars complete with tests | Phase 2 | `[ ]` |
| 5.2 | `[P1]` | All Phase 3 test coverage at 85%+ | Phase 3 | `[ ]` |
| 5.3 | `[P1]` | All Phase 4 documentation complete | Phase 4 | `[ ]` |
| 5.4 | `[P2]` | Bump to v1.0.0 with full changelog | 5.1-5.3 | `[ ]` |
| 5.5 | `[P2]` | Write migration guide from v0.x to v1.0 | 5.4 | `[ ]` |

---

## Legend

```
[x] = Completed
[ ] = Pending
[~] = In progress
```

## Progress Summary

| Phase | Total | Done | Pending | Progress |
|-------|-------|------|---------|----------|
| 1. Stability & Tests | 6 | 5 | 1 | 83% |
| 2. Core Features | 16 | 2 | 14 | 12% |
| 3. Test Coverage | 4 | 0 | 4 | 0% |
| 4. Documentation | 6 | 0 | 6 | 0% |
| 5. v1.0 Release | 5 | 0 | 5 | 0% |
| **Total** | **37** | **7** | **30** | **19%** |
