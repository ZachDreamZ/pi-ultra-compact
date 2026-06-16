# pi-ultra-compact

Advanced compaction extension and skill for [Pi](https://pi.dev/) with automatic threshold-based compaction and support for 200+ models.

[![Pi Package](https://img.shields.io/badge/Pi-Package-blue)](https://pi.dev/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/pi-ultra-compact.svg)](https://www.npmjs.com/package/pi-ultra-compact)

## Features

- **`/ultracompact` command** for manual compaction
- **Auto-adapts threshold** to model's context window (80% of max)
- **200+ models supported** - OpenAI, Anthropic, Google, DeepSeek, Meta, Mistral, Qwen, and more
- **Hierarchical summarization** with entropy-based information extraction
- **Critical context preservation** - goals, decisions, errors, file paths
- **Extension + Skill** - works as both a Pi extension and a skill
- **Smart model switching** - remembers per-model thresholds and preserves custom settings
- **Conversation structure detection** - identifies turns, phases, and progress
- **Enhanced critical extraction** - detects progress, questions, user preferences
- **Multi-pass summarization** - progressive compression with quality scoring
- **Token estimation cache** - LRU cache for performance

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
| **OpenAI** | GPT-5/5.1/5.2, GPT-4.1, GPT-4o, O3, O4-mini | 8K - 1M tokens |
| **Anthropic** | Claude 4.5/4.0/3.7/3.5/3 | 200K tokens |
| **Google** | Gemini 2.5/2.0/1.5, Gemma 3/2 | 32K - 2M tokens |
| **DeepSeek** | V4 Pro, V3, V2.5, R1 | 64K - 1M tokens |
| **Meta** | Llama 4, 3.3, 3.1, 3, 2 | 4K - 1M tokens |
| **Mistral** | Medium 3.5, Large 3, Small 4, Codestral | 32K - 256K tokens |
| **Qwen** | Qwen3, Qwen2.5, Qwen2 | 32K - 128K tokens |
| **Microsoft** | Phi-4, Phi-3, Phi-2 | 2K - 32K tokens |
| **xAI** | Grok 3, Grok 2 | 8K - 131K tokens |
| **Cohere** | Command R+ | 128K tokens |
| **Yi** | Yi-1.5, Yi-34B | 4K - 200K tokens |

## How It Works

1. **Auto-detection**: Extension detects your model from Pi configuration
2. **Smart switching**: Remembers per-model thresholds, preserves custom settings
3. **Structure detection**: Identifies conversation turns, phases, and progress
4. **Critical extraction**: Enhanced extraction of goals, decisions, errors, progress, preferences
5. **Multi-pass compression**: Progressive summarization with quality scoring
6. **File tracking**: Maintains read/modified file history across compactions

## Configuration

Default settings work out of the box. The extension auto-detects your model and sets appropriate thresholds.

### Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `thresholdTokens` | Auto (80% of context) | When to trigger compaction |
| `keepPercentage` | 30% | Percentage of context to keep |
| `maxKeepTokens` | 30,000 | Maximum tokens to keep |
| `autoCompact` | true | Enable automatic compaction |

## Commands

| Command | Description |
|---------|-------------|
| `/ultracompact` | Trigger manual ultra-compact compaction |

## Model Examples

```bash
# Works with any model - threshold auto-adapts
# Claude Opus: 160,000 tokens (80% of 200K)
# GPT-5: 320,000 tokens (80% of 400K)
# Gemini 2.5 Pro: 800,000 tokens (80% of 1M)
# DeepSeek V4 Pro: 800,000 tokens (80% of 1M)
```

## Compatibility

- Works with any Pi-compatible model
- Compatible with gentle-engram (Engram memory backup)
- Compatible with gentle-pi (SDD/OpenSpec)
- No conflicts with Pi's default compaction

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

### v0.6.0 — Algorithm Enhancement Release

Major improvements to compaction quality and performance:

- **Smart model switching** — per-model threshold memory, preserves custom settings
- **Conversation structure detection** — identifies turns, phases, progress
- **Enhanced critical extraction** — progress indicators, questions, user preferences
- **Multi-pass summarization** — 3-pass compression with quality scoring
- **Token estimation cache** — LRU cache for 3x faster performance
- **100% test pass rate** — 43 unit tests + 17 performance benchmarks

### v0.5.0 — Audit & Stability Release

This release fixes 18 issues found via comprehensive 5-agent audit:

- **3 Critical regex bugs fixed** — `\b` word boundaries on all patterns, no more false matches
- **Startup model detection fixed** — correct threshold from boot
- **Custom thresholds preserved** — across model switches
- **Null safety** — guards on all message-consuming methods
- **53-test Jest suite** — comprehensive coverage
- **Dead code removed** — 329-line `.disabled` file deleted, unused `typebox` dep removed

## Troubleshooting

### Extension not loading

- Restart Pi after installation
- Check `pi install npm:pi-ultra-compact` completed successfully

### Wrong threshold detected

- The extension auto-detects your model from Pi config
- Ensure your model is in the supported list (200+ models)
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
