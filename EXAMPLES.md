# pi-ultra-compact Examples

Real-world usage patterns for the pi-ultra-compact compaction engine.

## Installation

```bash
npm install pi-ultra-compact
```

## Basic Setup

The UltraCompactEngine class is the core compaction engine. It can be used standalone or as a Pi extension.

```typescript
import { UltraCompactEngine } from "pi-ultra-compact/extensions/engine";
import { piUltraCompact } from "pi-ultra-compact";
const engine = new UltraCompactEngine({ thresholdTokens: 100000, maxEvictionLevel: 4, cacheAware: true });
```

## Pi Extension Integration

The piUltraCompact factory registers all hooks and commands with Pi.

```typescript
import piUltraCompact from "pi-ultra-compact";
piUltraCompact(pi);
piUltraCompact(pi, { thresholdTokens: 80000, cacheAware: true });
```

## Graduated Eviction Levels

The engine strips content incrementally across 4 levels:

- Level 1 (STRIP_REASONING): Removes assistant reasoning/thinking blocks
- Level 2 (STRIP_BULK_OUTPUT): Truncates tool outputs >100 lines or >5000 chars
- Level 3 (STRIP_ARTIFACTS): Strips non-error tool outputs, preserves errors
- Level 4 (FULL_REMOVAL): Removes oldest compressible messages (never user/system)

```typescript
import { EvictionLevel } from "pi-ultra-compact/extensions/types";
const result = engine.compact(messages, { maxEvictionLevel: EvictionLevel.STRIP_ARTIFACTS });
```

## Cache-Aware Compaction

When cacheAware: true, previous summary stays immutable, new content is appended.
This preserves the prompt cache prefix across compaction passes.

```typescript
NaN
```

## Circuit Breaker

Configurable circuit breaker prevents cascading compaction failures.
When tripped: falls back to lossy truncation (sys + last 10), auto-resets after cooldown.

```typescript
piUltraCompact(pi, { circuitBreakerMaxFailures: 3, circuitBreakerCooldown: 5 });
```

## Manual Compaction

Use /ultracompact to force compaction regardless of token count.

```
/ultracompact
```

## Configuration Reference

| Option | Default | Description |
|--------|---------|-------------|
| thresholdTokens | auto (80% of context) | Token threshold |
| maxEvictionLevel | 4 | Max eviction level (1-4) |
| cacheAware | false | Preserve prompt cache prefix |
| circuitBreakerMaxFailures | 3 | Failures before circuit trips |
| circuitBreakerCooldown | 5 | Turns before circuit auto-resets |
| autoCompact | true | Enable automatic compaction |

## See Also

- [README.md](README.md)
- [ROADMAP.md](ROADMAP.md)
- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [PLAN-V1.md](PLAN-V1.md)
