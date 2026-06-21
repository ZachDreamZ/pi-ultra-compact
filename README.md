# pi-ultra-compact

Advanced compaction extension and skill for [Pi](https://pi.dev/) with automatic threshold-based compaction and support for 70+ models across 15+ providers.

[![Pi Package](https://img.shields.io/badge/Pi-Package-blue)](https://pi.dev/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/pi-ultra-compact.svg)](https://www.npmjs.com/package/pi-ultra-compact)

## Features

- **`/ultracompact` command** for manual compaction
- **Auto-adapts threshold** to model's context window (60-80% of max)
- **70+ models supported** - OpenAI, Anthropic, Google, DeepSeek, Meta, Mistral, Qwen, Kimi, MiniMax, GLM, xAI, NVIDIA, Xiaomi, and more
- **Smart model ID normalization** - automatically strips provider prefixes (`opencode/`, `openai/`, etc.), suffixes (`-free`, `-latest`, `-preview`), and date stamps
- **Runtime context window** - uses Pi's authoritative context window when available, falls back to detection
- **Graduated Eviction (4 levels)** — strips reasoning, bulk outputs, artifacts, then messages
- **Generational Compaction** — micro (fast, no LLM) at 60-90%, full at 90%+
- **Preemptive Trigger** — fires before next turn, never pays latency during user turns
- **Cache-Aware Compaction** — immutable summary blocks keep prompt cache warm
- **Circuit Breaker** — 3 strikes → lossy truncation fallback, session never dies
- **Hierarchical summarization** with entropy-based information extraction
- **Critical context preservation** - goals, decisions, errors, file paths
- **Extension + Skill** - works as both a Pi extension and a skill
- **Smart model switching** - remembers per-model thresholds and preserves custom settings
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

Auto-compaction triggers automatically when context exceeds 80% of your model's context window.

## Supported Models

| Provider | Models | Context Window |
|----------|--------|----------------|
| **OpenAI** | GPT-5/5.1/5.2/5.4/5.5, GPT-4.1, GPT-4o, O1/O3/O4 | 128K - 1.1M tokens |
| **Anthropic** | Claude Opus/Sonnet/Haiku 4.x, 3.x | 200K - 1M tokens |
| **Google** | Gemini 3.5/3.1/2.5/2.0/1.5, Gemma 3/2 | 8K - 2M tokens |
| **DeepSeek** | V4 Pro/Flash, V3, V2.5, R1 | 64K - 1M tokens |
| **Meta** | Llama 4 Maverick/Scout, 3.3, 3.1 | 128K - 1M tokens |
| **Mistral** | Medium 3.5, Large 3, Codestral | 128K - 256K tokens |
| **Qwen** | Qwen 3.6/3.5/3, Qwen 2.5 Coder | 131K - 262K tokens |
| **Kimi/Moonshot** | Kimi K2.6/K2.5/K2, Moonshot V1 | 128K - 262K tokens |
| **MiniMax** | M2.7, M2.5 | 204K tokens |
| **GLM (Zhipu)** | GLM 5.1/5/4-Plus | 128K - 204K tokens |
| **xAI** | Grok Build, Grok 3/2 | 131K - 256K tokens |
| **NVIDIA** | Nemotron 3 Super, Nemotron 4 | 128K - 204K tokens |
| **Xiaomi** | MiMo V2.5 Pro/V2.5 | 1M tokens |
| **OpenCode** | big-pickle | 200K tokens |

Provider-prefixed model IDs are handled automatically (e.g. `opencode/deepseek-v4-flash-free` → `deepseek-v4-flash`).

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

Default settings work out of the box. The extension auto-detects your model and sets appropriate thresholds.

### Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `thresholdTokens` | Auto (60-80% of context) | When to trigger compaction |
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

## Model Examples

```bash
# Works with any model - threshold auto-adapts
# Claude Sonnet 4: 160,000 tokens (80% of 200K)
# GPT-5.4 Pro: 880,000 tokens (80% of 1.1M)
# Gemini 2.5 Pro: 800,000 tokens (80% of 1M)
# DeepSeek V4 Flash: 160,000 tokens (80% of 200K)
# Kimi K2.5: 209,680 tokens (80% of 262K)

# Provider-prefixed IDs work too:
# opencode/deepseek-v4-flash-free → DeepSeek, 200K
# opencode-go/kimi-k2.5 → Moonshot, 262K
```

## Compatibility

- Works with any Pi-compatible model
- Compatible with gentle-engram (Engram memory backup)
- Compatible with gentle-pi (SDD/OpenSpec)
- No conflicts with Pi's default compaction

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

### v0.9.0 - Model Detection Overhaul

- **Smart model ID normalization** — strips provider prefixes, suffixes (`-free`, `-latest`), and date stamps
- **70+ models** — added Qwen, Kimi, MiniMax, GLM, Grok, Nemotron, MiMo, OpenCode models
- **20+ model families** — expanded from 6 to detect alibaba, moonshot, minimax, zhipu, xai, nvidia, xiaomi, opencode
- **Runtime context window** — uses Pi's authoritative `ctx.model.contextWindow` when available
- **195 tests, 100% pass rate** — 17 new detection tests

### v0.8.0 - Generational Compaction + Safety Systems

- **Graduated Eviction** — 4-level content stripping (reasoning → bulk → artifacts → full)
- **Generational Compaction** — micro (60-90%, no LLM) + full (90%+) tiers
- **Preemptive Trigger** — fires at 70% watermark by projecting next turn
- **Cache-Aware Mode** — immutable summary blocks preserve prompt cache
- **Snapshot-Rollback + Circuit Breaker** — session never dies from bad compaction
- **66 tests, 100% pass rate** — zero regressions

### v0.7.0 - Compact Templates & LLM Summarization

- **Compact section templates** - shorter headers save 10-15% tokens across all conversations
- **LLM-based summarization** - optional LLM-powered semantic compression
- **Content-aware token estimation** - dynamic ratios for code/prose/whitespace
- **66 tests, 100% pass rate** - including 13 new effectiveness benchmarks
- **generateSummary is now async** - supports LLM callback integration

### v0.6.0 - Algorithm Enhancement Release

Major improvements to compaction quality and performance:

- **Smart model switching** - per-model threshold memory, preserves custom settings
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

- The extension auto-detects your model from Pi config
- Ensure your model is in the supported list (70+ models)
- Run `/ultracompact` manually to see detected model and threshold in the logs

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
