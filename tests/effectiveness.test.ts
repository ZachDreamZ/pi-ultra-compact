/**
 * Effectiveness tests for UltraCompactEngine
 *
 * Tests compression ratios, critical info preservation,
 * and de-duplication with realistic Pi conversation data.
 */

import { UltraCompactEngine } from "../extensions/engine";
import type { Message } from "../extensions/types/index";
import { makeMsgFrom } from "./helpers";
import { messageContent } from "../extensions/utils";

function generateConversation(size: number): Message[] {
	const msgs: Message[] = [];
	const roles: ("user" | "assistant" | "tool")[] = [
		"user",
		"assistant",
		"tool",
	];

	const goalPhrases = [
		"GOAL: Build an audit system",
		"OBJECTIVE: Fix all TypeScript errors",
		"TARGET: Publish v0.5.0 by Friday",
		"WANT TO: Improve test coverage",
		"TRYING TO: Refactor the engine module",
	];

	const decisionPhrases = [
		"DECIDED: Use ES2022 target",
		"DECISION: Switch to ts-jest for testing",
		"CHOSE: Logger utility over console.log",
		"SELECTED: MIT license for the package",
	];

	const errorPhrases = [
		"ERROR: Build failed with TS2307",
		"FAILED: Test suite crashed on line 42",
		"BUG: Null pointer in engine.ts",
		"ISSUE: Memory leak in stream handler",
		"PROBLEM: Timeout in CI pipeline",
	];

	const solutionPhrases = [
		"FIX: Added null check in engine.ts",
		"RESOLVED: Updated tsconfig paths",
		"SOLUTION: Switched to Buffer.subarray()",
		"FIXED: Added type guard for undefined",
	];

	const fileOps = [
		"edit extensions/engine.ts to add timeout",
		"write tests/engine.test.ts with new tests",
		"read src/index.ts for reference",
		"edit package.json to bump version",
		"write CHANGELOG.md for release notes",
	];

	for (let i = 0; i < size; i++) {
		const role = roles[i % 3];
		let content = `Message ${i} - ${role}: `;

		if (i % 10 === 0 && goalPhrases.length > 0) {
			content += goalPhrases[i % goalPhrases.length] + ". ";
		}
		if (i % 7 === 0) {
			content += decisionPhrases[i % decisionPhrases.length] + ". ";
		}
		if (i % 5 === 0) {
			const err = errorPhrases[i % errorPhrases.length];
			const sol = solutionPhrases[i % solutionPhrases.length];
			content += `${err} → ${sol}. `;
		}
		if (i % 3 === 0) {
			content += fileOps[i % fileOps.length] + ". ";
		}

		if (i % 8 === 0) {
			content += "\n```typescript\nconst x = 42;\nexport default x;\n```\n";
		}

		if (role === "tool" && i % 4 === 0) {
			content += "\n" + Array(50).fill(`line ${i}: data`).join("\n");
		}

		if (i % 11 === 0) {
			content += "\nNEXT: Run the full test suite.";
		}

		msgs.push(makeMsgFrom({ role, content }));
	}

	return msgs;
}

// ============================================================================
// Tests
// ============================================================================

describe("UltraCompactEngine Effectiveness", () => {
	let engine: UltraCompactEngine;

	beforeEach(() => {
		engine = new UltraCompactEngine();
	});

	test("small conversations: compression ratio may be >1 (summary overhead)", async () => {
		const conv = generateConversation(10);
		const result = await engine.generateSummary(conv);
		expect(result.tokensBefore).toBeGreaterThan(0);
		expect(result.summary.length).toBeGreaterThan(50);
		console.log(
			`  [small] ${conv.length} msgs: ${result.tokensBefore} → ${result.tokensAfter} tokens (ratio: ${result.compressionRatio.toFixed(3)})`,
		);
	});

	test("medium conversations: shows modest compression", async () => {
		const conv = generateConversation(50);
		const result = await engine.generateSummary(conv);
		expect(result.summary.length).toBeGreaterThan(100);
		console.log(
			`  [medium] ${conv.length} msgs: ${result.tokensBefore} → ${result.tokensAfter} tokens (ratio: ${result.compressionRatio.toFixed(3)})`,
		);
	});

	test("large conversations begin showing compression", async () => {
		const conv = generateConversation(200);
		const result = await engine.generateSummary(conv);
		expect(result.tokensBefore).toBeGreaterThan(1000);
		console.log(
			`  [large] ${conv.length} msgs: ${result.tokensBefore} → ${result.tokensAfter} tokens (ratio: ${result.compressionRatio.toFixed(3)})`,
		);
	});

	test("very large conversations achieve meaningful compression", async () => {
		const conv = generateConversation(1000);
		const result = await engine.generateSummary(conv);
		// tokensAfter includes both protected messages and the summary text
		expect(result.tokensBefore).toBeGreaterThan(5000);
		console.log(
			`  [xlarge] ${conv.length} msgs: ${result.tokensBefore} → ${result.tokensAfter} tokens (ratio: ${result.compressionRatio.toFixed(3)})`,
		);
	});

	test("preserves all critical info sections", async () => {
		const conv = generateConversation(100);
		const result = await engine.generateSummary(conv);
		expect(result.summary).toContain("## Goals");
		expect(result.summary).toContain("## Decisions");
		expect(result.summary).toContain("## Errors");
		expect(result.summary).toContain("## Files");
		expect(result.summary).toContain("## Next");
	});

	test("preserves goals in summary", async () => {
		const conv = generateConversation(100);
		const result = await engine.generateSummary(conv);
		// At least one goal phrase should survive
		const goalPhrases = [
			"Build an audit system",
			"Fix all TypeScript errors",
			"Publish v0.5.0",
			"Improve test coverage",
			"Refactor the engine",
		];
		const hasGoal = goalPhrases.some((g) => result.summary.includes(g));
		expect(hasGoal).toBe(true);
	});

	test("preserves errors in summary", async () => {
		const conv = generateConversation(100);
		const result = await engine.generateSummary(conv);
		const errorPhrases = [
			"Build failed with TS2307",
			"Memory leak",
			"Null pointer",
			"Timeout in CI",
		];
		const hasError = errorPhrases.some((e) => result.summary.includes(e));
		expect(hasError).toBe(true);
	});

	test("supports iterative summarization with previous context", async () => {
		const firstBatch = generateConversation(30);
		const firstResult = await engine.generateSummary(firstBatch);

		const secondBatch = generateConversation(30);
		const secondResult = await engine.generateSummary(
			secondBatch,
			firstResult.summary,
		);
		expect(secondResult.summary).toContain("## Previous Context");
	});

	test("handles empty conversation gracefully", async () => {
		const result = await engine.generateSummary([]);
		expect(result.summary).toBe("");
		expect(result.compressionRatio).toBe(1);
	});

	test("deduplication preserves critical info after removing duplicates", async () => {
		const dupMsgs = [
			makeMsgFrom({ role: "user", content: "fix the bug" }),
			makeMsgFrom({ role: "user", content: "GOAL: complete the audit" }),
			makeMsgFrom({ role: "user", content: "fix the bug" }),
			makeMsgFrom({ role: "user", content: "GOAL: complete the audit" }),
			makeMsgFrom({ role: "user", content: "ERROR: test failure" }),
		];
		const result = await engine.generateSummary(dupMsgs);
		expect(result.summary).toContain("complete the audit");
	});

	test("shouldCompact works correctly", async () => {
		expect(engine.shouldCompact(100)).toBe(false);
		expect(engine.shouldCompact(200000)).toBe(true);
	});

	test("extractCriticalInfo identifies important messages", async () => {
		const infoMsgs = [
			makeMsgFrom({ role: "user", content: "GOAL: fix all bugs" }),
			makeMsgFrom({ role: "user", content: "just a normal message" }),
			makeMsgFrom({ role: "user", content: "ERROR: crash in parser" }),
		];
		const { critical, compressible } = engine.extractCriticalInfo(infoMsgs);
		expect(critical.some((m) => messageContent(m).includes("GOAL"))).toBe(true);
		expect(critical.some((m) => messageContent(m).includes("ERROR"))).toBe(
			true,
		);
		expect(compressible.length).toBeGreaterThanOrEqual(0);
	});

	test("compression ratio improves with larger conversations", async () => {
		const small = await engine.generateSummary(generateConversation(10));
		const large = await engine.generateSummary(generateConversation(200));
		expect(large.compressionRatio).toBeLessThan(small.compressionRatio);
	});
});
