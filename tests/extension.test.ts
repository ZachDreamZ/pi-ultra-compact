import { describe, expect, it, vi } from "vitest";
import piUltraCompact from "../extensions/index";

function makeMessage() {
	return {
		id: "message-1",
		role: "user",
		content: "Keep this conversation intact.",
		timestamp: Date.now(),
	};
}

describe("piUltraCompact extension", () => {
	it("uses ctx.model.contextWindow instead of the generic fallback", async () => {
		const handlers = new Map<string, Function>();
		const fakePi = {
			registerCommand: vi.fn(),
			on(event: string, handler: Function) {
				handlers.set(event, handler);
			},
		};

		piUltraCompact(fakePi);

		await handlers.get("session_start")?.(
			{ reason: "startup" },
			{
				model: {
					id: "gpt-5.5",
					contextWindow: 272000,
				},
			},
		);

		const result = await handlers.get("session_before_compact")?.(
			{
				preparation: {
					tokensBefore: 100000,
					messagesToSummarize: [makeMessage()],
					firstKeptEntryId: "entry-1",
				},
			},
			{
				model: {
					id: "gpt-5.5",
					contextWindow: 272000,
				},
				ui: { notify: vi.fn() },
			},
		);

		expect(result).toBeUndefined();
	});

	it("does not write normal startup messages to stdout", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const handlers = new Map<string, Function>();
		const fakePi = {
			registerCommand: vi.fn(),
			on(event: string, handler: Function) {
				handlers.set(event, handler);
			},
		};

		try {
			piUltraCompact(fakePi);
			await handlers.get("session_start")?.(
				{ reason: "startup" },
				{
					model: {
						id: "gpt-5.5",
						contextWindow: 272000,
					},
				},
			);

			expect(log).not.toHaveBeenCalled();
			expect(warn).not.toHaveBeenCalled();
			expect(error).not.toHaveBeenCalled();
		} finally {
			log.mockRestore();
			warn.mockRestore();
			error.mockRestore();
		}
	});
});
