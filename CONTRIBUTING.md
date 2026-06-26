# Contributing to pi-ultra-compact

Thanks for your interest in contributing! This project is managed by a senior-dev-agent automation pipeline, but community contributions are welcome.

## Quick Start

```bash
git clone https://github.com/ZachDreamZ/pi-ultra-compact.git
cd pi-ultra-compact
npm install
npm test
```

All tests should pass. If they don't, open an issue.

## Development

### Commands

| Command | What it does |
|---------|-------------|
| `npm test` | Run the full vitest suite |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run build` | Compile TypeScript |

### Code Style

- **TypeScript strict mode** — no `any` types unless absolutely necessary with a comment explaining why
- **JSDoc** on all public methods
- **const** over `let` wherever possible
- **No debug logs, commented-out code, or TODOs** in commits
- **No AI vocabulary** (delve, leverage, utilize, showcase) — write like a human

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add graduated eviction Level 3
fix: handle null message content in extractCriticalInfo
docs: add CONTRIBUTING.md with setup instructions
chore: update vitest to 4.1.9
```

### Branch Naming

```
feat/graduated-eviction-level-4
fix/message-content-null-guard
docs/roadmap-update-and-templates
chore/update-dependencies
```

### PR Workflow

1. Create a feature/fix/docs branch from `main`
2. Make your changes — keep scope focused
3. Run `npm test` — all tests must pass
4. Push and open a PR against `main`
5. The senior-dev-agent reviews and merges

### Test Guidelines

- Place tests in `tests/` directory
- Use `vitest` (not Jest)
- Import helpers from `tests/helpers.ts`
- 1 test file per module (e.g., `engine.test.ts` for `extensions/engine.ts`)
- Cover edge cases: empty arrays, null content, boundary conditions
- Don't test implementation details — test behavior

## Architecture

```
extensions/
  index.ts         — Pi extension entry point (command registration, event handlers)
  engine.ts        — Core UltraCompactEngine class (compaction logic)
  utils.ts         — Shared utilities (messageContent, keyword patterns)
  types/
    index.ts       — TypeScript types and interfaces
tests/
  engine.test.ts        — Core engine unit tests
  engine-coverage.test.ts — Branch/line coverage tests
  index.test.ts          — Extension entry point tests
  extension.test.ts      — Pi extension integration tests
  detection-verify.test.ts — Model detection tests
  effectiveness.test.ts  — Compression effectiveness tests
  helpers.ts             — Test helpers (makeMsg, makeStructuredMsg)
```

## Release Process

Releases are automated via the senior-dev-agent pipeline:

1. ROADMAP tasks are completed and marked `[x]`
2. CHANGELOG.md is updated with `[Unreleased]` entries
3. Tests pass (194+ tests green)
4. CI pipeline publishes to npm automatically

Version bumps follow semver based on changelog content.

## Reporting Issues

Open a [GitHub Issue](https://github.com/ZachDreamZ/pi-ultra-compact/issues/new) with:

- Bug reports: steps to reproduce, expected vs actual behavior, environment
- Feature requests: use case, desired behavior, alternatives considered

## Code of Conduct

Be respectful, constructive, and professional. This is a small project — treat others the way you'd like to be treated.
