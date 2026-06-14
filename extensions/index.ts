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

/** Default configuration */
const DEFAULT_CONFIG: UltraCompactConfig = {
	thresholdTokens: 100000,
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
 * Pi extension factory function
 */
export default function piUltraCompact(
	 pi: any,
	config: UltraCompactConfig = {},
): void {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };

	// Try to get model name from Pi context
	const modelName = mergedConfig.customPrompt?.includes("model") 
		? undefined 
		: (pi.config?.model || pi.model || undefined);

	const engine = new UltraCompactEngine({
		...mergedConfig,
		modelName,
	});

	// Log model detection
	const recommendations = engine.getModelRecommendations();
	console.log(`[pi-ultra-compact] Detected model family: ${recommendations.modelFamily}`);
	console.log(`[pi-ultra-compact] Context window: ${recommendations.contextWindow.toLocaleString()} tokens`);
	console.log(`[pi-ultra-compact] Auto-compact threshold: ${mergedConfig.thresholdTokens?.toLocaleString() || Math.floor(recommendations.contextWindow * 0.8).toLocaleString()} tokens`);

	// Register /ultracompact command
	pi.registerCommand("ultracompact", {
		description:
			"Ultra-compact compaction with maximum compression while preserving critical context.",
		handler: (_args: any, ctx: any) => {
			ctx.ui.notify("Starting ultra-compact compaction...", "info");

			try {
				// Get session messages
				const messages = ctx.session.messages || [];

				if (messages.length === 0) {
					ctx.ui.notify("No messages to compact.", "warning");
					return;
				}

				// Get previous summary if exists
				const previousSummary = ctx.session.summary || undefined;

				// Generate compact summary
				const result = engine.generateSummary(messages, previousSummary);

				// Apply compaction
				ctx.session.summary = result.summary;
				const keepPercentage = mergedConfig.keepPercentage ?? 0.3;
				ctx.session.messages = messages.slice(
					-Math.ceil(messages.length * keepPercentage),
				);

				// Show result
				ctx.ui.notify(formatCompactionResult(result), "success");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Ultra-compact failed: ${message}`, "error");
			}
		},
	});

	// Register automatic compaction hook
	if (mergedConfig.autoCompact) {
		pi.on("session_before_compact", (event: any, ctx: any) => {
			const { preparation } = event;
			const currentTokens = preparation.tokensBefore;

			// Check if we should use ultra-compact instead
			if (engine.shouldCompact(currentTokens)) {
				ctx.ui.notify(
					"Ultra-compact threshold reached, using advanced compaction...",
					"info",
				);

				try {
					// Use our engine for better compaction
					const result = engine.generateSummary(
						preparation.messagesToSummarize,
						preparation.previousSummary,
					);

					// Return custom compaction
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
					// Fall back to default compaction
					return undefined;
				}
			}

			// Let default compaction handle it
			return undefined;
		});

		pi.on("session_before_compact", (_event: any, ctx: any) => {
			ctx.ui.notify(
				`[Ultra-Compact] Threshold: ${mergedConfig.thresholdTokens?.toLocaleString()} tokens`,
				"info",
			);
		});
	}

	// Log initialization
	console.log("[pi-ultra-compact] Extension loaded");
	console.log(
		`  Threshold: ${mergedConfig.thresholdTokens?.toLocaleString()} tokens`,
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
