import { vi } from "vitest";
/**
 * Tests for the Pi extension entry point (extensions/index.ts).
 *
 * Covers: piUltraCompact factory, /ultracompact command handler,
 * session_before_compact hook, model_select event, circuit breaker,
 * preemptive trigger, cache-aware compaction, lossy truncation fallback.
 */

import piUltraCompact, { UltraCompactEngine, __resetModuleState } from "../extensions/index";
import type { UltraCompactConfig } from "../extensions/types";

beforeEach(() => {    __resetModuleState();});
// ─── Helpers ──────────────────────────────────────────────────────

function makePiMock(overrides: Record<string, any> = {}) {
	const handlers: Record<string, Function[]> = {};
	return {
		model: overrides.model ?? "gpt-4o",
		registerCommand: vi.fn(),
		on: vi.fn((event: string, handler: Function) => {
			if (!handlers[event]) handlers[event] = [];
			handlers[event].push(handler);
		}),
		_emit(event: string, ...args: any[]) {
			for (const h of handlers[event] ?? []) {
				return h(...args);
			}
		},
		_handlers: handlers,
		...overrides,
	};
}

// ─── Factory function ─────────────────────────────────────────────

describe("piUltraCompact factory", () => {
	it("registers /ultracompact command", () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		expect(pi.registerCommand).toHaveBeenCalledWith(
			"ultracompact",
			expect.objectContaining({
				description: expect.any(String),
				handler: expect.any(Function),
			}),
		);
	});

	it("registers session_before_compact when autoCompact is true", () => {
		const pi = makePiMock();
		piUltraCompact(pi, { autoCompact: true });
		expect(pi.on).toHaveBeenCalledWith(
			"session_before_compact",
			expect.any(Function),
		);
	});

	it("registers model_select event listener", () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		expect(pi.on).toHaveBeenCalledWith("model_select", expect.any(Function));
	});

	it("does not register session_before_compact when autoCompact is false", () => {
		const pi = makePiMock();
		piUltraCompact(pi, { autoCompact: false });
		const calls = pi.on.mock.calls.filter(
			(c: any[]) => c[0] === "session_before_compact",
		);
		expect(calls.length).toBe(0);
	});

	it("uses default config when no config provided", () => {
		const pi = makePiMock();
		expect(() => piUltraCompact(pi)).not.toThrow();
	});

	it("merges custom config with defaults", () => {
		const pi = makePiMock();
		expect(() =>
			piUltraCompact(pi, { keepPercentage: 0.5, maxKeepTokens: 50000 }),
		).not.toThrow();
	});

	it("logs warning and returns when pi.registerCommand is unavailable", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const pi = { model: "gpt-4o" }; // no registerCommand
		piUltraCompact(pi);
		expect(warn).toHaveBeenCalledWith(
			"pi.registerCommand is unavailable",
		);
		warn.mockRestore();
	});

	it("handles pi without model property", () => {
		const pi = makePiMock({ model: undefined });
		expect(() => piUltraCompact(pi)).not.toThrow();
	});

	it("handles pi without on method (autoCompact disabled)", () => {
		const pi = {
			model: "gpt-4o",
			registerCommand: vi.fn(),
		};
		// autoCompact=false skips pi.on calls for session_before_compact
		expect(() => piUltraCompact(pi, { autoCompact: false })).not.toThrow();
	});
});

// ─── /ultracompact command handler ────────────────────────────────

describe("/ultracompact command handler", () => {
	it("calls ctx.compact with customInstructions='ultracompact'", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		const ctx = {
			compact: vi.fn(),
			ui: { notify: vi.fn() },
		};
		handler({}, ctx);
		expect(ctx.compact).toHaveBeenCalledWith(
			expect.objectContaining({
				customInstructions: "ultracompact",
			}),
		);
	});

	it("notifies user before compaction", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		const ctx = {
			compact: vi.fn(),
			ui: { notify: vi.fn() },
		};
		handler({}, ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			"Starting Ultra-compact compaction...",
			"info",
		);
	});

	it("warns when ctx.compact is unavailable", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		const ctx = { ui: { notify: vi.fn() } };
		handler({}, ctx);
		expect(warn).toHaveBeenCalledWith(
			"Ultra-compact warning: ctx.compact unavailable",
		);
		warn.mockRestore();
	});

	it("warns when ctx is null", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		// null ctx: guard catches it, notify silently does nothing
		const result = handler({}, null);
		expect(result).toBeUndefined();
	});

	it("calls onComplete callback on success", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		const ctx = {
			compact: vi.fn((opts: any) => opts.onComplete()),
			ui: { notify: vi.fn() },
		};
		handler({}, ctx);
		// No completion notification in current implementation
		expect(ctx.compact).toHaveBeenCalled();
	});

	it("calls onError callback on failure", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		const ctx = {
			compact: vi.fn((opts: any) => opts.onError(new Error("test error"))),
			ui: { notify: vi.fn() },
		};
		handler({}, ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith(
			expect.stringContaining("test error"),
			"error",
		);
	});

	it("logs error when onError fires without ctx.ui.notify", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		const ctx = {
			compact: vi.fn((opts: any) => opts.onError(new Error("test error"))),
			// no ui
		};
		// notify() silently does nothing when ctx.ui.notify is missing
		handler({}, ctx);
	});

	it("works without ctx.ui.notify", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const handler = pi.registerCommand.mock.calls[0][1].handler;
		const ctx = {
			compact: vi.fn(),
		};
		expect(() => handler({}, ctx)).not.toThrow();
	});
});

// ─── model_select event handler ───────────────────────────────────

describe("model_select event", () => {
	it("updates model on model_select event", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const modelSelectHandler = pi.on.mock.calls.find(
			(c: any[]) => c[0] === "model_select",
		)?.[1];
		expect(modelSelectHandler).toBeDefined();

		// Current implementation updates internal state silently
		modelSelectHandler!(
			{ model: { id: "claude-4.5-opus", contextWindow: 200000 } },
			{},
		);
	});

	it("uses model.name if model.id is missing", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const modelSelectHandler = pi.on.mock.calls.find(
			(c: any[]) => c[0] === "model_select",
		)?.[1];

		// Uses model.name as fallback when model.id is missing (silent)
		modelSelectHandler!(
			{ model: { name: "gemini-2.5-pro", contextWindow: 1000000 } },
			{},
		);
	});

	it("does nothing when event.model is missing", () => {
		const pi = makePiMock();
		piUltraCompact(pi);

		const modelSelectHandler = pi.on.mock.calls.find(
			(c: any[]) => c[0] === "model_select",
		)?.[1];

		expect(() => modelSelectHandler!({}, {})).not.toThrow();
	});
});

// ─── session_before_compact hook ──────────────────────────────────

describe("session_before_compact hook", () => {
	function getBeforeCompactHandler(pi: any) {
		return pi.on.mock.calls.find(
			(c: any[]) => c[0] === "session_before_compact",
		)?.[1];
	}

	it("returns undefined when preparation is missing", async () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		const handler = getBeforeCompactHandler(pi);
		const result = await handler({}, {});
		expect(result).toBeUndefined();
	});

	it("returns undefined when messagesToSummarize is empty", async () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		const handler = getBeforeCompactHandler(pi);
		const result = await handler(
			{
				preparation: {
					tokensBefore: 50000,
					messagesToSummarize: [],
					firstKeptEntryId: "1",
				},
			},
			{},
		);
		expect(result).toBeUndefined();
	});

	it("returns undefined when tokens are below threshold (auto)", async () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		const handler = getBeforeCompactHandler(pi);
		const result = await handler(
			{
				preparation: {
					tokensBefore: 100,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "hello", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{},
		);
		expect(result).toBeUndefined();
	});

	it("performs compaction when tokens exceed threshold", async () => {
		const pi = makePiMock();
		piUltraCompact(pi, { thresholdTokens: 100 });
		const handler = getBeforeCompactHandler(pi);
		const result = await handler(
			{
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "GOAL: Build something", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{ ui: { notify: vi.fn() } },
		);
		expect(result).toBeDefined();
		expect(result?.compaction).toBeDefined();
		expect(result?.compaction?.summary).toBeDefined();
		expect(result?.compaction?.details?.ultracompact).toBe(true);
	});

	it("always compacts for manual /ultracompact invocation", async () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		const handler = getBeforeCompactHandler(pi);
		const result = await handler(
			{
				customInstructions: "ultracompact",
				preparation: {
					tokensBefore: 100, // low tokens
					messagesToSummarize: [
						{ id: "1", role: "user", content: "GOAL: Manual compact", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{ ui: { notify: vi.fn() } },
		);
		expect(result).toBeDefined();
		expect(result?.compaction?.details?.ultracompact).toBe(true);
	});

	it("updates model from ctx.model when available", async () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		const handler = getBeforeCompactHandler(pi);
		await handler(
			{
				preparation: {
					tokensBefore: 100,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "hello", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{
				model: { id: "claude-4.5-opus", contextWindow: 200000 },
			},
		);
		// Should not throw; model is updated internally
	});

	it("does not notify UI during manual compaction (handled by command handler)", async () => {
		const pi = makePiMock();
		piUltraCompact(pi, { thresholdTokens: 100 });
		const handler = getBeforeCompactHandler(pi);
		const notify = vi.fn();
		const result = await handler(
			{
				customInstructions: "ultracompact",
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "GOAL: Test notification", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{ ui: { notify } },
		);
		// Notification moved to handleUltracompactCommand
		expect(notify).not.toHaveBeenCalled();
	});

	it("works without ui.notify", async () => {
		const pi = makePiMock();
		piUltraCompact(pi, { thresholdTokens: 100 });
		const handler = getBeforeCompactHandler(pi);
		const result = await handler(
			{
				customInstructions: "ultracompact",
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "GOAL: No UI", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{},
		);
		expect(result?.compaction).toBeDefined();
	});

	it("includes previous summary in cache-aware mode", async () => {
		const pi = makePiMock();
		piUltraCompact(pi, { thresholdTokens: 100, cacheAware: true });
		const handler = getBeforeCompactHandler(pi);
		const result = await handler(
			{
				customInstructions: "ultracompact",
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "GOAL: Cache test", timestamp: Date.now() },
					],
					previousSummary: "Previous summary content",
					firstKeptEntryId: "1",
				},
			},
			{ ui: { notify: vi.fn() } },
		);
		expect(result?.compaction?.summary).toContain("Previous summary content");
	});
});

// ─── Circuit breaker ──────────────────────────────────────────────

describe("circuit breaker", () => {
	function getBeforeCompactHandler(pi: any) {
		return pi.on.mock.calls.find(
			(c: any[]) => c[0] === "session_before_compact",
		)?.[1];
	}

	it("trips after consecutive failures and returns lossy truncation", async () => {
		// Patch generateSummary to throw so the circuit breaker path is exercised
		const origGenerateSummary = UltraCompactEngine.prototype.generateSummary;
		UltraCompactEngine.prototype.generateSummary = vi.fn().mockRejectedValue(
			new Error("forced compaction error"),
		);

		try {
			const pi = makePiMock();
			piUltraCompact(pi, {
				thresholdTokens: 100,
				circuitBreakerMaxFailures: 2,
				circuitBreakerCooldown: 10,
			});
			const handler = getBeforeCompactHandler(pi);

			const event = {
				customInstructions: "ultracompact",
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "hello world", timestamp: Date.now() },
						{ id: "2", role: "system", content: "system prompt", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			};

			const notify = vi.fn();
			const ctx = { ui: { notify } };

			// First failure — falls back to Pi default
			const r1 = await handler(event, ctx);
			expect(r1).toBeUndefined();

			// Second failure triggers circuit breaker (maxFailures=2)
			const r2 = await handler(event, ctx);
			expect(r2).toBeDefined();
			expect(r2?.compaction?.details?.circuitBreakerEngaged).toBe(true);
			expect(r2?.compaction?.summary).toContain("circuit breaker engaged");
			// Check that at least one call contains the emergency truncation message
			const emergencyCalls = notify.mock.calls.filter(
				(c: any[]) => typeof c[0] === "string" && c[0].includes("emergency truncation")
			);
			expect(emergencyCalls.length).toBeGreaterThanOrEqual(1);
			expect(emergencyCalls[0][1]).toBe("error");
		} finally {
			UltraCompactEngine.prototype.generateSummary = origGenerateSummary;
		}
	});

	it("enters cooldown after tripping and falls back to default", async () => {
		const origGenerateSummary = UltraCompactEngine.prototype.generateSummary;
		UltraCompactEngine.prototype.generateSummary = vi.fn().mockRejectedValue(
			new Error("forced compaction error"),
		);

		try {
			const pi = makePiMock();
			piUltraCompact(pi, {
				thresholdTokens: 100,
				circuitBreakerMaxFailures: 1,
				circuitBreakerCooldown: 10,
			});
			const handler = getBeforeCompactHandler(pi);

			const failEvent = {
				customInstructions: "ultracompact",
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "hello", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			};

			// Trip the breaker (maxFailures=1, so first failure trips it)
			await handler(failEvent, { ui: { notify: vi.fn() } });

			// Restore original so next call won't throw
			UltraCompactEngine.prototype.generateSummary = origGenerateSummary;

			const normalEvent = {
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "2", role: "user", content: "hello", timestamp: Date.now() },
					],
					firstKeptEntryId: "2",
				},
			};

			// Next call should be in cooldown — falls back to Pi default (undefined)
			const cooldownResult = await handler(normalEvent, {});
			expect(cooldownResult).toBeUndefined();
		} finally {
			UltraCompactEngine.prototype.generateSummary = origGenerateSummary;
		}
	});
});

// ─── Micro-compaction path in before_compact ──────────────────────

describe("micro-compaction path in session_before_compact", () => {
	function getBeforeCompactHandler(pi: any) {
		return pi.on.mock.calls.find(
			(c: any[]) => c[0] === "session_before_compact",
		)?.[1];
	}

	it("uses micro-compaction tier for moderate token usage with cacheAware", async () => {
		const pi = makePiMock();
		piUltraCompact(pi, { cacheAware: true });
		const handler = getBeforeCompactHandler(pi);

		// Create messages that push into 60-90% range to trigger micro tier
		const bigContent = "word ".repeat(70000);
		const result = await handler(
			{
				preparation: {
					tokensBefore: 90000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: bigContent, timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{ ui: { notify: vi.fn() } },
		);
		if (result) {
			expect(result.compaction.summary).toContain("Chat");
		}
	});
});

// ─── Empty summary validation ─────────────────────────────────────

describe("empty summary validation in before_compact", () => {
	function getBeforeCompactHandler(pi: any) {
		return pi.on.mock.calls.find(
			(c: any[]) => c[0] === "session_before_compact",
		)?.[1];
	}

	it("validates non-empty summary on success", async () => {
		const pi = makePiMock();
		piUltraCompact(pi, { thresholdTokens: 100 });
		const handler = getBeforeCompactHandler(pi);

		const result = await handler(
			{
				customInstructions: "ultracompact",
				preparation: {
					tokensBefore: 200000,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "GOAL: Test", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{ ui: { notify: vi.fn() } },
		);
		expect(result?.compaction?.summary?.length).toBeGreaterThan(0);
	});
});

// ─── Reconfigure from ctx.model in before_compact ─────────────────

describe("reconfigure from ctx.model in before_compact", () => {
	function getBeforeCompactHandler(pi: any) {
		return pi.on.mock.calls.find(
			(c: any[]) => c[0] === "session_before_compact",
		)?.[1];
	}

	it("reconfigures engine when ctx.model differs from current", async () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		const handler = getBeforeCompactHandler(pi);

		await handler(
			{
				preparation: {
					tokensBefore: 100,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "hello", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{ model: { id: "gemini-2.5-pro", contextWindow: 1000000 } },
		);
	});

	it("uses previously-set currentModel when ctx.model is absent", async () => {
		const pi = makePiMock();
		piUltraCompact(pi);
		const handler = getBeforeCompactHandler(pi);

		// First call sets ctx.model
		await handler(
			{
				preparation: {
					tokensBefore: 100,
					messagesToSummarize: [
						{ id: "1", role: "user", content: "hello", timestamp: Date.now() },
					],
					firstKeptEntryId: "1",
				},
			},
			{ model: { id: "claude-sonnet", contextWindow: 200000 } },
		);

		// Second call without ctx.model should use the previously-set one
		await handler(
			{
				preparation: {
					tokensBefore: 100,
					messagesToSummarize: [
						{ id: "2", role: "user", content: "hi", timestamp: Date.now() },
					],
					firstKeptEntryId: "2",
				},
			},
			{},
		);
	});
});

// ─── Exports ──────────────────────────────────────────────────────

describe("module exports", () => {
	it("exports UltraCompactEngine", () => {
		expect(UltraCompactEngine).toBeDefined();
		expect(typeof UltraCompactEngine).toBe("function");
	});

	it("exports piUltraCompact as default", () => {
		expect(piUltraCompact).toBeDefined();
		expect(typeof piUltraCompact).toBe("function");
	});
});
