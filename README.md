# pi-ultra-compact

Advanced compaction extension and skill for [Pi](https://pi.dev/) with automatic threshold-based compaction that follows Pi's active model metadata.

[![Pi Package](https://img.shields.io/badge/Pi-Package-blue)](https://pi.dev/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/pi-ultra-compact.svg)](https://www.npmjs.com/package/pi-ultra-compact)

## Features

- **`/ultracompact` command** for manual compaction
- **Auto-adapts threshold** to Pi's active model context window
- **Works with any Pi model** that exposes context window metadata
- **Graduated Eviction (4 levels)** — strips reasoning, bulk outputs, artifacts, then messages
- **Generational Compaction** — micro (fast, no LLM) at 60-90%, full at 90%+
- **Preemptive Trigger** — fires before next turn, never pays latency during user turns
- **Cache-Aware Compaction** — immutable summary blocks keep prompt cache warm
- **Circuit Breaker** — 3 strikes → lossy truncation fallback, session never dies
- **Hierarchical summarization** with entropy-based information extraction
- **Critical context preservation** - goals, decisions, errors, file paths
- **Extension + Skill** - works as both a Pi extension and a skill
- **Smart model switching** - follows Pi model metadata and preserves custom settings
- **Conversation structure detection** - identifies turns, phases, and progress
- **Multi-pass summarization** — progressive compression with quality scoring
- **LLM-based summarization** — optional AI-powered compression (useLLM config)
- **Content-aware token counting** — dynamic ratios for code, prose, and whitespace
- **Compact section templates** — shorter headers, condensed formatting, saves 10-15% more tokens

## Installation

```bash
pi install npm:pi-ultra-compact
```

## Quick Start

After installation and restarting Pi, use:

```
/ultracompact
```

This triggers manual ultra-compact compaction.

Auto-compaction triggers automatically based on Pi's active model context window.

## Supported Models

The extension uses Pi's active model metadata as the source of truth for context window size. This avoids maintaining a separate model table in the extension and keeps thresholds aligned with Pi when new providers or models are added.

If Pi does not expose model metadata, the extension uses a conservative 128K-token fallback.

## How It Works

### Three-Tier System

1. **Preemptive check** (every turn): Projects next turn's token usage. If projected > 60% of context, triggers micro-compaction.
2. **Micro-compaction** (60-90% usage): Strips reasoning blocks + bulk tool outputs. No LLM call. Runs in microseconds.
3. **Full compaction** (90%+ usage): Graduated eviction preconditions the input, then structured summarization produces the final compacted context.

### Eviction Levels

| Level | What it strips | When |
|-------|---------------|------|
| 1 | Assistant thinking/reasoning blocks | Always (harmless removal) |
| 2 | Bulk tool outputs (>100 lines, >5K chars) | Most sessions |
| 3 | All non-error tool results | Heavy sessions |
| 4 | Oldest non-protected messages | Only when necessary |

### Safety Systems

- **Snapshot-rollback**: Messages are deep-copied before compaction. If anything fails, the original is preserved.
- **Circuit breaker**: After 3 consecutive failures, falls back to lossy truncation (keep system + last 10 turns).
- **User messages inviolable**: Never stripped regardless of token pressure.
- **Cache-aware mode**: Previous summaries stay immutable — only new content pays prefill cost.

## Configuration

Default settings work out of the box. The extension reads Pi's active model metadata and sets thresholds from `ctx.model.contextWindow` when available.

### Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `thresholdTokens` | Auto (80% of Pi context window, or 102,400 without metadata) | When to trigger compaction |
| `keepPercentage` | 30% | Percentage of context to keep |
| `maxKeepTokens` | 30,000 | Maximum tokens to keep |
| `autoCompact` | true | Enable automatic compaction |
| `cacheAware` | false | Immutable summary blocks (saves API costs) |
| `maxEvictionLevel` | FULL_REMOVAL | Max eviction aggressiveness |
| `outputHeadroom` | 4,096 | Tokens reserved for LLM response |
| `circuitBreakerMaxFailures` | 3 | Failures before lossy truncation |
| `preemptiveWatermark` | 0.70 | Preemptive trigger level |
| `hardWatermark` | 0.95 | Reactive fallback level |

## Commands

| Command | Description |
|---------|-------------|
| `/ultracompact` | Trigger manual ultra-compact compaction |

## Model Metadata

The extension does not ship its own model context-window table. Pi remains responsible for provider and model metadata; this extension uses the active model's `contextWindow` value for threshold calculation.

## Compatibility

- Works with any Pi-compatible model
- Compatible with gentle-engram (Engram memory backup)
- Compatible with gentle-pi (SDD/OpenSpec)
- No conflicts with Pi's default compaction

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

### v0.9.2 - Test Suite Fixes & Automation
- Fixed 27 test failures from jest/vitest API mismatch
- Replaced jest.fn() with vi.fn() across all test files
- Automated senior-dev-agent pipeline deployed (review, fix, publish, label)

### v0.9.1 - CI/CD Pipeline Automation

### v0.8.0 - Generational Compaction + Safety Systems

- **Graduated Eviction** — 4-level content stripping (reasoning → bulk → artifacts → full)
- **Generational Compaction** — micro (60-90%, no LLM) + full (90%+) tiers
- **Preemptive Trigger** — fires at 70% watermark by projecting next turn
- **Cache-Aware Mode** — immutable summary blocks preserve prompt cache
- **Snapshot-Rollback + Circuit Breaker** — session never dies from bad compaction
- **Vitest suite passing** — zero regressions

### v0.7.0 - Compact Templates & LLM Summarization

- **Compact section templates** - shorter headers save 10-15% tokens across all conversations
- **LLM-based summarization** - optional LLM-powered semantic compression
- **Content-aware token estimation** - dynamic ratios for code/prose/whitespace
- **66 tests, 100% pass rate** - including 13 new effectiveness benchmarks
- **generateSummary is now async** - supports LLM callback integration

### v0.6.0 - Algorithm Enhancement Release

Major improvements to compaction quality and performance:

- **Smart model switching** - follows Pi model metadata and preserves custom settings
- **Conversation structure detection** - identifies turns, phases, progress
- **Enhanced critical extraction** - progress indicators, questions, user preferences
- **Multi-pass summarization** - 3-pass compression with quality scoring
- **Token estimation cache** - LRU cache for 3x faster performance
- **100% test pass rate** - 43 unit tests + 17 performance benchmarks

### v0.5.0 - Audit & Stability Release

This release fixes 18 issues found via comprehensive 5-agent audit:

- **3 Critical regex bugs fixed** - `\b` word boundaries on all patterns, no more false matches
- **Startup model detection fixed** - correct threshold from boot
- **Custom thresholds preserved** - across model switches
- **Null safety** - guards on all message-consuming methods
- **53-test Jest suite** - comprehensive coverage
- **Dead code removed** - 329-line `.disabled` file deleted, unused `typebox` dep removed

## Troubleshooting

### Extension not loading

- Restart Pi after installation
- Check `pi install npm:pi-ultra-compact` completed successfully

### Wrong threshold detected

- The extension reads Pi's active model metadata at session start and model switch time
- Ensure Pi reports a `contextWindow` for your selected model
- If Pi does not expose model metadata, the extension falls back to 128K tokens

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Pi](https://pi.dev/) - The AI coding agent

