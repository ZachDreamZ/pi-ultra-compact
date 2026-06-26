# Contributing to pi-ultra-compact

## Setup

```bash
git clone https://github.com/ZachDreamZ/pi-ultra-compact.git
cd pi-ultra-compact
npm install
```

## Development

```bash
# Run tests
npm test

# Type-check
npm run typecheck

# Build
npm run build
```

## Project Structure

```
extensions/
├── engine.ts       # Core compaction engine (1472 lines)
├── index.ts        # Pi extension integration
├── types/          # TypeScript type definitions
└── utils.ts        # Shared utilities
tests/
├── engine.test.ts           # Core engine unit tests
├── engine-coverage.test.ts  # Branch/edge coverage tests
├── index.test.ts            # Extension integration tests
├── detection-verify.test.ts # Model detection tests
├── effectiveness.test.ts    # Compression benchmark tests
├── extension.test.ts        # Extension lifecycle tests
└── helpers.ts               # Test helpers
```

## Coding Standards

- **TypeScript** — strict mode, no `any` types
- **Tests** — vitest, async tests use `async/await`
- **Error handling** — try/catch or Result types for fallible operations
- **No TODOs or debug code** in commits
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `test:`

## Making Changes

1. Create a branch from `main`: `git checkout -b fix/description` or `feat/description`
2. Make your changes with tests
3. Run `npm test` — all tests must pass
4. Push and open a Pull Request

## Pull Request Process

1. Ensure `npm test` is green
2. Add tests for new functionality
3. Update ROADMAP.md if implementing a planned task
4. Update CHANGELOG.md for user-facing changes
5. A maintainer will review within 48 hours

## ROADMAP

See [ROADMAP.md](ROADMAP.md) for the current sprint and task priorities. Tasks are organized into phases with dependencies. Pick a `[ ]` task whose deps are all `[x]`.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
