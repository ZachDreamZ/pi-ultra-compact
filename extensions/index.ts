/**
 * pi-ultra-compact
 *
 * Advanced compaction extension for Pi with:
 * - /ultracompact command for manual compaction
 * - Automatic threshold-based compaction
 * - Hierarchical summarization
 * - Critical context preservation
 */

import { UltraCompactEngine } from "./engine";
import type { UltraCompactConfig } from "./types";

/** Track current model at runtime (updated by model_select event) */
let currentModel: { id?: string; contextWindow?: number } | undefined;

/** Default configuration — thresholdTokens omitted so engine auto-detects from model context window */
const DEFAULT_CONFIG: UltraCompactConfig = {
	keepPercentage: 0.3,
	maxKeepTokens: 30000,
	autoCompact: true,
};

/**
 * Attempt to extract model name from Pi context.
 * Tries multiple sources so model changes are reflected at runtime:
 * 1. pi.model (ExtensionAPI at init)
 * 2. currentModel (tracked via model_select event)
 * Falls back to undefined, letting the engine use a default context window.
 */
function getModelName(): string | undefined {
	return currentModel?.id || undefined;
}

/**
 * Reconfigure the engine to match the current model before a compaction operation.
 * Ensures the threshold adapts even if the user changed models mid-session.
 */
function reconfigureEngineForCurrentModel(engine: UltraCompactEngine): void {
	let modelId: string | undefined;
	if (currentModel?.id) {
		modelId = currentModel.id;
	}
	engine.reconfigure(modelId);
}

/**
 * Handle /ultracompact command — manual compaction request.
 * Triggers Pi's native compaction flow via ctx.compact().
 * Our session_before_compact hook intercepts and applies ultra-compact logic.
 */
function handleUltracompactCommand(
	engine: UltraCompactEngine,
): (_args: any, ctx: any) => void {
	return (_args: any, ctx: any) => {
		// Guard against missing ctx or ctx.compact
		if (typeof ctx?.compact !== "function") {
			console.warn(
				"[pi-ultra-compact] ctx.compact unavailable, cannot run /ultracompact",
			);
			return;
		}

		// Reconfigure engine to current model before compaction
		reconfigureEngineForCurrentModel(engine);

		if (typeof ctx.ui?.notify === "function") {
			ctx.ui.notify("Starting ultra-compact compaction...", "info");
		}

		// Use Pi's built-in compact() API with a marker so our
		// session_before_compact hook applies ultra-compact logic
		ctx.compact({
			customInstructions: "ultracompact",
			onComplete: () => {
				if (typeof ctx.ui?.notify === "function") {
					ctx.ui.notify("Ultra-compact compaction complete!", "success");
				}
			},
			onError: (error: Error) => {
				if (typeof ctx.ui?.notify === "function") {
					ctx.ui.notify(`Ultra-compact failed: ${error.message}`, "error");
				} else {
					console.error(
						"[pi-ultra-compact] Ultra-compact failed:",
						error.message,
					);
				}
			},
		});
	};
}

/**
 * Handle session_before_compact event — automatic compaction intercept.
 * Also fired when the /ultracompact command calls ctx.compact().
 */
function handleBeforeCompact(
	engine: UltraCompactEngine,
): (event: any, ctx: any) => Record<string, any> | undefined {
	return async (event: any, ctx: any) => {
		// Capture model from ctx at runtime for maximum accuracy.
		// handleBeforeCompact fires after model_select has already updated currentModel,
		// so the separate reconfigureEngineForCurrentModel() call was redundant.
		if (ctx?.model?.id && ctx.model.id !== currentModel?.id) {
			currentModel = {
				id: ctx.model.id,
				contextWindow: ctx.model.contextWindow,
			};
			engine.reconfigure(ctx.model.id);
		} else if (currentModel?.id) {
			// Ensure engine is configured for the current model
			engine.reconfigure(currentModel.id);
		}

		const preparation = event?.preparation;
		if (!preparation) {
			return undefined;
		}
		const currentTokens = preparation.tokensBefore;
		const isManual = event?.customInstructions === "ultracompact";

		// Skip threshold check for manual /ultracompact command
		if (!isManual && !engine.shouldCompact(currentTokens)) {
			return undefined;
		}

		if (typeof ctx.ui?.notify === "function") {
			ctx.ui.notify(
				`Ultra-compact threshold reached (${currentTokens.toLocaleString()} > ${engine.shouldCompactDefaultThreshold().toLocaleString()}), using advanced compaction...`,
				"info",
			);
		}

		try {
			const result = await engine.generateSummary(
				preparation.messagesToSummarize,
				preparation.previousSummary,
			);

			return {
				compaction: {
					summary: result.summary,
					firstKeptEntryId: preparation.firstKeptEntryId,
					tokensBefore: preparation.tokensBefore,
					details: {
						readFiles: result.readFiles,
						modifiedFiles: result.modifiedFiles,
						ultracompact: true,
						compressionRatio: result.compressionRatio,
					},
				},
			};
		} catch (error) {
			console.error(
				"[pi-ultra-compact] Auto-compaction failed, falling back to default:",
				error,
			);
			return undefined;
		}
	};
}

function logModelInfo(
	engine: UltraCompactEngine,
	config: UltraCompactConfig,
): void {
	const recommendations = engine.getModelRecommendations();
	console.log(
		`[pi-ultra-compact] Detected model family: ${recommendations.modelFamily}`,
	);
	console.log(
		`[pi-ultra-compact] Context window: ${recommendations.contextWindow.toLocaleString()} tokens`,
	);
	const threshold =
		config.thresholdTokens?.toLocaleString() ||
		Math.floor(recommendations.contextWindow * 0.8).toLocaleString();
	console.log(`[pi-ultra-compact] Auto-compact threshold: ${threshold} tokens`);
}

/**
 * Pi extension factory function
 */
export default function piUltraCompact(
	pi: any,
	config: UltraCompactConfig = {},
): void {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };

	// Capture model from pi at init-time BEFORE engine construction
	// so threshold auto-detection uses the correct context window from the start
	if (pi?.model) {
		currentModel = {
			id: pi.model,
			contextWindow: undefined,
		};
	}

	// Try to get model name from Pi context (init-time, updated at runtime via model_select)
	const modelName = getModelName();

	const engine = new UltraCompactEngine({
		...mergedConfig,
		modelName,
	});

	// Log model detection (now may show correct model at startup)
	logModelInfo(engine, mergedConfig);

	// Guard: ensure required Pi APIs are available
	if (typeof pi?.registerCommand !== "function") {
		console.error(
			"[pi-ultra-compact] pi.registerCommand is unavailable — extension cannot register commands",
		);
		return;
	}

	// Register /ultracompact command
	pi.registerCommand("ultracompact", {
		description:
			"Ultra-compact compaction with maximum compression while preserving critical context.",
		handler: handleUltracompactCommand(engine),
	});

	// Track model changes at runtime so compaction adapts when user switches models
	if (typeof pi.on === "function") {
		pi.on("model_select", (event: any, _ctx: any) => {
			if (event?.model) {
				currentModel = {
					id: event.model.id || event.model.name,
					contextWindow: event.model.contextWindow,
				};
				console.log(
					`[pi-ultra-compact] Model updated: ${currentModel.id} (${currentModel.contextWindow?.toLocaleString() ?? "unknown"} context)`,
				);
			}
		});
	}

	// Register automatic compaction hook (single handler)
	if (mergedConfig.autoCompact) {
		pi.on("session_before_compact", handleBeforeCompact(engine));
	}

	// Log initialization
	console.log("[pi-ultra-compact] Extension loaded");
	console.log(
		`  Threshold: ${engine.shouldCompactDefaultThreshold().toLocaleString()} tokens (model: ${engine.getContextWindow().toLocaleString()})`,
	);
	console.log(
		`  Keep percentage: ${(mergedConfig.keepPercentage ?? 0.3) * 100}%`,
	);
	console.log(
		`  Auto-compact: ${mergedConfig.autoCompact ? "enabled" : "disabled"}`,
	);
}

// Export engine for programmatic use
export { UltraCompactEngine } from "./engine";
export type { UltraCompactConfig, CompactionResult } from "./types";
