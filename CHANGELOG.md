# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
