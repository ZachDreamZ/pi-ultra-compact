# pi-ultra-compact Examples

## Basic Usage

### As a Pi Extension

```javascript
import piUltraCompact from "pi-ultra-compact";

// Register with default config
piUltraCompact(pi);

// Or with custom config
piUltraCompact(pi, {
  keepPercentage: 0.4,
  maxKeepTokens: 50000,
  cacheAware: true,
  useLLM: true,
  llmSummarize: async (text) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Summarize:\n\n${text}` }],
      }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
  },
});
```

### Programmatic Usage

```javascript
import { UltraCompactEngine } from "pi-ultra-compact";

const engine = new UltraCompactEngine({
  modelName: "claude-sonnet-4-20250514",
  contextWindow: 200000,
  thresholdTokens: 160000,
});

// Check if compaction is needed
const tokens = engine.estimateTokens(messages);
if (engine.shouldCompact(tokens)) {
  // Option A: Let the engine decide the best tier
  const result = await engine.compact(messages);

  console.log(`Compression ratio: ${result.compressionRatio}`);
  console.log(`Summary:\n${result.summary}`);

  // Option B: Force micro-compaction (faster, no LLM)
  const micro = engine.microCompact(messages);
  console.log(`Saved ${micro.tokensSaved} tokens`);

  // Option C: Full structured summary
  const full = await engine.generateSummary(messages, previousSummary);
}
```

## Configuration Examples

### Cache-Aware Mode (Prompt Cache Friendly)

```javascript
const engine = new UltraCompactEngine({
  cacheAware: true,        // Keeps previous summaries immutable
  thresholdTokens: 100000,  // Fire at ~100K tokens
});
```

When `cacheAware: true`, the previous summary is preserved verbatim and only new
content is summarized. This keeps the system prompt + earlier summaries in the
LLM's prompt cache, saving on API costs.

### Circuit Breaker Tuning

```javascript
// Aggressive: trip after 1 failure, longer cooldown
new UltraCompactEngine({
  circuitBreakerMaxFailures: 1,
  circuitBreakerCooldown: 10,
});

// Lenient: allow 5 failures before tripping
new UltraCompactEngine({
  circuitBreakerMaxFailures: 5,
  circuitBreakerCooldown: 3,
});
```

### Watermark Configuration

```javascript
// Conservative: fire preemptive at 50%, fallback at 80%
new UltraCompactEngine({
  preemptiveWatermark: 0.5,
  hardWatermark: 0.8,
});

// Aggressive: fire preemptive at 30%, fallback at 60%
new UltraCompactEngine({
  preemptiveWatermark: 0.3,
  hardWatermark: 0.6,
});
```

### Eviction Level Cap

```javascript
// Only strip reasoning blocks and bulk outputs (no artifact stripping)
new UltraCompactEngine({
  maxEvictionLevel: 2, // STRIP_BULK_OUTPUT
});

// Allow all eviction levels up to full message removal
new UltraCompactEngine({
  maxEvictionLevel: 4, // FULL_REMOVAL
});
```

## Integration Patterns

### With gentle-engram

```javascript
import piUltraCompact from "pi-ultra-compact";
import piGentleEngram from "gentle-engram";

piUltraCompact(pi, { cacheAware: true });
piGentleEngram(pi);

// Both work together — ultra-compact handles compaction,
// gentle-engram handles memory backup.
```

### Manual Trigger from Code

```javascript
import piUltraCompact from "pi-ultra-compact";

const engine = new UltraCompactEngine();

// Simulate what /ultracompact does
async function triggerManualCompact(ctx) {
  if (typeof ctx.compact !== "function") {
    console.error("compact() not available");
    return;
  }
  ctx.compact({
    customInstructions: "ultracompact",
    onComplete: () => console.log("Compact complete"),
    onError: (err) => console.error("Compact failed:", err.message),
  });
}
```

## Testing with the Engine

```javascript
import { UltraCompactEngine } from "pi-ultra-compact";

function makeMsg(id, role, content) {
  return { id, role, content, timestamp: Date.now() };
}

// Test that important content is preserved
const engine = new UltraCompactEngine();
const msgs = [
  makeMsg("1", "user", "GOAL: Build a payment gateway"),
  makeMsg("2", "user", "ERROR: Connection timeout"),
];
const result = await engine.generateSummary(msgs);
console.assert(result.summary.includes("payment gateway"));
console.assert(result.summary.includes("Connection timeout"));
```

## CLI / Script Usage

```javascript
// compact-session.js
import { UltraCompactEngine } from "pi-ultra-compact";
import fs from "fs";

const session = JSON.parse(fs.readFileSync("session.json", "utf-8"));
const engine = new UltraCompactEngine({ modelName: "gpt-4o" });

const result = await engine.compact(session.messages);
console.log(JSON.stringify(result, null, 2));
```

Run with:

```bash
node compact-session.js
```
