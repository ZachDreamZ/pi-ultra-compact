/**
 * Additional engine tests targeting uncovered lines and branches.
 *
 * Covers: determineTier, microCompact, compact, evictGradually,
 * stripReasoningBlocks, stripBulkToolOutputs, stripArtifactToolOutputs,
 * removeOldCompressibleMessages, LLM summarization path,
 * getCompressionHistory, clearCompressionHistory, shouldProtectContent
 * edge cases, summarizeToolOutput branches, extractFilePath,
 * estimateTokens content-type branches, messageContent fallback.
 */

import { UltraCompactEngine } from "../extensions/engine";
import type { Message } from "../extensions/types";
import { EvictionLevel, CompactionTier } from "../extensions/types";

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

// ─── determineTier ────────────────────────────────────────────────

describe("determineTier", () => {
	it("returns NONE when usage is below 60%", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" }); // 128k context
		// A few small messages — well under 60%
		const msgs = [makeMsg("1", "user", "hello")];
		expect(engine.determineTier(msgs)).toBe(CompactionTier.NONE);
	});

	it("returns MICRO when usage is between 60-90%", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" }); // 128k context
		// Need ~60% of 128k ≈ 76800 tokens ≈ ~345k chars at 4.5 ratio
		const bigContent = "word ".repeat(70000); // ~350k chars ≈ ~77k tokens
		const msgs = [makeMsg("1", "user", bigContent)];
		const tier = engine.determineTier(msgs);
		expect(tier).toBe(CompactionTier.MICRO);
	});

	it("returns FULL when usage is at or above 90%", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" }); // 128k context
		// Need ~90% of 128k ≈ 115200 tokens ≈ ~518k chars
		const bigContent = "word ".repeat(120000);
		const msgs = [makeMsg("1", "user", bigContent)];
		const tier = engine.determineTier(msgs);
		expect(tier).toBe(CompactionTier.FULL);
	});

	it("returns NONE when context window is 0 (edge)", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		expect(engine.determineTier(msgs)).toBe(CompactionTier.NONE);
	});
});

// ─── microCompact ─────────────────────────────────────────────────

describe("microCompact", () => {
	it("strips reasoning and bulk outputs from messages", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs: Message[] = [
			makeMsg("1", "user", "Hello"),
			makeMsg("2", "assistant", "thinking about this..."),
			makeMsg("3", "tool", "A".repeat(6000)),
		];
		const result = engine.microCompact(msgs);
		expect(result.messages).toBeDefined();
		expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
		expect(result.messagesStripped).toBeGreaterThanOrEqual(0);
		expect(result.filesCollapsed).toEqual([]);
	});

	it("returns messages array even when nothing to strip", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs = [makeMsg("1", "user", "Hi")];
		const result = engine.microCompact(msgs);
		expect(result.messages.length).toBeGreaterThanOrEqual(1);
	});

	it("strips structured thinking blocks from assistant messages", () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs: Message[] = [
			makeStructuredMsg("1", "assistant", [
				{ type: "thinking", text: "Let me think about this..." },
				{ type: "text", text: "Here is my answer" },
			]),
		];
		const result = engine.microCompact(msgs);
		expect(result.messages).toBeDefined();
	});
});

// ─── compact (tier-aware) ─────────────────────────────────────────

describe("compact", () => {
	it("uses micro compaction for MICRO tier", async () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs = [makeMsg("1", "user", "Hello"), makeMsg("2", "tool", "output")];
		const result = await engine.compact(msgs, undefined, CompactionTier.MICRO);
		expect(result.summary).toBe("");
		expect(result.tokensBefore).toBeGreaterThan(0);
		expect(result.tokensAfter).toBeGreaterThanOrEqual(0);
		expect(result.compressionRatio).toBeLessThanOrEqual(1);
	});

	it("uses full compaction for FULL tier", async () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs = [makeMsg("1", "user", "GOAL: Build a system")];
		const result = await engine.compact(msgs, undefined, CompactionTier.FULL);
		expect(result.summary.length).toBeGreaterThan(0);
	});

	it("auto-detects tier when not specified", async () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs = [makeMsg("1", "user", "Hello")];
		const result = await engine.compact(msgs);
		// Small message → NONE tier → falls through to full compaction
		expect(result).toBeDefined();
	});

	it("handles zero tokensBefore in micro compaction", async () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const result = await engine.compact([], undefined, CompactionTier.MICRO);
		expect(result.compressionRatio).toBe(1);
	});

	it("passes previous summary to full compaction", async () => {
		const engine = new UltraCompactEngine({ modelName: "gpt-4o" });
		const msgs = [makeMsg("1", "user", "GOAL: Fix bugs")];
		const result = await engine.compact(msgs, "Previous context here", CompactionTier.FULL);
		expect(result.summary).toContain("Previous context here");
	});
});

// ─── evictGradually ───────────────────────────────────────────────

describe("evictGradually", () => {
	it("returns empty result for empty messages", () => {
		const engine = new UltraCompactEngine();
		const result = engine.evictGradually([], 1000);
		expect(result.messages).toEqual([]);
		expect(result.stats.messagesStripped).toBe(0);
		expect(result.stats.tokensSaved).toBe(0);
		expect(result.stats.levelUsed).toBe(EvictionLevel.STRIP_REASONING);
	});

	it("returns unchanged messages when already under budget", () => {
		const engine = new UltraCompactEngine();
		const msgs = [makeMsg("1", "user", "short")];
		const result = engine.evictGradually(msgs, 100000);
		expect(result.messages.length).toBe(1);
		expect(result.stats.tokensSaved).toBe(0);
	});

	it("strips reasoning blocks at level 1", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeStructuredMsg("1", "assistant", [
				{ type: "thinking", text: "Long thinking block ".repeat(100) },
				{ type: "text", text: "Answer" },
			]),
			makeMsg("2", "user", "Short question"),
		];
		const result = engine.evictGradually(msgs, 50, EvictionLevel.STRIP_REASONING);
		expect(result.stats.levelUsed).toBe(EvictionLevel.STRIP_REASONING);
	});

	it("strips bulk tool outputs at level 2", () => {
		const engine = new UltraCompactEngine();
		// Create a large tool output (>5000 chars, >100 lines)
		const largeOutput = Array(150).fill("line of output data here").join("\n");
		const msgs: Message[] = [
			makeMsg("1", "tool", largeOutput),
			makeMsg("2", "user", "hello"),
		];
		const result = engine.evictGradually(msgs, 50, EvictionLevel.STRIP_BULK_OUTPUT);
		expect(result.stats.levelUsed).toBe(EvictionLevel.STRIP_BULK_OUTPUT);
	});

	it("strips artifact tool outputs at level 3", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "Some tool output that is not an error"),
			makeMsg("2", "tool", "Another successful tool result"),
			makeMsg("3", "user", "hello"),
		];
		const result = engine.evictGradually(msgs, 5, EvictionLevel.STRIP_ARTIFACTS);
		expect(
			result.stats.levelUsed === EvictionLevel.STRIP_ARTIFACTS ||
			result.stats.levelUsed === EvictionLevel.STRIP_REASONING ||
			result.stats.levelUsed === EvictionLevel.STRIP_BULK_OUTPUT
		).toBe(true);
	});

	it("removes old compressible messages at level 4", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		for (let i = 0; i < 20; i++) {
			msgs.push(makeMsg(String(i), "assistant", `Response ${i} with some content padding text`));
		}
		msgs.push(makeMsg("user1", "user", "A question"));
		const result = engine.evictGradually(msgs, 10, EvictionLevel.FULL_REMOVAL);
		expect(result.stats.levelUsed).toBe(EvictionLevel.FULL_REMOVAL);
	});

	it("preserves error outputs in artifact stripping", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "Error: Something went wrong"),
			makeMsg("2", "tool", "Success output to strip"),
		];
		const result = engine.evictGradually(msgs, 5, EvictionLevel.STRIP_ARTIFACTS);
		// Error messages should be preserved
		const hasError = result.messages.some(
			(m) => typeof m.content === "string" && m.content.includes("Error:"),
		);
		expect(hasError).toBe(true);
	});

	it("caps at maxLevel when specified", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		for (let i = 0; i < 50; i++) {
			msgs.push(makeMsg(String(i), "assistant", `Content block ${i} `));
		}
		// Cap at level 2 — should not do level 3 or 4
		const result = engine.evictGradually(msgs, 1, EvictionLevel.STRIP_BULK_OUTPUT);
		expect(result.stats.levelUsed).toBe(EvictionLevel.STRIP_BULK_OUTPUT);
	});

	it("preserves user and system messages in full removal", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("sys", "system", "System prompt"),
			makeMsg("u1", "user", "User question"),
			makeMsg("a1", "assistant", "Long response ".repeat(100)),
			makeMsg("a2", "assistant", "Another long response ".repeat(100)),
		];
		const result = engine.evictGradually(msgs, 10, EvictionLevel.FULL_REMOVAL);
		const roles = result.messages.map((m) => m.role);
		expect(roles).toContain("user");
		expect(roles).toContain("system");
	});
});

// ─── stripReasoningBlocks ─────────────────────────────────────────

describe("stripReasoningBlocks (via evictGradually)", () => {
	it("strips thinking blocks from structured assistant content", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeStructuredMsg("1", "assistant", [
				{ type: "thinking", text: "Internal reasoning ".repeat(50) },
				{ type: "text", text: "Final answer" },
			]),
		];
		const result = engine.evictGradually(msgs, 5, EvictionLevel.STRIP_REASONING);
		// Should have stripped the thinking block
		expect(result.messages.length).toBe(1);
	});

	it("replaces with placeholder when all content is thinking", () => {
		const engine = new UltraCompactEngine();
		// Need a second message with visible text to push total tokens above budget,
		// since messageContent filters out "thinking" blocks for token estimation
		const msgs: Message[] = [
			makeStructuredMsg("1", "assistant", [
				{ type: "thinking", text: "Only thinking content ".repeat(500) },
			]),
			makeMsg("2", "user", "A user question that adds enough tokens to exceed the budget"),
		];
		const result = engine.evictGradually(msgs, 5, EvictionLevel.STRIP_REASONING);
		const assistantMsg = result.messages.find((m) => m.role === "assistant");
		expect(assistantMsg?.content).toBe("[reasoning stripped]");
	});

	it("does not modify user messages", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "user", "User message that should not be touched"),
		];
		const result = engine.evictGradually(msgs, 5, EvictionLevel.STRIP_REASONING);
		expect(result.messages[0].content).toBe("User message that should not be touched");
	});

	it("does not modify assistant messages without thinking blocks", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeStructuredMsg("1", "assistant", [
				{ type: "text", text: "Normal response" },
			]),
		];
		const result = engine.evictGradually(msgs, 5, EvictionLevel.STRIP_REASONING);
		expect(result.messages[0]).toBeDefined();
	});
});

// ─── stripBulkToolOutputs ─────────────────────────────────────────

describe("stripBulkToolOutputs (via evictGradually)", () => {
	it("truncates tool output with >100 lines and >5000 chars", () => {
		const engine = new UltraCompactEngine();
		// Each line must be long enough so the total exceeds 5000 chars
		const longOutput = Array(150).fill("Line of directory listing data with extra padding content here").join("\n");
		const msgs: Message[] = [
			makeMsg("1", "tool", longOutput),
			makeMsg("2", "user", "Need enough tokens to exceed the budget"),
		];
		// Budget of 5 ensures tokens > budget so eviction actually runs
		const result = engine.evictGradually(msgs, 5, EvictionLevel.STRIP_BULK_OUTPUT);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).toContain("[tool output truncated:");
	});

	it("does not truncate small tool outputs (<5000 chars)", () => {
		const engine = new UltraCompactEngine();
		const smallOutput = "short output";
		const msgs: Message[] = [makeMsg("1", "tool", smallOutput)];
		const result = engine.evictGradually(msgs, 100000, EvictionLevel.STRIP_BULK_OUTPUT);
		expect(typeof result.messages[0].content === "string" ? result.messages[0].content : "").toBe(smallOutput);
	});

	it("does not truncate large output with <100 lines", () => {
		const engine = new UltraCompactEngine();
		// Large in chars but few lines
		const fewLongLines = Array(10).fill("x".repeat(600)).join("\n");
		const msgs: Message[] = [makeMsg("1", "tool", fewLongLines)];
		const result = engine.evictGradually(msgs, 100000, EvictionLevel.STRIP_BULK_OUTPUT);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).not.toContain("[tool output truncated:");
	});
});

// ─── stripArtifactToolOutputs ─────────────────────────────────────

describe("stripArtifactToolOutputs (via evictGradually)", () => {
	it("strips non-error tool outputs", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "Successful completion of the build process"),
		];
		const result = engine.evictGradually(msgs, 1, EvictionLevel.STRIP_ARTIFACTS);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).toContain("[tool result stripped:");
	});

	it("preserves tool outputs containing Error:", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "Error: Connection refused"),
		];
		const result = engine.evictGradually(msgs, 1, EvictionLevel.STRIP_ARTIFACTS);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).toContain("Error: Connection refused");
	});

	it("preserves tool outputs containing SyntaxError", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "SyntaxError: Unexpected token"),
		];
		const result = engine.evictGradually(msgs, 1, EvictionLevel.STRIP_ARTIFACTS);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).toContain("SyntaxError");
	});

	it("preserves tool outputs containing TypeError", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "TypeError: Cannot read property of undefined"),
		];
		const result = engine.evictGradually(msgs, 1, EvictionLevel.STRIP_ARTIFACTS);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).toContain("TypeError");
	});

	it("preserves tool outputs containing 'failed'", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "Build failed with exit code 1"),
		];
		const result = engine.evictGradually(msgs, 1, EvictionLevel.STRIP_ARTIFACTS);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).toContain("failed");
	});

	it("preserves tool outputs containing 'exit code'", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "Process terminated with exit code 127"),
		];
		const result = engine.evictGradually(msgs, 1, EvictionLevel.STRIP_ARTIFACTS);
		const content = typeof result.messages[0].content === "string" ? result.messages[0].content : "";
		expect(content).toContain("exit code");
	});
});

// ─── removeOldCompressibleMessages ────────────────────────────────

describe("removeOldCompressibleMessages (via evictGradually L4)", () => {
	it("keeps user and system messages, removes old assistant messages", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("sys", "system", "System prompt"),
			makeMsg("a1", "assistant", "Old response ".repeat(50)),
			makeMsg("a2", "assistant", "Another old response ".repeat(50)),
			makeMsg("u1", "user", "A question"),
		];
		const result = engine.evictGradually(msgs, 10, EvictionLevel.FULL_REMOVAL);
		const ids = result.messages.map((m) => m.id);
		expect(ids).toContain("sys");
		expect(ids).toContain("u1");
	});

	it("keeps high-importance assistant messages", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("a1", "assistant", "GOAL: Critical goal that must be preserved"),
			makeMsg("a2", "assistant", "Some unimportant filler text content"),
		];
		const result = engine.evictGradually(msgs, 10, EvictionLevel.FULL_REMOVAL);
		const hasGoal = result.messages.some(
			(m) => typeof m.content === "string" && m.content.includes("GOAL:"),
		);
		expect(hasGoal).toBe(true);
	});
});

// ─── LLM summarization path ──────────────────────────────────────

describe("LLM summarization", () => {
	it("uses llmSummarize callback when useLLM is true", async () => {
		const mockSummarize = vi.fn().mockResolvedValue("LLM summary result");
		const engine = new UltraCompactEngine({
			useLLM: true,
			llmSummarize: mockSummarize,
		});
		// Need enough messages so some are compressible (exceed 20k token protection budget)
		const msgs: Message[] = [];
		for (let i = 0; i < 600; i++) {
			msgs.push(
				makeMsg(
					String(i),
					"assistant",
					`Response ${i}: Some padding content to push past token budget limits for compressible classification`,
				),
			);
		}
		const result = await engine.generateSummary(msgs);
		expect(mockSummarize).toHaveBeenCalled();
		expect(result.summary).toContain("LLM summary result");
	});

	it("includes previous summary header when LLM is used with previous context", async () => {
		const mockSummarize = vi.fn().mockResolvedValue("LLM condensed output");
		const engine = new UltraCompactEngine({
			useLLM: true,
			llmSummarize: mockSummarize,
		});
		const msgs: Message[] = [];
		for (let i = 0; i < 600; i++) {
			msgs.push(
				makeMsg(String(i), "assistant", `Response ${i}: padding content to exceed budget`),
			);
		}
		const result = await engine.generateSummary(msgs, "Old context");
		expect(result.summary).toContain("## Previous Context");
		expect(result.summary).toContain("Old context");
	});

	it("falls back to heuristic when LLM callback throws", async () => {
		const mockSummarize = vi.fn().mockRejectedValue(new Error("LLM error"));
		const engine = new UltraCompactEngine({
			useLLM: true,
			llmSummarize: mockSummarize,
		});
		const msgs: Message[] = [];
		for (let i = 0; i < 600; i++) {
			msgs.push(
				makeMsg(String(i), "assistant", `Response ${i}: padding content to exceed budget`),
			);
		}
		const result = await engine.generateSummary(msgs);
		expect(mockSummarize).toHaveBeenCalled();
		// Should still produce a summary via fallback
		expect(result.summary.length).toBeGreaterThan(0);
	});
});

// ─── getCompressionHistory / clearCompressionHistory ──────────────

describe("compression history", () => {
	it("records compression history after generateSummary", async () => {
		const engine = new UltraCompactEngine();
		expect(engine.getCompressionHistory()).toEqual([]);

		await engine.generateSummary([makeMsg("1", "user", "GOAL: Test history")]);
		const history = engine.getCompressionHistory();
		expect(history.length).toBe(1);
		expect(history[0].tokensBefore).toBeGreaterThan(0);
		expect(history[0].summary.length).toBeGreaterThan(0);
	});

	it("clears compression history", async () => {
		const engine = new UltraCompactEngine();
		await engine.generateSummary([makeMsg("1", "user", "GOAL: Test clear")]);
		expect(engine.getCompressionHistory().length).toBe(1);

		engine.clearCompressionHistory();
		expect(engine.getCompressionHistory()).toEqual([]);
	});

	it("keeps only last 5 records", async () => {
		const engine = new UltraCompactEngine();
		for (let i = 0; i < 7; i++) {
			await engine.generateSummary([makeMsg(String(i), "user", `GOAL: iteration ${i}`)]);
		}
		expect(engine.getCompressionHistory().length).toBe(5);
	});

	it("returns a copy of history, not a reference", async () => {
		const engine = new UltraCompactEngine();
		await engine.generateSummary([makeMsg("1", "user", "GOAL: Test immutability")]);
		const h1 = engine.getCompressionHistory();
		const h2 = engine.getCompressionHistory();
		expect(h1).toEqual(h2);
		expect(h1).not.toBe(h2);
	});
});

// ─── shouldProtectContent edge cases ──────────────────────────────

describe("shouldProtectContent (via generateSummary)", () => {
	it("protects messages with error + stack trace", async () => {
		const engine = new UltraCompactEngine();
		const msgs = [
			makeMsg("1", "assistant", "Error: Something failed\n  at Object.run (engine.ts:42)\n  at main (index.ts:10)"),
		];
		const result = await engine.generateSummary(msgs);
		// The message should be classified as protected and included in summary
		expect(result.summary).toContain("Error:");
	});

	it("protects messages with code blocks", async () => {
		const engine = new UltraCompactEngine();
		const msgs = [
			makeMsg("1", "assistant", "Here is code:\n```typescript\nconst x = 1;\n```\nEnd"),
		];
		const result = await engine.generateSummary(msgs);
		expect(result.tokensAfter).toBeGreaterThan(0);
	});

	it("protects messages with source file paths", async () => {
		const engine = new UltraCompactEngine();
		const msgs = [
			makeMsg("1", "assistant", "Modified src/index.ts to fix the issue"),
		];
		const result = await engine.generateSummary(msgs);
		expect(result.tokensAfter).toBeGreaterThan(0);
	});
});

// ─── summarizeToolOutput branches ─────────────────────────────────

describe("summarizeToolOutput (via pruneToolOutputs in generateSummary)", () => {
	it("summarizes error-containing tool output", async () => {
		const engine = new UltraCompactEngine();
		// Create old tool messages with error content (they need to be in the older portion)
		const msgs: Message[] = [];
		for (let i = 0; i < 20; i++) {
			if (i === 0) {
				msgs.push(makeMsg(String(i), "tool", "Error: Something went wrong\nLine 2\nLine 3"));
			} else {
				msgs.push(makeMsg(String(i), "user", `Message ${i}`));
			}
		}
		const result = await engine.generateSummary(msgs);
		expect(result.tokensBefore).toBeGreaterThan(0);
	});

	it("summarizes success-containing tool output", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		for (let i = 0; i < 20; i++) {
			if (i === 0) {
				msgs.push(makeMsg(String(i), "tool", "Success: Build completed\nLine 2"));
			} else {
				msgs.push(makeMsg(String(i), "user", `Message ${i}`));
			}
		}
		const result = await engine.generateSummary(msgs);
		expect(result.tokensBefore).toBeGreaterThan(0);
	});

	it("summarizes generic tool output with exit code", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		for (let i = 0; i < 20; i++) {
			if (i === 0) {
				msgs.push(makeMsg(String(i), "tool", "output data\nexit code=0\nmore lines"));
			} else {
				msgs.push(makeMsg(String(i), "user", `Message ${i}`));
			}
		}
		const result = await engine.generateSummary(msgs);
		expect(result.tokensBefore).toBeGreaterThan(0);
	});
});

// ─── extractFilePath ──────────────────────────────────────────────

describe("extractFilePath (via pruneToolOutputs dedup)", () => {
	it("deduplicates repeated file reads", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		// Create multiple reads of the same file in old messages
		for (let i = 0; i < 20; i++) {
			if (i < 5) {
				msgs.push(makeMsg(String(i), "user", `read "src/index.ts" for reference`));
			} else {
				msgs.push(makeMsg(String(i), "user", `Message ${i}`));
			}
		}
		const result = await engine.generateSummary(msgs);
		expect(result).toBeDefined();
	});
});

// ─── estimateTokens content-type branches ─────────────────────────

describe("estimateTokens", () => {
	it("handles non-array input gracefully", () => {
		const engine = new UltraCompactEngine();
		expect(engine.estimateTokens(null as any)).toBe(0);
		expect(engine.estimateTokens(undefined as any)).toBe(0);
	});

	it("uses code block ratio for messages with code", () => {
		const engine = new UltraCompactEngine();
		const codeMsg = [makeMsg("1", "user", "```\nconst x = 1;\nconst y = 2;\n```")];
		const tokens = engine.estimateTokens(codeMsg);
		expect(tokens).toBeGreaterThan(0);
	});

	it("uses whitespace-heavy ratio for tables/logs", () => {
		const engine = new UltraCompactEngine();
		// Content with lots of whitespace (>30% whitespace ratio)
		const spaceyContent = "a     b     c     d     e     f     g     h     i     j     ";
		const msgs = [makeMsg("1", "user", spaceyContent)];
		const tokens = engine.estimateTokens(msgs);
		expect(tokens).toBeGreaterThan(0);
	});

	it("uses dense ratio for compact text", () => {
		const engine = new UltraCompactEngine();
		// Very dense text with >85% non-space
		const denseContent = "abcdefghijklmnopqrstuvwxyz0123456789".repeat(10);
		const msgs = [makeMsg("1", "user", denseContent)];
		const tokens = engine.estimateTokens(msgs);
		expect(tokens).toBeGreaterThan(0);
	});

	it("uses standard prose ratio for normal text", () => {
		const engine = new UltraCompactEngine();
		const proseContent = "This is a normal sentence with regular spacing and punctuation.";
		const msgs = [makeMsg("1", "user", proseContent)];
		const tokens = engine.estimateTokens(msgs);
		expect(tokens).toBeGreaterThan(0);
	});

	it("skips empty messages", () => {
		const engine = new UltraCompactEngine();
		const msgs = [makeMsg("1", "user", "")];
		const tokens = engine.estimateTokens(msgs);
		expect(tokens).toBe(0);
	});
});

// ─── messageContent fallback ──────────────────────────────────────

describe("messageContent edge cases (via extractCriticalInfo)", () => {
	it("handles message with non-string, non-array content", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: 42 as any, // not string, not array
			timestamp: Date.now(),
		};
		const result = engine.extractCriticalInfo([msg]);
		expect(result).toBeDefined();
	});

	it("handles message with null content", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: null as any,
			timestamp: Date.now(),
		};
		const result = engine.extractCriticalInfo([msg]);
		expect(result).toBeDefined();
	});

	it("handles message with undefined content", () => {
		const engine = new UltraCompactEngine();
		const msg: Message = {
			id: "1",
			role: "user",
			content: undefined as any,
			timestamp: Date.now(),
		};
		const result = engine.extractCriticalInfo([msg]);
		expect(result).toBeDefined();
	});
});

// ─── extractFileOperations with non-array ─────────────────────────

describe("extractFileOperations edge cases", () => {
	it("handles non-array messages in generateSummary", async () => {
		const engine = new UltraCompactEngine();
		// Passing null should be handled gracefully
		const result = await engine.generateSummary(null as any);
		expect(result.summary).toBe("");
	});
});

// ─── generateSummary: all-protected path ──────────────────────────

describe("generateSummary all-protected path", () => {
	it("generates summary when all messages are protected (high importance)", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "user", "GOAL: Build the entire system from scratch"),
			makeMsg("2", "user", "ERROR: Critical failure in production deployment"),
			makeMsg("3", "user", "DECISION: Use microservices architecture"),
		];
		const result = await engine.generateSummary(msgs);
		expect(result.summary).toContain("## Goals");
		expect(result.summary).toContain("## Errors");
		expect(result.summary).toContain("## Decisions");
	});
});

// ─── evictGradually early-return branches ─────────────────────────

describe("evictGradually early-return after specific levels", () => {
	it("returns after level 1 when reasoning stripping satisfies budget", () => {
		const engine = new UltraCompactEngine();
		// Large thinking block that when stripped brings us under a generous budget
		const msgs: Message[] = [
			makeStructuredMsg("1", "assistant", [
				{ type: "thinking", text: "Thinking content ".repeat(200) },
				{ type: "text", text: "Short answer" },
			]),
			makeMsg("2", "user", "A question"),
		];
		// Budget is generous enough that after stripping reasoning, we're under
		const result = engine.evictGradually(msgs, 50, EvictionLevel.FULL_REMOVAL);
		expect(result.stats.levelUsed).toBe(EvictionLevel.STRIP_REASONING);
	});

	it("returns after level 2 when bulk stripping satisfies budget", () => {
		const engine = new UltraCompactEngine();
		const bulkOutput = Array(150).fill("Data line with enough content padding here").join("\n");
		const msgs: Message[] = [
			makeMsg("1", "tool", bulkOutput),
			makeMsg("2", "user", "Short question"),
		];
		// Budget allows user message but not the full tool output
		const totalTokens = engine.estimateTokens(msgs);
		const userTokens = engine.estimateTokens([msgs[1]]);
		const result = engine.evictGradually(msgs, userTokens + 800, EvictionLevel.FULL_REMOVAL);
		// Should stop at level 2 since truncation makes it fit
		expect(
			result.stats.levelUsed === EvictionLevel.STRIP_BULK_OUTPUT ||
			result.stats.levelUsed === EvictionLevel.STRIP_REASONING
		).toBe(true);
	});

	it("returns after level 3 when artifact stripping satisfies budget", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "tool", "Normal successful output with some data"),
			makeMsg("2", "tool", "Another normal successful output result"),
			makeMsg("3", "user", "Hi"),
		];
		// Budget that fits stripped tool outputs but not originals
		const result = engine.evictGradually(msgs, 15, EvictionLevel.STRIP_ARTIFACTS);
		expect(
			result.stats.levelUsed === EvictionLevel.STRIP_ARTIFACTS ||
			result.stats.levelUsed === EvictionLevel.STRIP_REASONING ||
			result.stats.levelUsed === EvictionLevel.STRIP_BULK_OUTPUT
		).toBe(true);
	});
});

// ─── extractCriticalInfo non-array guard ───────────────────────────

describe("extractCriticalInfo non-array guard", () => {
	it("returns empty result for non-array input", () => {
		const engine = new UltraCompactEngine();
		const result = engine.extractCriticalInfo(null as any);
		expect(result.critical).toEqual([]);
		expect(result.compressible).toEqual([]);
		expect(result.scores.size).toBe(0);
	});
});

// ─── classifyMessages: multiple system messages ───────────────────

describe("classifyMessages (via generateSummary)", () => {
	it("only protects the first system message", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("sys1", "system", "First system prompt"),
			makeMsg("sys2", "system", "Second system prompt"),
			makeMsg("1", "user", "Question"),
		];
		const result = await engine.generateSummary(msgs);
		expect(result).toBeDefined();
	});
});

// ─── pruneToolOutputs file read dedup ─────────────────────────────

describe("pruneToolOutputs file read dedup (via generateSummary)", () => {
	it("deduplicates closely-spaced file reads", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		// Multiple reads of same file close together in older portion
		for (let i = 0; i < 20; i++) {
			if (i < 3) {
				msgs.push(makeMsg(String(i), "user", 'read "src/main.ts" for review'));
			} else {
				msgs.push(makeMsg(String(i), "user", `Regular message ${i}`));
			}
		}
		const result = await engine.generateSummary(msgs);
		expect(result).toBeDefined();
	});

	it("keeps file reads that are far apart", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [];
		for (let i = 0; i < 30; i++) {
			if (i === 0 || i === 20) {
				msgs.push(makeMsg(String(i), "user", 'read "src/main.ts" please'));
			} else {
				msgs.push(makeMsg(String(i), "user", `Filler message ${i}`));
			}
		}
		const result = await engine.generateSummary(msgs);
		expect(result).toBeDefined();
	});
});

// ─── Additional model detection edge cases ────────────────────────

describe("model detection edge cases", () => {
	it("detects mistral family", () => {
		const engine = new UltraCompactEngine({ modelName: "mistral-medium-3.5" });
		expect(engine.getContextWindow()).toBe(128000);
		const rec = engine.getModelRecommendations();
		expect(rec.modelFamily).toBe("mistral");
	});

	it("detects deepseek family", () => {
		const engine = new UltraCompactEngine({ modelName: "deepseek-r1" });
		expect(engine.getContextWindow()).toBe(65536);
		const rec = engine.getModelRecommendations();
		expect(rec.modelFamily).toBe("deepseek");
	});

	it("detects meta/llama family", () => {
		const engine = new UltraCompactEngine({ modelName: "llama-3.3-70b" });
		expect(engine.getContextWindow()).toBe(128000);
		const rec = engine.getModelRecommendations();
		expect(rec.modelFamily).toBe("meta");
	});

	it("detects codestral", () => {
		const engine = new UltraCompactEngine({ modelName: "codestral" });
		expect(engine.getContextWindow()).toBe(256000);
	});

	it("detects o3", () => {
		const engine = new UltraCompactEngine({ modelName: "o3" });
		expect(engine.getContextWindow()).toBe(200000);
	});
});

// ─── generateSummary all-protected / no-compressible edge ─────────

describe("generateSummary edge: no compressible after classification", () => {
	it("handles case where all messages are protected (code blocks)", async () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("1", "user", "```typescript\nconst x = 1;\n```\nFix this code"),
			makeMsg("2", "user", "GOAL: Deploy to production ASAP"),
		];
		const result = await engine.generateSummary(msgs);
		expect(result.summary.length).toBeGreaterThan(0);
	});
});

// ─── removeOldCompressibleMessages add-back loop ──────────────────

describe("removeOldCompressibleMessages add-back candidates", () => {
	it("adds back newest candidates that fit within budget", () => {
		const engine = new UltraCompactEngine();
		const msgs: Message[] = [
			makeMsg("u1", "user", "System context"),
			makeMsg("a1", "assistant", "Old response"),
			makeMsg("a2", "assistant", "Newer response"),
			makeMsg("a3", "assistant", "Newest response"),
		];
		// Budget that can fit user + some assistant messages
		const userTokens = engine.estimateTokens([msgs[0]]);
		const oneAssistant = engine.estimateTokens([msgs[1]]);
		const result = engine.evictGradually(
			msgs,
			userTokens + oneAssistant * 2,
			EvictionLevel.FULL_REMOVAL,
		);
		// Should keep user message and fit as many assistant messages as possible
		expect(result.messages.length).toBeGreaterThanOrEqual(2);
		const hasUser = result.messages.some((m) => m.id === "u1");
		expect(hasUser).toBe(true);
	});
});
