/**
 * Edge case tests for UltraCompactEngine (ROADMAP 3.1)
 *
 * Covers: empty messages, null/undefined content, missing fields,
 * huge inputs, boundary values, and invalid types.
 */

import { UltraCompactEngine } from "../extensions/engine";
import type { Message } from "../extensions/types";
import { CompactionTier } from "../extensions/types";

function makeMsg(id: string, role: string, content: string): Message {
	return { id, role: role as any, content, timestamp: Date.now() };
}

function makeStructuredMsg(
	id: string,
	role: string,
	blocks: { type: string; text?: string }[],
): Message {
	return { id, role: role as any, content: blocks as any, timestamp: Date.now() };
}

// ─── Empty Messages Array ──────────────────────────────────────────

describe("empty messages array", () => {
	it("extractCriticalInfo returns empty results", () => {
		const engine = new UltraCompactEngine();
		const result = engine.extractCriticalInfo([]);
		expect(result.critical).toEqual([]);
		expect(result.compressible).toEqual([]);
		expect(result.scores.size).toBe(0);
	});

	it("determineTier returns NONE", () => {
		const engine = new UltraCompactEngine();
		expect(engine.determineTier([])).toBe(CompactionTier.NONE);
	});

	it("microCompact returns empty messages", () => {
		const engine = new UltraCompactEngine();
		const result = engine.microCompact([]);
		expect(result.messages).toEqual([]);
		expect(result.tokensSaved).toBe(0);
		expect(result.messagesStripped).toBe(0);
	});

	it("compact returns zero metrics for empty input", async () => {
		const engine = new UltraCompactEngine();
		const result = await engine.compact([]);
		expect(result.summary).toBe("");
		expect(result.tokensBefore).toBe(0);
		expect(result.tokensAfter).toBe(0);
		expect(result.compressionRatio).toBe(1);
	});

	it("estimateTokens returns 0", () => {
		const engine = new UltraCompactEngine();
		expect(engine.estimateTokens([])).toBe(0);
	});

	it("compact with MICRO tier returns ratio=1 for empty", async () => {
		const engine = new UltraCompactEngine();
		const result = await engine.compact([], undefined, CompactionTier.MICRO);
		expect(result.compressionRatio).toBe(1);
		expect(result.tokensBefore).toBe(0);
		expect(result.tokensAfter).toBe(0);
	});

	it("compact with FULL tier on empty returns empty summary", async () => {
		const engine = new UltraCompactEngine();
		const result = await engine.compact([], undefined, CompactionTier.FULL);
		expect(result.summary).toBe("");
		expect(result.tokensBefore).toBe(0);
		expect(result.tokensAfter).toBe(0);
	});
});

// ─── Null / Undefined Content ──────────────────────────────────────

describe("null/undefined content", () => {
	it("messages with null content in estimateTokens returns 0", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: null as any,
			timestamp: Date.now(),
		};
		expect(engine.estimateTokens([msg])).toBe(0);
	});

	it("messages with undefined content in estimateTokens returns 0", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: undefined as any,
			timestamp: Date.now(),
		};
		expect(engine.estimateTokens([msg])).toBe(0);
	});

	it("extractCriticalInfo handles null content as compressible", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: null as any,
			timestamp: Date.now(),
		};
		const result = engine.extractCriticalInfo([msg]);
		expect(result.compressible.length).toBe(1);
		expect(result.critical.length).toBe(0);
	});

	it("extractCriticalInfo handles undefined content as compressible", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: undefined as any,
			timestamp: Date.now(),
		};
		const result = engine.extractCriticalInfo([msg]);
		expect(result.compressible.length).toBe(1);
	});

	it("generateSummary handles messages with null content", async () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: null as any,
			timestamp: Date.now(),
		};
		const result = await engine.generateSummary([msg]);
		// null → "" via ?? → 0 tokens
		expect(result.tokensBefore).toBe(0);
		expect(result.summary).toBe("");
	});

	it("generateSummary handles messages with undefined content", async () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: undefined as any,
			timestamp: Date.now(),
		};
		const result = await engine.generateSummary([msg]);
		expect(result.tokensBefore).toBe(0);
	});

	it("evictGradually handles messages with null content", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: null as any,
			timestamp: Date.now(),
		};
		const result = engine.evictGradually([msg], 1000);
		expect(result.messages.length).toBe(1);
	});
});

// ─── Missing Fields ───────────────────────────────────────────────

describe("messages with missing fields", () => {
	it("handles messages missing id field", () => {
		const engine = new UltraCompactEngine();
		const msg = {
			role: "user",
			content: "Hello",
			timestamp: Date.now(),
		} as any;
		expect(() => engine.estimateTokens([msg])).not.toThrow();
	});

	it("handles messages missing role field", () => {
		const engine = new UltraCompactEngine();
		const msg = {
			id: "1",
			content: "Hello",
			timestamp: Date.now(),
		} as any;
		const result = engine.extractCriticalInfo([msg]);
		expect(result).toBeDefined();
	});

	it("handles messages missing timestamp field", () => {
		const engine = new UltraCompactEngine();
		const msg = {
			id: "1",
			role: "user",
			content: "Hello",
		} as any;
		expect(() => engine.estimateTokens([msg])).not.toThrow();
	});

	it("handles messages with empty string id", () => {
		const engine = new UltraCompactEngine();
		const msg = makeMsg("", "user", "Content");
		const result = engine.extractCriticalInfo([msg]);
		expect(result.scores.has("")).toBe(true);
	});
});

// ─── Invalid Array Entries: null/undefined/null throws ────────────

describe("invalid array entries", () => {
	it("array containing null entries throws TypeError", () => {
		const engine = new UltraCompactEngine();
		const msgs = [null, makeMsg("1", "user", "Hello"), null] as any;
		expect(() => engine.estimateTokens(msgs)).toThrow();
	});

	it("array with undefined entries throws TypeError", () => {
		const engine = new UltraCompactEngine();
		const msgs = [undefined, makeMsg("1", "user", "Hello")] as any;
		expect(() => engine.estimateTokens(msgs)).toThrow();
	});

	it("handles non-object entries in array gracefully", () => {
		const engine = new UltraCompactEngine();
		const msgs = ["string", 42, true] as any;
		// Primitives don't throw — messageContent receives undefined content
		expect(() => engine.estimateTokens(msgs)).not.toThrow();
		expect(engine.estimateTokens(msgs)).toBe(0);
	});
});

// ─── Content Type Edge Cases ───────────────────────────────────────

describe("content type edge cases", () => {
	it("handles numeric content (not string, not array)", () => {
		const engine = new UltraCompactEngine();
		const msg = {
			id: "1", role: "user", content: 42 as any, timestamp: Date.now(),
		};
		expect(engine.estimateTokens([msg])).toBeGreaterThan(0);
	});

	it("handles boolean content", () => {
		const engine = new UltraCompactEngine();
		const msg = {
			id: "1", role: "user", content: true as any, timestamp: Date.now(),
		};
		expect(() => engine.estimateTokens([msg])).not.toThrow();
	});

	it("handles plain object content", () => {
		const engine = new UltraCompactEngine();
		const msg = {
			id: "1", role: "user", content: { foo: "bar" } as any, timestamp: Date.now(),
		};
		expect(() => engine.estimateTokens([msg])).not.toThrow();
	});

	it("structured content with all image blocks yields 0 tokens", () => {
		const engine = new UltraCompactEngine();
		const msg = makeStructuredMsg("1", "user", [
			{ type: "image" } as any, { type: "image" } as any,
		]);
		expect(engine.estimateTokens([msg])).toBe(0);
	});

	it("structured content with 1000+ blocks", () => {
		const engine = new UltraCompactEngine();
		const blocks: { type: string; text?: string }[] = [];
		for (let i = 0; i < 1000; i++) {
			blocks.push({ type: "text", text: "Block " + i + " content here." });
		}
		const msg = makeStructuredMsg("1", "user", blocks);
		expect(engine.estimateTokens([msg])).toBeGreaterThan(0);
	});

	it("mixed text/image blocks work in extractCriticalInfo", () => {
		const engine = new UltraCompactEngine();
		const msg = makeStructuredMsg("1", "user", [
			{ type: "text", text: "GOAL: Build the system" },
			{ type: "image" } as any,
			{ type: "text", text: "DECISION: Use TypeScript" },
		]);
		const result = engine.extractCriticalInfo([msg]);
		expect(result.critical.length).toBe(1);
	});
});

// ─── Huge Inputs ──────────────────────────────────────────────────

describe("huge inputs", () => {
	it("handles 10,000 messages without crashing", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		for (let i = 0; i < 10000; i++) {
			msgs.push(makeMsg(String(i), "user", "Message " + i));
		}
		expect(engine.estimateTokens(msgs)).toBeGreaterThan(0);
	});

	it("handles single message with 500KB content", () => {
		const engine = new UltraCompactEngine();
		const msg = makeMsg("1", "user", "A".repeat(500000));
		expect(engine.estimateTokens([msg])).toBeGreaterThan(0);
	});

	it("handles single message with 1MB content", () => {
		const engine = new UltraCompactEngine();
		const msg = makeMsg("1", "user", "B".repeat(1000000));
		expect(engine.estimateTokens([msg])).toBeGreaterThan(0);
	});

	it("handles message with 1000 content blocks via generateSummary", async () => {
		const engine = new UltraCompactEngine();
		const blocks: { type: string; text?: string }[] = [];
		for (let i = 0; i < 1000; i++) {
			blocks.push({ type: "text", text: "GOAL: Task item " + i });
		}
		const msg = makeStructuredMsg("1", "user", blocks);
		const result = await engine.generateSummary([msg]);
		expect(result.tokensBefore).toBeGreaterThan(0);
		expect(result.summary.length).toBeGreaterThan(0);
	});

	it("handles 10,000 messages in extractCriticalInfo", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		for (let i = 0; i < 10000; i++) {
			const text = i % 100 === 0 ? "GOAL: Milestone " + i : "Regular message " + i;
			msgs.push(makeMsg(String(i), "user", text));
		}
		const result = engine.extractCriticalInfo(msgs);
		expect(result.critical.length).toBeGreaterThan(0);
		expect(result.compressible.length).toBeGreaterThan(0);
		expect(result.scores.size).toBe(10000);
	});

	it("handles huge input in microCompact", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs: Message[] = [];
		for (let i = 0; i < 1000; i++) {
			msgs.push(makeMsg(String(i), "tool",
				"Large output " + i + ": " + "content ".repeat(100)));
		}
		const result = engine.microCompact(msgs);
		expect(result.messages.length).toBeLessThanOrEqual(msgs.length);
		expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
	});
});

// ─── Boundary Values ──────────────────────────────────────────────

describe("boundary values", () => {
	it("shouldCompact handles NaN token count", () => {
		const engine = new UltraCompactEngine();
		expect(engine.shouldCompact(NaN)).toBe(false);
	});

	it("shouldCompact handles Infinity token count", () => {
		const engine = new UltraCompactEngine();
		expect(engine.shouldCompact(Infinity)).toBe(true);
	});

	it("shouldCompact handles negative token count", () => {
		const engine = new UltraCompactEngine();
		expect(engine.shouldCompact(-1)).toBe(false);
	});

	it("shouldCompact handles zero token count", () => {
		const engine = new UltraCompactEngine();
		expect(engine.shouldCompact(0)).toBe(false);
	});

	it("shouldCompact handles MAX_SAFE_INTEGER", () => {
		const engine = new UltraCompactEngine();
		expect(engine.shouldCompact(Number.MAX_SAFE_INTEGER)).toBe(true);
	});

	it("calculateKeepTokens handles zero currentTokens", () => {
		const engine = new UltraCompactEngine();
		expect(engine.calculateKeepTokens(0)).toBe(0);
	});

	it("calculateKeepTokens handles negative currentTokens", () => {
		const engine = new UltraCompactEngine();
		expect(engine.calculateKeepTokens(-100)).toBeLessThanOrEqual(0);
	});

	it("calculateKeepTokens handles extreme keepPercentage", () => {
		const engine = new UltraCompactEngine({
			keepPercentage: 2.0, maxKeepTokens: 100000,
		});
		expect(engine.calculateKeepTokens(100)).toBe(200);
	});

	it("calculateKeepTokens handles zero keepPercentage", () => {
		const engine = new UltraCompactEngine({
			keepPercentage: 0, maxKeepTokens: 100000,
		});
		expect(engine.calculateKeepTokens(100)).toBe(0);
	});

	it("determineTier with zero context window returns NONE", () => {
		const engine = new UltraCompactEngine({ contextWindow: 0 });
		expect(engine.determineTier([makeMsg("1", "user", "Hello")]))
			.toBe(CompactionTier.NONE);
	});

	it("determineTier with very large context window returns NONE", () => {
		const engine = new UltraCompactEngine({ contextWindow: 10000000 });
		expect(engine.determineTier([makeMsg("1", "user", "Hello")]))
			.toBe(CompactionTier.NONE);
	});
});

// ─── Constructor Edge Cases ───────────────────────────────────────

describe("constructor edge cases", () => {
	it("handles extreme zero config values", () => {
		const engine = new UltraCompactEngine({
			thresholdTokens: 0, keepPercentage: 0, maxKeepTokens: 0,
			minMessagesForCompression: 0, preemptiveWatermark: 0,
			hardWatermark: 0, outputHeadroom: 0,
			circuitBreakerMaxFailures: 0, circuitBreakerCooldown: 0,
			cacheAware: true, useLLM: true,
		});
		expect(engine).toBeDefined();
		expect(engine.getContextWindow()).toBe(128000);
	});

	it("handles all config values at maximum", () => {
		const engine = new UltraCompactEngine({
			thresholdTokens: Number.MAX_SAFE_INTEGER,
			keepPercentage: 1.0, maxKeepTokens: Number.MAX_SAFE_INTEGER,
			preemptiveWatermark: 1.0, hardWatermark: 1.0,
		});
		expect(engine).toBeDefined();
	});

	it("handles negative config values", () => {
		const engine = new UltraCompactEngine({
			thresholdTokens: -1000, keepPercentage: -0.5,
			maxKeepTokens: -100, preemptiveWatermark: -1, hardWatermark: -1,
		});
		expect(engine.shouldCompactDefaultThreshold()).toBeDefined();
	});

	it("handles empty model name string", () => {
		const engine = new UltraCompactEngine({ modelName: "" });
		expect(engine.getContextWindow()).toBe(128000);
	});
});

// ─── Reconfigure Edge Cases ───────────────────────────────────────

describe("reconfigure edge cases", () => {
	it("does nothing when called with no arguments", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const before = engine.getContextWindow();
		engine.reconfigure(undefined, undefined);
		expect(engine.getContextWindow()).toBe(before);
	});

	it("handles empty string model name", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		engine.reconfigure("");
		expect(engine.getContextWindow()).toBe(128000);
	});

	it("handles zero context window", () => {
		const engine = new UltraCompactEngine();
		engine.reconfigure("gpt-4o", 0);
		expect(engine.getContextWindow()).toBe(0);
	});

	it("handles extremely large context window", () => {
		const engine = new UltraCompactEngine();
		engine.reconfigure("gpt-4o", 10000000);
		expect(engine.getContextWindow()).toBe(10000000);
	});
});

// ─── Empty String Content Edge Cases ──────────────────────────────

describe("empty string content edge cases", () => {
	it("preprocessMessages removes empty content messages", async () => {
		const engine = new UltraCompactEngine();
		const msgs = [
			makeMsg("1", "user", ""),
			makeMsg("2", "user", "GOAL: Actual content"),
			makeMsg("3", "user", "   "),
		];
		const result = await engine.generateSummary(msgs);
		expect(result.summary).toContain("Actual content");
	});

	it("handles all messages being empty after preprocessing", async () => {
		const engine = new UltraCompactEngine();
		const msgs = [
			makeMsg("1", "user", ""),
			makeMsg("2", "user", "   "),
			makeMsg("3", "assistant", ""),
		];
		const result = await engine.generateSummary(msgs);
		// tokensBefore counts original msgs; whitespace has len>0
		expect(result.tokensBefore).toBeGreaterThan(0);
		expect(result.tokensAfter).toBe(0);
		expect(result.summary).toBe("");
	});

	it("whitespace-only content in extractCriticalInfo is compressible", () => {
		const engine = new UltraCompactEngine();
		const msgs = [makeMsg("1", "user", "   ")];
		const result = engine.extractCriticalInfo(msgs);
		expect(result.compressible.length).toBe(1);
	});
});
