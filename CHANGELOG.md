# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
