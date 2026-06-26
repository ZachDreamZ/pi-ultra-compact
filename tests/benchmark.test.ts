/**
 * Performance benchmark tests for compaction speed (ROADMAP task 3.4)
 *
 * Measures execution time for key UltraCompactEngine operations at
 * 1K and 10K message scales using performance.now() timestamps.
 */

import { UltraCompactEngine } from "../extensions/engine";
import type { Message } from "../extensions/types";
import { makeMsgFrom } from "./helpers";

// ─── Helpers ──────────────────────────────────────────────────────

function generateConversation(size: number): Message[] {
  const msgs: Message[] = [];
  const roles = ["user", "assistant", "tool", "system"] as const;
  const contents = [
    "What is the weather today?",
    "I need to sort this array of numbers.",
    "The GOAL is to implement the sorting algorithm correctly.",
    "ERROR: undefined is not a function at sortArray (utils.js:42)",
    "Let me check the file at /home/user/project/src/index.ts",
    "The SOLUTION is to add a null check before calling sort.",
    "DECISION: use merge sort for O(n log n) performance.",
    "Here is the implementation:\n```typescript\nfunction sort(arr: number[]): number[] {\n  if (arr.length <= 1) return arr;\n  const mid = Math.floor(arr.length / 2);\n  const left = sort(arr.slice(0, mid));\n  const right = sort(arr.slice(mid));\n  return merge(left, right);\n}\n```",
    "CONSTRAINT: must handle up to 10 million elements.",
    "DISCOVERED that the built-in sort is faster for small arrays.",
    "NEXT: add unit tests for edge cases with empty arrays.",
    "Modified files: src/sort.ts, src/utils.ts, tests/sort.test.ts",
  ];

  for (let i = 0; i < size; i++) {
    msgs.push(
      makeMsgFrom({
        id: `msg-${i}`,
        role: roles[i % roles.length],
        content: contents[i % contents.length],
        timestamp: Date.now() + i,
      }),
    );
  }
  return msgs;
}

function elapsedMs(start: number): number {
  return (performance.now() - start);
}

function formatTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  return `${(ms * 1000).toFixed(0)}μs`;
}

interface BenchmarkResult {
  operation: string;
  messageCount: number;
  elapsedMs: number;
}

const results: BenchmarkResult[] = [];

function record(
  operation: string,
  messageCount: number,
  elapsedMs: number,
): void {
  results.push({ operation, messageCount, elapsedMs });
}

// ─── 1K Message Benchmarks ────────────────────────────────────────

describe("benchmark — 1,000 messages", () => {
  let engine: UltraCompactEngine;
  let messages1k: Message[];

  beforeAll(() => {
    engine = new UltraCompactEngine({ modelName: "gpt-4o" });
    messages1k = generateConversation(1000);
  });

  it("estimateTokens for 1K messages", () => {
    const start = performance.now();
    const tokens = engine.estimateTokens(messages1k);
    const elapsed = elapsedMs(start);
    record("estimateTokens", 1000, elapsed);
    expect(tokens).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
  });

  it("extractCriticalInfo for 1K messages", () => {
    const start = performance.now();
    const info = engine.extractCriticalInfo(messages1k);
    const elapsed = elapsedMs(start);
    record("extractCriticalInfo", 1000, elapsed);
    expect(info.critical.length).toBeGreaterThan(0);
    expect(info.compressible.length).toBeGreaterThan(0);
    expect(info.scores.size).toBe(1000);
    expect(elapsed).toBeLessThan(5000);
  });

  it("determineTier for 1K messages", () => {
    const start = performance.now();
    const tier = engine.determineTier(messages1k);
    const elapsed = elapsedMs(start);
    record("determineTier", 1000, elapsed);
    expect(typeof tier).toBe("number");
    expect(elapsed).toBeLessThan(5000);
  });

  it("microCompact for 1K messages", () => {
    const start = performance.now();
    const result = engine.microCompact(messages1k);
    const elapsed = elapsedMs(start);
    record("microCompact", 1000, elapsed);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(10000);
  });

  it("evictGradually for 1K messages (all levels)", () => {
    const start = performance.now();
    const result = engine.evictGradually(messages1k);
    const elapsed = elapsedMs(start);
    record("evictGradually", 1000, elapsed);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10000);
  });
});

// ─── 10K Message Benchmarks ───────────────────────────────────────

describe("benchmark — 10,000 messages", () => {
  let engine: UltraCompactEngine;
  let messages10k: Message[];

  beforeAll(() => {
    engine = new UltraCompactEngine({ modelName: "gpt-4o" });
    messages10k = generateConversation(10000);
  });

  it("estimateTokens for 10K messages", () => {
    const start = performance.now();
    const tokens = engine.estimateTokens(messages10k);
    const elapsed = elapsedMs(start);
    record("estimateTokens", 10000, elapsed);
    expect(tokens).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(30000);
  });

  it("extractCriticalInfo for 10K messages", () => {
    const start = performance.now();
    const info = engine.extractCriticalInfo(messages10k);
    const elapsed = elapsedMs(start);
    record("extractCriticalInfo", 10000, elapsed);
    expect(info.critical.length).toBeGreaterThan(0);
    expect(info.compressible.length).toBeGreaterThan(0);
    expect(info.scores.size).toBe(10000);
    expect(elapsed).toBeLessThan(30000);
  });

  it("determineTier for 10K messages", () => {
    const start = performance.now();
    const tier = engine.determineTier(messages10k);
    const elapsed = elapsedMs(start);
    record("determineTier", 10000, elapsed);
    expect(typeof tier).toBe("number");
    expect(elapsed).toBeLessThan(30000);
  });

  it("microCompact for 10K messages", () => {
    const start = performance.now();
    const result = engine.microCompact(messages10k);
    const elapsed = elapsedMs(start);
    record("microCompact", 10000, elapsed);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(60000);
  });

  it("evictGradually for 10K messages (all levels)", () => {
    const start = performance.now();
    const result = engine.evictGradually(messages10k);
    const elapsed = elapsedMs(start);
    record("evictGradually", 10000, elapsed);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(60000);
  });
});

// ─── Summary ───────────────────────────────────────────────────────

afterAll(() => {
  console.log("\n=== BENCHMARK RESULTS ===");
  console.table(
    results.map((r) => ({
      Operation: r.operation,
      Messages: r.messageCount.toLocaleString(),
      "Time (ms)": r.elapsedMs.toFixed(2),
      Formatted: formatTime(r.elapsedMs),
    })),
  );

  // Report as structured output for CI / dashboard
  console.log(
    "BENCHMARK_MARKER:" + JSON.stringify(results),
  );
});
