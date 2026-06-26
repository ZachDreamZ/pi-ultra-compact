/**
 * Fuzz tests for UltraCompactEngine (ROADMAP 3.2)
 *
 * Uses random message patterns to uncover edge cases in
 * compaction, eviction, and summarization logic.
 *
 * Run: npx vitest run tests/fuzz.test.ts
 * For stress: increase ITERATIONS below (default: 100 for CI safety)
 */

import { UltraCompactEngine } from "../extensions/engine";
import type { Message } from "../extensions/types";
import { EvictionLevel } from "../extensions/types";

const ITERATIONS = 100;

function makeMsg(id: string, role: string, content: string): Message {
	return { id, role: role as any, content, timestamp: Date.now() };
}

const ROLES = ["user", "assistant", "tool", "system"] as const;
const KEYWORDS = [
	"GOAL: ", "DECISION: ", "ERROR: ", "SOLUTION: ",
	"TODO: ", "NEXT: ", "DISCOVERED: ", "CONSTRAINT: ",
];
const TOOL_OUTPUTS = [
	"Error: something failed",
	"Success: build completed",
	"exit code = 0",
	"ls -la output here",
	"cat package.json",
	"npm test passed",
	"SyntaxError: unexpected token",
	"TypeError: undefined is not a function",
];

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomContent(): string {
	const r = Math.random();
	if (r < 0.2) return ""; // empty
	if (r < 0.3) return "   "; // whitespace-only
	if (r < 0.4) return "A".repeat(randomInt(1, 10000)); // repetitive
	if (r < 0.5) {
		const kw = KEYWORDS[randomInt(0, KEYWORDS.length - 1)];
		return kw + "Random content " + Math.random().toString(36).slice(2);
	}
	if (r < 0.6) return TOOL_OUTPUTS[randomInt(0, TOOL_OUTPUTS.length - 1)];
	if (r < 0.7) return "```\nconst x = " + randomInt(1, 1000) + ";\n```";
	if (r < 0.8) {
		return Array(randomInt(2, 50))
			.fill("line")
			.map((_, i) => "Line " + i + ": " + Math.random().toString(36).slice(2, 10))
			.join("\n");
	}
	return "Message " + Math.random().toString(36).slice(2, 10);
}

function randomMessages(count: number): Message[] {
	const msgs: Message[] = [];
	for (let i = 0; i < count; i++) {
		const role = ROLES[randomInt(0, ROLES.length - 1)];
		msgs.push(makeMsg("fuzz-" + i, role, randomContent()));
	}
	return msgs;
}

describe("fuzz tests", () => {
	it("random message patterns do not crash estimateTokens", () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < ITERATIONS; i++) {
			const msgs = randomMessages(randomInt(0, 500));
			expect(() => engine.estimateTokens(msgs)).not.toThrow();
		}
	});

	it("random message patterns do not crash extractCriticalInfo", () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < ITERATIONS; i++) {
			const msgs = randomMessages(randomInt(0, 200));
			expect(() => engine.extractCriticalInfo(msgs)).not.toThrow();
		}
	});

	it("random message patterns do not crash evictGradually", () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < ITERATIONS; i++) {
			const msgs = randomMessages(randomInt(0, 100));
			const budget = randomInt(0, 100000);
			const level = randomInt(1, 4) as EvictionLevel;
			expect(() => engine.evictGradually(msgs, budget, level)).not.toThrow();
		}
	});

	it("random message patterns do not crash determineTier", () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < ITERATIONS; i++) {
			const msgs = randomMessages(randomInt(0, 100));
			expect(() => engine.determineTier(msgs)).not.toThrow();
		}
	});

	it("random message patterns do not crash microCompact", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		for (let i = 0; i < ITERATIONS; i++) {
			const msgs = randomMessages(randomInt(0, 50));
			expect(() => engine.microCompact(msgs)).not.toThrow();
		}
	});

	it("random message patterns do not crash generateSummary", async () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < 10; i++) { // fewer iterations for async
			const msgs = randomMessages(randomInt(0, 50));
			const prev = Math.random() > 0.5 ? "Previous summary context" : undefined;
			await expect(
				engine.generateSummary(msgs, prev),
			).resolves.not.toThrow();
		}
	}, 30000);

	it("random message patterns do not crash compact", async () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		for (let i = 0; i < 10; i++) {
			const msgs = randomMessages(randomInt(0, 50));
			await expect(engine.compact(msgs)).resolves.not.toThrow();
		}
	}, 30000);

	it("fuzz with mixed structured content blocks", () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < ITERATIONS; i++) {
			const blockCount = randomInt(0, 20);
			const blocks: { type: string; text?: string }[] = [];
			for (let j = 0; j < blockCount; j++) {
				if (Math.random() > 0.3) {
					blocks.push({ type: "text", text: randomContent() });
				} else {
					blocks.push({ type: "image" } as any);
				}
			}
			const msg = {
				id: "fuzz-block-" + i,
				role: "assistant",
				content: blocks as any,
				timestamp: Date.now(),
			} as Message;
			expect(() => engine.estimateTokens([msg])).not.toThrow();
		}
	});

	it("fuzz: all empty messages + whitespace in combination", () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < ITERATIONS; i++) {
			const msgs: Message[] = [];
			const count = randomInt(0, 5);
			for (let j = 0; j < count; j++) {
				const content = Math.random() > 0.5 ? "" : "   ";
				msgs.push(makeMsg("empty-" + j, "user", content));
			}
			expect(() => engine.estimateTokens(msgs)).not.toThrow();
			const result = engine.extractCriticalInfo(msgs);
			expect(result.scores.size).toBe(count);
		}
	});

	it("fuzz: messages with only single characters", () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < ITERATIONS; i++) {
			const msgs: Message[] = [];
			const count = randomInt(0, 100);
			for (let j = 0; j < count; j++) {
				msgs.push(makeMsg("sc-" + j, "user",
					String.fromCharCode(randomInt(32, 126))));
			}
			expect(() => engine.estimateTokens(msgs)).not.toThrow();
		}
	});

	it("fuzz: extreme variations in message length", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		// Mix of very short and very long messages
		for (let i = 0; i < 50; i++) {
			if (i % 2 === 0) {
				msgs.push(makeMsg("short-" + i, "user", "x"));
			} else {
				msgs.push(makeMsg(
					"long-" + i,
					"user",
					"content ".repeat(randomInt(100, 500)),
				));
			}
		}
		expect(() => engine.estimateTokens(msgs)).not.toThrow();
		const result = engine.extractCriticalInfo(msgs);
		expect(result.scores.size).toBe(50);
	});
});
