# pi-ultra-compact

A high-compression compaction extension for [Pi](https://pi.dev/) that creates ultra-dense conversation summaries while preserving all critical context.

[![Pi Package](https://img.shields.io/badge/Pi-Package-blue)](https://pi.dev/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/pi-ultra-compact.svg)](https://www.npmjs.com/package/pi-ultra-compact)

## Features

- **Three compression levels**: ultra, aggressive, standard
- **Ultra-dense format** with abbreviations, symbols, and shorthand
- **Smart prioritization**: decisions > file changes > progress > context
- **File operation tracking**: added, modified, deleted, read
- **Configurable** via settings file
- **Compatible** with gentle-engram and gentle-pi

## Installation

```bash
pi install npm:pi-ultra-compact
```

## Quick Start

After installation, the extension automatically activates during compaction. Use:

```bash
/compression-level ultra      # Maximum compression (default)
/compression-level aggressive # Balanced compression
/compression-level standard   # Readable format
/compact                      # Trigger manual compaction
```

## Compression Levels

### Ultra (Default)

Maximum information density using abbreviations and symbols:

```
[GOAL] Implement user auth system
[DEC] D1: JWT over sessions | stateless, scalable
[FILES] +auth.ts: JWT logic ~user.ts: add auth fields
[PROG] DONE: schema,models | WIP: login endpoint | BLOCKED: none
[NEXT] 1. Add middleware 2. Tests 3. Docs
[CTX] JWT_SECRET=xxx, DB=postgres
[MEM] none
```

### Aggressive

Good compression with readable markdown format:

```
## Goal
Implement JWT-based user authentication.

## Decisions
- JWT over sessions: More scalable, stateless

## Files
| Action | Path | Change |
|--------|------|--------|
| + | auth.ts | JWT logic |
| ~ | user.ts | Add auth fields |

## Progress
- Done: Schema, models
- WIP: Login endpoint
- Blocked: None

## Next
1. Add auth middleware
2. Write tests
3. Update docs
```

### Standard

Standard compression similar to default Pi compaction.

## Configuration

Edit `~/.pi/agent/extensions/ultra-compact-settings.json`:

```json
{
  "ultraCompactCompaction": {
    "level": "ultra",
    "summaryModel": null,
    "maxSummaryTokens": 4096,
    "keepRecentToolResults": 3,
    "preserveFileOps": true
  }
}
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `level` | string | `"ultra"` | Compression level: `ultra`, `aggressive`, or `standard` |
| `summaryModel` | string | `null` | Model for summarization (null = use conversation model) |
| `maxSummaryTokens` | number | `4096` | Maximum tokens for summary |
| `keepRecentToolResults` | number | `3` | Number of recent tool results to keep verbatim |
| `preserveFileOps` | boolean | `true` | Always preserve file operations in metadata |

## Commands

| Command | Description |
|---------|-------------|
| `/compression-level <level>` | Set compression level (ultra/aggressive/standard) |

## Metadata

Each compaction includes metadata as an HTML comment:

```html
<!-- ULTRA_COMPACT_META
FILES_ADDED: path/to/new.ts
FILES_MODIFIED: path/to/modified.ts
FILES_DELETED: path/to/deleted.ts
TOKENS_BEFORE: 150000
COMPRESSION: ultra
META -->
```

## How It Works

1. **Trigger**: Compaction when context exceeds threshold or manual `/compact`
2. **Extraction**: File operations extracted from tool calls
3. **Serialization**: Conversation converted to text format
4. **Compression**: Ultra-compact prompt sent to summarization model
5. **Output**: Dense summary with metadata replaces conversation history

## Compatibility

- ✅ Works with any model that supports text completion
- ✅ Compatible with gentle-engram (Engram memory backup)
- ✅ Compatible with gentle-pi (SDD/OpenSpec)
- ✅ No conflicts with other compaction extensions

## Troubleshooting

### No suitable model found
- Ensure you have API keys configured for at least one provider
- Check that the model exists in your Pi configuration

### Auth failed
- Verify API keys are set correctly
- Check provider configuration in Pi settings

### Summary is empty
- Try a different model
- Check if conversation is too short for meaningful compression
- Review Pi logs for errors

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
