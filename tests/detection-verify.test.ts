import { UltraCompactEngine } from "../extensions/engine";

describe("improved model detection", () => {
	const cases: [string, string, number][] = [
		// [modelId, expectedFamily, expectedContextWindow]
		["deepseek-v4-flash-free", "deepseek", 200000],
		["claude-sonnet-4", "anthropic", 200000],
		["claude-opus-4-5", "anthropic", 200000],
		["claude-opus-4-7", "anthropic", 1000000],
		["gpt-5.1-codex", "openai", 400000],
		["qwen3.6-plus-free", "alibaba", 262100],
		["kimi-k2.5", "moonshot", 262100],
		["minimax-m2.7", "minimax", 204800],
		["glm-5.1", "zhipu", 204800],
		["grok-build-0.1", "xai", 256000],
		["nemotron-3-super-free", "nvidia", 204800],
		["big-pickle", "opencode", 200000],
		["gemini-3.5-flash", "google", 1000000],
		["mimo-v2.5-pro", "xiaomi", 1000000],
		["gpt-5.4-pro", "openai", 1100000],
		["opencode/claude-sonnet-4-6", "anthropic", 1000000],
	];

	it.each(cases)(
		"detects %s as family=%s context=%d",
		(modelId, expectedFamily, expectedContext) => {
			const engine = new UltraCompactEngine({ modelName: modelId });
			const recs = engine.getModelRecommendations();
			expect(recs.modelFamily).toBe(expectedFamily);
			expect(recs.contextWindow).toBe(expectedContext);
		},
	);

	it("uses runtime contextWindow when provided via reconfigure", () => {
		const engine = new UltraCompactEngine({ modelName: "some-unknown-model" });
		expect(engine.getContextWindow()).toBe(128000); // default

		engine.reconfigure("some-unknown-model", 500000);
		expect(engine.getContextWindow()).toBe(500000); // uses runtime value
	});
});
