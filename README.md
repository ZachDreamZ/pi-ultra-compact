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
2. **Threshold calculation**: Sets compaction threshold at 80% of model's context window
3. **Critical extraction**: Identifies important information (goals, decisions, errors)
4. **Compression**: Generates compact summary preserving critical context
5. **File tracking**: Maintains read/modified file history across compactions

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

### v0.4.6 — Bug Fix Release

This release fixes 7 critical bugs found via adversarial audit:

- **Auto-threshold now works** — 80% of context window is applied correctly
- **No Node.js built-in modules** — fully compatible with Pi extension runtime sandbox
- **No conflicting handlers** — single `session_before_compact` listener
- **Null-safe** — guards everywhere for `ctx.session`, `event.preparation`, `Message.content`
- **Type-safe** — `Message.content` handles both `string` and structured `TextContent[]`

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
