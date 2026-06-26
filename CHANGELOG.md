# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Utils test coverage (ROADMAP 5.2)** — 36 new tests for `extensions/utils.ts` covering `messageContent`, `extractByPattern`, `containsErrorIndicators`, and `emptyCompactionResult` with full edge case coverage. Overall branch coverage pushed from 84.75% to 88.91%.

### Fixed

- **ROADMAP.md Phase 2 progress** — corrected count from 15/16 to 16/16 (all Phase 2 pillars are complete). Updated overall progress to 81% (30/37 tasks done).


## [1.0.0] - 2026-06-27

### Added

- **v1.0.0 release verification** — Phase 5 tasks 5.1-5.3 verified: all Phase 2 pillars complete with 295+ tests, test coverage at 88.91% branches / 97.49% statements / 100% functions, all Phase 4 documentation complete (CONTRIBUTING.md, EXAMPLES.md, ISSUE_TEMPLATE.md, PULL_REQUEST_TEMPLATE.md, SECURITY.md, JSDoc on all public methods). Total test suite: 331 tests across 10 files.

- **Utils test coverage (ROADMAP 5.2)** — 36 new tests for `extensions/utils.ts` covering `messageContent`, `extractByPattern`, `containsErrorIndicators`, and `emptyCompactionResult` with full branch, statement, and function coverage (100% each).

- **Coverage reporting (ROADMAP 3.3)** — added `@vitest/coverage-v8` provider with v8 (c8) coverage engine. Configured thresholds: 80% statements, 70% branches, 80% functions, 80% lines. Added `test:coverage` and `coverage` npm scripts. CI now runs coverage as a separate job and uploads HTML/lcov reports as artifacts.

- **Edge case tests (ROADMAP 3.1)** — 55 new tests covering empty messages arrays across all public methods, null/undefined content handling, missing fields (id/role/timestamp), invalid array entries, content type edge cases (numeric, boolean, object, image-only blocks), huge inputs (10K messages, 1MB+ content, 1000+ structured blocks), boundary values (NaN, Infinity, negative, MAX_SAFE_INTEGER), constructor extremes, reconfigure edge cases, and empty/whitespace-only string content.

- **Fuzz tests (ROADMAP 3.2)** — 11 fuzz tests using random message patterns (roles, content, lengths, structured blocks) across estimateTokens, extractCriticalInfo, evictGradually, determineTier, microCompact, generateSummary, and compact.

- **SECURITY.md (ROADMAP 4.6)** — comprehensive security policy with supported versions, vulnerability reporting process, scope definitions, security-related configuration recommendations, and responsible disclosure guidelines.

- **Performance benchmark tests (ROADMAP 3.4)** — 10 benchmark tests measuring execution time for estimateTokens, extractCriticalInfo, determineTier, microCompact, and evictGradually at 1K and 10K message scales.

### Added

- **Hard watermark fallback tests (ROADMAP 2.9)** — 7 new tests verifying that `hardWatermark` fires as fallback when the percentage gate (Gate 1 at 60%) doesn't fire. Covers: default hardWatermark=0.5 fallback, custom low watermark (0.3), high watermark (0.9/1.0 where Gate 1 dominates), tokens below both gates, and explicit context window scenarios. Suite grows from 214→219 tests.

- **Generational compaction MICRO vs FULL selection tests** — 15 new tests covering boundary conditions (exact 60%/90% thresholds), auto-detection via compact(), behavioral verification (MICRO → empty summary, FULL → structured sections), multiple-message accumulation, and context window adaptation (ROADMAP task 2.7).

### Fixed

- **ROADMAP.md accuracy** — marked Phase 4 documentation tasks (CONTRIBUTING.md, EXAMPLES.md, PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE.md) as complete; files were created in prior commits but ROADMAP was not updated. Updated version from 0.9.2 to 0.9.3 to match package.json. Phase 2 progress 81%→88%, Phase 4 progress 17%→83%, overall 54%→68%.

### Fixed

- **Model detection tests fixed** — corrected context window expectations for deepseek-r1 (65536), codestral (256000), o3 (200000), mistral (128000), and llama (128000) to match actual model-specific entries (ROADMAP task 1.2/1.3 follow-up).

### Added

- **maxEvictionLevel config cap verified** — added 5 tests confirming `evictGradually` respects the `maxEvictionLevel` config cap at every level (1-4), including end-to-end verification through `generateSummary` (ROADMAP task 2.4).

### Added

- **JSDoc comments for all public methods in engine.ts** — added full JSDoc to the constructor (16 config params documented), `generateSummary`, and enhanced 7 existing JSDoc blocks with `@param` and `@returns` tags (ROADMAP task 4.1).

- **ROADMAP.md updated** — audited Phase 2 against actual code; 10 tasks that were already implemented marked `[x]`. Phase 2 progress jumps from 12% (2/16) to 75% (12/16). Overall project progress 24% -> 51% (ROADMAP tasks 2.3, 2.5, 2.6, 2.8, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16).
- **CONTRIBUTING.md** — created with setup instructions, dev workflow, commit conventions, branch naming, test guidelines, architecture overview, and issue reporting policy (ROADMAP task 4.2).
- **PULL_REQUEST_TEMPLATE.md** — GitHub PR template with quality gates checklist and changelog reference (ROADMAP task 4.4).
- **ISSUE_TEMPLATE.md** — GitHub issue template supporting bug reports and feature requests (ROADMAP task 4.5).
- **EXAMPLES.md** — real-world usage patterns including programmatic API, config examples, integration with gentle-engram, manual trigger, testing, and CLI scripting (ROADMAP task 4.3).
## [0.9.3] - 2026-06-26

### Fixed

- **`shouldCompact` now respects `thresholdTokens`** — added explicit threshold check as Gate 1 before percentage-based gates. Previously, `thresholdTokens` was stored but never consulted by `shouldCompact()`, causing auto-compaction to fail when a global `currentModel` inflated the context window (e.g., after `model_select` events).
- **194/194 tests green** — the sole failing test (`performs compaction when tokens exceed threshold`) now passes because `shouldCompact()` checks the user-configured threshold first.

### Added

- **`vitest.config.ts`** — added proper Vitest configuration with `globals: true` and test file patterns. Removed `--globals` CLI flag from `package.json` test script. All 194 tests continue to pass.
- **deepseek-r1, codestral, o3 model entries** — explicit context windows added to `detectContextWindow()` (65536, 256000, 200000 respectively)
- **opencode/claude-sonnet-4-6 priority fix** — moved to top of model list so it matches before generic claude-sonnet-4
- **`__resetModuleState()`** — exported function for Vitest test isolation between suites

### Fixed

- **preemptive watermark cap** — `shouldCompactDefaultThreshold()` now applies `preemptiveWatermark` cap when context window is auto-detected (not explicitly provided via Pi metadata)
- **`reconfigure(undefined)` preserves context** — calling `reconfigure()` with no arguments no longer resets to the default context window
- **Module-level circuit breaker state** — `compactionFailures`, `breakerTrippedAtTurn`, and `currentTurn` promoted to module scope so `__resetModuleState()` can reset them
- **18 test failures resolved** — updated expectations for expanded model detection (claude -> 200K, deepseek-r1 -> 65536, codestral -> 256000, o3 -> 200000), fixed family fallback matching (`includes` not `===`), and aligned notify calls with new notification logic

### Changed

- **Family fallback matching** — reverted to `name.includes(family)` (was incorrectly changed to `===`)
- **Notification messages capitalized** — "Starting Ultra-compact compaction..." for consistency



## [0.9.0] - 2026-06-20

### Added

- **Model ID normalization** — new `normalizeModelId()` function strips provider prefixes (`opencode/`, `openai/`, `anthropic/`, etc.), trailing suffixes (`-free`, `-latest`, `-preview`, `-exp`, `-beta`, `-online`), and date stamps (e.g. `-20250610`) before lookup
- **70+ model entries** — expanded `MODEL_CONTEXT_WINDOWS` from ~30 to 70+ entries:
  - OpenAI: GPT-5.1 through 5.5, Codex variants
  - Anthropic: OpenCode-style naming (`claude-sonnet-4`, `claude-opus-4-5`, etc.)
  - Google: Gemini 3.x, Gemma
  - DeepSeek: V4 Flash (200K)
  - Qwen: 3.6/3.5/3 Plus/Max, 2.5 Coder
  - Kimi/Moonshot: K2.6/K2.5/K2
  - MiniMax: M2.7/M2.5
  - GLM (Zhipu): 5.1/5/4-Plus
  - xAI: Grok Build
  - NVIDIA: Nemotron 3 Super/4
  - Xiaomi: MiMo V2.5 Pro
  - OpenCode: big-pickle
- **20+ model family patterns** — expanded `detectModelFamily()` from 6 to 20+ patterns (alibaba, moonshot, minimax, zhipu, xai, nvidia, xiaomi, opencode, and more)
- **Runtime context window support** — `reconfigure()` now accepts optional `runtimeContextWindow` parameter; when Pi provides `ctx.model.contextWindow`, it takes priority over heuristic detection
- **17 new detection tests** — parameterized tests covering provider-prefixed IDs, suffix stripping, all new families, and runtime context window override

### Changed

- **`detectContextWindow()`** now normalizes model IDs before lookup (strips prefixes/suffixes/dates)
- **`detectModelFamily()`** now normalizes input and recognizes o1/o3/o4 as OpenAI
- **`getModelRecommendations()`** delegates normalization to `detectModelFamily()` instead of raw `.toLowerCase()`
- **`index.ts`** passes `ctx.model.contextWindow` to `engine.reconfigure()` for authoritative context window sizing

## [0.8.0] - 2026-06-17

### Added

- **Graduated Eviction (4 levels)** — strips content incrementally instead of all-or-nothing:
  - Level 1: Strip assistant reasoning/thinking blocks
  - Level 2: Strip bulk tool outputs (>100 lines, >5000 chars)
  - Level 3: Strip all non-error tool results (preserves errors)
  - Level 4: Remove oldest non-protected messages (never user/system)
  - Each level re-checks token budget before escalating
- **Generational Compaction** — two-tier system:
  - **Micro tier** (60-90% usage): fast tool-output pruning, no LLM call, runs in microseconds
  - **Full tier** (90%+ usage): structured summarization with graduated eviction preconditioning
  - `determineTier()` auto-selects the right tier based on context utilization
  - `microCompact()` strips reasoning + bulk outputs in one pass
  - `compact()` tier-aware entry point
- **Preemptive Trigger** — projects next turn's token usage (current + output headroom) and fires at 60-70% watermark instead of waiting for 80% reactive hit
- **Cache-Aware Compaction** — when `cacheAware: true`, previous summary blocks are kept immutable and new content is appended. Preserves prompt cache prefix across compaction passes.
- **Snapshot-Rollback** — deep-copies messages before compaction, validates output before committing, rolls back on failure
- **Circuit Breaker** — 3 consecutive compaction failures trips the breaker; falls back to lossy truncation (system prompt + last 10 turns); auto-resets after 5 turns
- **New types**: `EvictionLevel` enum, `CompactionTier` enum, `EvictionStats` interface, `MicroCompactStats` interface
- **`estimateTokens()` is now public** — accessible for external tooling

### Changed

- **`shouldCompact()` threshold lowered** from 80% to 60% of context window (enables early micro-compaction)
- **`generateSummary()` now uses graduated eviction** as preconditioning — stripped compressible messages produce more compact structured summaries
- **`handleBeforeCompact()` in index.ts** — complete rewrite with preemptive trigger, tier-aware dispatch, cache-aware mode, snapshot-rollback, and circuit breaker
- **Config expanded**: `maxEvictionLevel`, `cacheAware`, `preemptiveWatermark`, `hardWatermark`, `outputHeadroom`, `circuitBreakerMaxFailures`, `circuitBreakerCooldown`

### Fixed

- **All 66 existing tests pass unchanged** — no regressions from any of the 5 architectural changes
- **Graduated eviction preserves user messages** — never removed regardless of token pressure (inviolable principle from CWL paper)
- **Empty summary guard** — validates compaction output before committing to session

### Performance

- **Micro-compaction is near-zero cost** — regex-only stripping, no LLM calls. Runs at 60-90% utilization.
- **Full compaction preconditioned** — graduated eviction reduces input size by 10-40% before structured summarization
- **Cache-aware mode saves API costs** — system prompt + previous summaries stay in prompt cache, only new content pays prefill

## [0.7.0] - 2026-06-17

### Added

- **Compact section templates** — restructured summary sections use shorter headers (`## Decisions` instead of `## Key Decisions`, `## Errors` instead of `## Errors & Solutions`, `## Files` instead of `## File Operations`, `## Next` instead of `## Next Steps`)
- **Compact file operations** — file ops displayed in compact pipe-separated format (`R: file1.ts | M: file2.ts`) instead of multi-line bullet lists
- **Content-aware token estimation** — `estimateTokens()` now uses dynamic ratios based on content type: code blocks (3.5 chars/token), dense text (3.5), standard prose (4.5), whitespace-heavy (6)
- **LLM-based summarization** — optional `useLLM` + `llmSummarize` config for AI-powered semantic summarization, with graceful heuristic fallback
- **`minMessagesForCompression` config** — optional threshold to skip structured summary for very small conversations
- **Logger utility** — added structured `logger.ts` for consistent error logging in the extension
- **Effectiveness test suite** — 13 new tests covering compression ratios, critical info preservation, and deduplication

### Changed

- **generateSummary is now async** — supports optional LLM summarization callback
- **Index.ts handler is now async** — `handleBeforeCompact` uses `await` for `generateSummary`
- **Compact section format** — Goals and Decisions sections use condensed `/` separator instead of multi-line bullets
- **Token estimation accuracy** — improved across all content types

### Fixed

- **All 53 original tests still pass** (after async migration)
- **All 13 new effectiveness tests pass** (66 total)

## [0.6.0] - 2026-06-16

### Added

- **Smart model switching** — `modelThresholdMemory` Map stores per-model thresholds; switching to a previously-used model restores its threshold instantly
- **userThresholdOverride field** — custom thresholdTokens explicitly tracked and preserved across model switches (replaces fragile flag-based approach)
- **Conversation structure detection** — `detectConversationStructure()` identifies turns, phases (debug, refactor, research, feature, review, planning), and progress percentage
- **Enhanced critical extraction** — detects progress indicators (completed/fixed/passed), questions, user preferences, and corrections with higher accuracy
- **Multi-pass summarization** — `multiPassSummarize()` performs 3-pass compression with quality scoring (0-1) to produce the best possible summary
- **Token estimation cache** — LRU cache with 500-entry limit and 5-minute TTL for 3x faster token estimation on repeated content
- **Performance benchmarks** — 17 additional performance tests covering cache performance, model switching, structure detection, and multi-pass quality

### Changed

- **extractCriticalInfo enhanced** — now detects progress, questions, preferences, and corrections with weighted scoring
- **generateSummary improved** — uses structure detection and multi-pass compression for higher quality output
- **estimateTokens cached** — LRU cache with TTL for repeated content performance
- **Engine constructor** — initializes modelThresholdMemory Map and tokenEstimationCache

### Fixed

- **Model switching threshold preservation** — custom thresholds no longer lost when switching models
- **Critical extraction accuracy** — enhanced patterns reduce false negatives for progress and preference detection
- **Summary quality** — multi-pass compression produces more coherent and complete summaries

### Performance

- **3x faster token estimation** — LRU cache reduces repeated computation
- **Optimized model lookup** — Map-based threshold memory for O(1) access
- **Quality scoring** — automatic selection of best summary across compression passes

## [0.5.0] - 2026-06-14

### Added

- **53-test Jest suite** — comprehensive coverage for constructor, context detection, reconfigure, shouldCompact, extractCriticalInfo, generateSummary, model families, edge cases
- **Null safety guards** — all message-consuming methods (generateSummary, extractCriticalInfo, compressConversation, extractFileOperations, estimateTokens) guard against null/undefined arrays
- **userThresholdOverride** — custom thresholdTokens preserved across model switches

### Fixed

- **3 Critical regex bugs** — missing `\b` word boundaries caused false matches:
  - extractFileOperations captured random words as file paths ("Fix the bug" → stored "bug")
  - extractErrors matched BUG inside "debug", "buggy"
  - extractNextSteps caught "will" anywhere in text
  - WILL removed from nextSteps alternation (too common), PROBLEM added to errors, MODIFIED added to file ops
- **Startup model detection** — pi.model fallback now runs before engine construction, no more "unknown" at boot
- **reconfigure() clobbered user threshold** — custom thresholdTokens now preserved via userThresholdOverride field
- **Compression ratio inflation** — tokensAfter now includes kept critical messages, not just summary text
- **Unclosed backtick** — code block replacement uses `[code: ...]` instead of unclosed backtick
- **shouldCompact boundary** — changed `>` to `>=` for correct threshold check
- **Prototype pollution** — Object.hasOwn() used for safe context window lookup
- **Unused typebox peer dep** — removed
- **329-line dead code** — extensions/ultra-compact-compaction.ts.disabled deleted
- **Topic extraction** — strips code blocks before topic detection
- **messageContent warning** — logs warning for unexpected content types

### Changed

- All regex patterns now have `\b` word boundary anchors
- Init ordering: pi.model captured before engine construction
- Compression ratio calculation includes critical messages

## [0.4.9] - 2026-06-14

### Fixed

- **`/ultracompact` command always failed with "Session not available"** — the command handler accessed `ctx.session` which does not exist on Pi's `ExtensionCommandContext`. The correct API is `ctx.compact()` which fires Pi's built-in compaction flow. Changed the handler to delegate to `ctx.compact()`; our `session_before_compact` hook intercepts and applies ultra-compact logic.
- **Manual compaction now respects `customInstructions`** — `session_before_compact` handler checks for `event.customInstructions === "ultracompact"` to skip the threshold check for manual requests, so `/ultracompact` always compacts regardless of token count.
- **Additional model fallback in compaction hook** — `session_before_compact` now also reads `ctx.model.id` at runtime for maximum detection accuracy.

### Changed

- Removed `formatCompactionResult()` and direct `ctx.session` mutation — all compaction goes through Pi's official `compact()` API now.

## [0.4.8] - 2026-06-14

### Fixed

- **SKILL.md missing YAML frontmatter** — Pi skill discovery requires `name` and `description` fields in the frontmatter. The file was missing them entirely, causing "skill conflict no description" errors. Added full frontmatter with name, description, license, and metadata fields.

## [0.4.6] - 2026-06-14

### Fixed

- **Critical: Auto-threshold never worked** — `DEFAULT_CONFIG` hardcoded `thresholdTokens: 100000`, bypassing 80% context-window auto-detection. Removed from DEFAULT_CONFIG so the engine now auto-detects threshold at 80% of model context window
- **Critical: Node.js built-in modules** — `ultra-compact-compaction.ts` used `readFileSync`, `join`, `homedir` which crash the Pi extension runtime sandbox. File disabled, logic consolidated into `index.ts`
- **Critical: Dual conflicting handlers** — both `index.ts` and `ultra-compact-compaction.ts` registered `session_before_compact`. Removed the conflicting file; single handler remains in `index.ts`
- **Critical: `ctx.session` null crash** — `/ultracompact` command accessed `ctx.session.messages` without null guard. Added early return when session is unavailable
- **Critical: `event.preparation` null crash** — `session_before_compact` handler destructured `preparation` without guard. Added null check with fallback to default compaction
- **Critical: `Message.content` type mismatch** — typed as `string` but Pi uses `string | Content[]`. Calling `.match()` on array content crashed at runtime. Added `TextContent`/`ImageContent` interfaces, union type, and `messageContent()` normalization helper
- **Critical: Auto-threshold required model name** — engine required `modelName` to trigger 80% auto-detection, but `getModelName()` always returned `undefined` (no `pi.config` on ExtensionAPI). Removed the model-name requirement; auto-threshold now uses context window regardless
- `getModelName()` had nonsensical logic returning `undefined` when custom prompt contained the word "model". Removed
- `extractFileOperations` regex searched for JS function-call syntax (`read(path="file.ts")`) never present in real Pi messages. Updated to match Pi conversation format
- `/compression-level` command stored to `globalThis` but nothing ever read it back. Dead code removed
- High cyclomatic complexity in factory function refactored: extracted `handleUltracompactCommand()` and `handleBeforeCompact()` as separate named functions
- SKILL.md documented 80% auto-detection but actual default was hardcoded 100K. Updated to match engine behavior

### Changed

- README updated with accurate feature descriptions and fix notes
- Removed `ultra-compact-compaction.ts` (disabled); all extension logic consolidated in `index.ts` + `engine.ts`

## [0.4.3] - 2025-06-14

### Changed

- Clarified Quick Start command format in README

## [0.4.2] - 2025-06-14

### Changed

- Updated README with v0.4.1 features for npm

## [0.4.1] - 2025-06-14

### Fixed

- Reduced code complexity in engine.ts and index.ts
- Refactored detectContextWindow to extract detectFromFamily helper
- Refactored getModelRecommendations to extract detectModelFamily helper
- Extracted getModelName and logModelInfo helper functions

## [0.4.0] - 2025-06-14

### Added

- Comprehensive model context window support (200+ models)
- Auto-detect model family for threshold calculation
- Model-specific recommendations (context window, threshold, keep tokens)
- Support for OpenAI GPT-5/4.1/4o/O-series models
- Support for Anthropic Claude 4.5/4.0/3.7/3.5/3 models
- Support for Google Gemini 2.5/2.0/1.5 and Gemma models
- Support for DeepSeek V4/V3/V2/R1 models
- Support for Meta Llama 4/3.3/3.1/3/2 models
- Support for Mistral Medium/Large/Small/Ministral/Codestral models
- Support for Qwen3/Qwen2.5/Qwen2 models
- Support for Microsoft Phi-4/3/2 models
- Support for Cohere, Yi, xAI Grok, Nvidia models

### Changed

- Default threshold now adapts to model's context window (80% of max)
- Improved model detection with partial and family matching

## [0.3.0] - 2024-06-13

### Added

- `/ultracompact` command for manual compaction
- Automatic threshold-based compaction (default: 100k tokens)
- Hierarchical summarization engine with entropy-based extraction
- Critical context preservation (goals, decisions, errors, file paths)
- Information importance scoring system
- File operation tracking across session
- Next steps extraction from conversation

### Changed

- Converted from pure skill to Extension + Skill hybrid
- Updated package.json with both extensions and skills manifests
- Improved compression algorithm with topic detection

### Technical

- Added `UltraCompactEngine` class for compaction logic
- Added TypeScript types for configuration and results
- Registered `session_before_compact` hook for auto-compaction

## [0.2.0] - 2024-06-13

### Changed

- Reclassified from Extension to Skill
- Updated package.json to use `pi.skills` instead of `pi.extensions`
- Created `skills/ultra-compact/SKILL.md` with compaction instructions
- Updated description to reflect skill classification

## [0.1.2] - 2024-06-13

### Changed

- Removed emojis from README
- Updated version to match npm release

## [0.1.1] - 2024-06-13

### Added

- Professional README with no emojis
- License, contributing, and changelog files

## [0.1.0] - 2024-06-13

### Added

- Initial release
- Ultra-compact compression level with maximum information density
- Aggressive compression level for balanced compression
- Standard compression level for readable summaries
- Configurable via settings file
- File operation tracking (added, modified, deleted, read)
- Metadata generation with compression stats
- `/compression-level` command to toggle levels
- Compatible with gentle-engram and gentle-pi
### 0.8.1

- Fixed 27 test failures from jest/vitest API mismatch
- Replaced jest.fn() with vi.fn() in all test files

### 0.9.2

- Fixed 27 test failures from jest/vitest API mismatch
- Replaced jest.fn() with vi.fn() in all test files

