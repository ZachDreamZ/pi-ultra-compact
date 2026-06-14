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
import type { UltraCompactConfig, CompactionResult } from "./types";

/** Default configuration — thresholdTokens omitted so engine auto-detects from model context window */
const DEFAULT_CONFIG: UltraCompactConfig = {
	keepPercentage: 0.3,
	maxKeepTokens: 30000,
	autoCompact: true,
};

/**
 * Format compaction result for display
 */
function formatCompactionResult(result: CompactionResult): string {
	const lines: string[] = [];

	lines.push("=== Ultra-Compact Compaction Complete ===");
	lines.push("");
	lines.push("Summary:");
	lines.push(`  Tokens before: ${result.tokensBefore.toLocaleString()}`);
	lines.push(`  Tokens after: ~${result.tokensAfter.toLocaleString()}`);
	lines.push(
		`  Compression: ${((1 - result.compressionRatio) * 100).toFixed(1)}% reduction`,
	);
	lines.push("");

	if (result.readFiles.length > 0 || result.modifiedFiles.length > 0) {
		lines.push("File Operations:");
		if (result.readFiles.length > 0) {
			lines.push(`  Read: ${result.readFiles.length} files`);
		}
		if (result.modifiedFiles.length > 0) {
			lines.push(`  Modified: ${result.modifiedFiles.length} files`);
		}
		lines.push("");
	}

	lines.push("Summary Content:");
	lines.push("---");
	lines.push(result.summary);
	lines.push("---");

	return lines.join("\n");
}

/**
 * Attempt to extract model name from Pi context.
 * Falls back to undefined, letting the engine use a default context window.
 */
function getModelName(pi: any): string | undefined {
	return pi.model || undefined;
}

/**
 * Handle /ultracompact command — manual compaction request.
 */
function handleUltracompactCommand(
	engine: UltraCompactEngine,
	mergedConfig: UltraCompactConfig,
): (_args: any, ctx: any) => void {
	return (_args: any, ctx: any) => {
		if (!ctx.session) {
			ctx.ui.notify("Session not available for compaction.", "error");
			return;
		}

		ctx.ui.notify("Starting ultra-compact compaction...", "info");

		try {
			const messages = ctx.session.messages || [];

			if (messages.length === 0) {
				ctx.ui.notify("No messages to compact.", "warning");
				return;
			}

			const previousSummary = ctx.session.summary || undefined;
			const result = engine.generateSummary(messages, previousSummary);

			// Apply compaction via session API when available, fallback to direct mutation
			if (typeof ctx.session.applyCompaction === "function") {
				ctx.session.applyCompaction(result.summary);
			} else {
				ctx.session.summary = result.summary;
				const keepPercentage = mergedConfig.keepPercentage ?? 0.3;
				ctx.session.messages = messages.slice(
					-Math.ceil(messages.length * keepPercentage),
				);
			}

			ctx.ui.notify(formatCompactionResult(result), "success");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Ultra-compact failed: ${message}`, "error");
		}
	};
}

/**
 * Handle session_before_compact event — automatic compaction intercept.
 */
function handleBeforeCompact(
	engine: UltraCompactEngine,
): (event: any, ctx: any) => Record<string, any> | undefined {
	return (event: any, ctx: any) => {
		const preparation = event?.preparation;
		if (!preparation) {
			return undefined;
		}
		const currentTokens = preparation.tokensBefore;

		if (!engine.shouldCompact(currentTokens)) {
			return undefined;
		}

		ctx.ui.notify(
			`Ultra-compact threshold reached (${currentTokens.toLocaleString()} > ${engine.shouldCompactDefaultThreshold().toLocaleString()}), using advanced compaction...`,
			"info",
		);

		try {
			const result = engine.generateSummary(
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

	// Try to get model name from Pi context
	const modelName = getModelName(pi);

	const engine = new UltraCompactEngine({
		...mergedConfig,
		modelName,
	});

	// Log model detection
	logModelInfo(engine, mergedConfig);

	// Register /ultracompact command
	pi.registerCommand("ultracompact", {
		description:
			"Ultra-compact compaction with maximum compression while preserving critical context.",
		handler: handleUltracompactCommand(engine, mergedConfig),
	});

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
