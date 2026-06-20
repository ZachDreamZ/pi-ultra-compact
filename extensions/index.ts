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
import { CompactionTier } from "./types";

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
 *
 * Features:
 * - Preemptive trigger: fires at 70% watermark by projecting next turn
 * - Tier-aware: uses micro (no LLM) at 60-90%, full at 90%+
 * - Circuit breaker: trips after N failures, falls back to lossy truncation
 * - Cache-aware: appends to previous summary (keeps prefix stable)
 */
function handleBeforeCompact(
	engine: UltraCompactEngine,
): (event: any, ctx: any) => Record<string, any> | undefined {
	// Circuit breaker state (per-session)
	let compactionFailures = 0;
	let breakerTrippedAtTurn: number | null = null;
	let currentTurn = 0;

	return async (event: any, ctx: any) => {
		currentTurn++;

		// ── Circuit breaker check ───────────────────────────────────────
		if (breakerTrippedAtTurn !== null) {
			const COOLDOWN_TURNS = engine["config"]?.circuitBreakerCooldown ?? 5;
			if (currentTurn - breakerTrippedAtTurn < COOLDOWN_TURNS) {
				console.warn(
					`[pi-ultra-compact] Circuit breaker open (turn ${currentTurn}), using default compaction`,
				);
				return undefined; // Fall back to Pi default
			}
			// Cool-down expired, reset breaker
			compactionFailures = 0;
			breakerTrippedAtTurn = null;
			console.log("[pi-ultra-compact] Circuit breaker reset");
		}

		// Capture model from ctx at runtime
		if (ctx?.model?.id && ctx.model.id !== currentModel?.id) {
			currentModel = {
				id: ctx.model.id,
				contextWindow: ctx.model.contextWindow,
			};
			engine.reconfigure(ctx.model.id);
		} else if (currentModel?.id) {
			engine.reconfigure(currentModel.id);
		}

		const preparation = event?.preparation;
		if (!preparation) {
			return undefined;
		}

		const currentTokens = preparation.tokensBefore;
		const messagesToCompact = preparation.messagesToSummarize;
		const isManual = event?.customInstructions === "ultracompact";

		if (!Array.isArray(messagesToCompact) || messagesToCompact.length === 0) {
			return undefined;
		}

		// ── Preemptive trigger ──────────────────────────────────────────
		// Project next turn's token usage (current + headroom for tool result + output)
		const outputHeadroom = engine["config"]?.outputHeadroom ?? 4096;
		const projectedTokens = currentTokens + outputHeadroom;

		// Use preemptive check for auto, reactive for manual
		const effectiveTokens = isManual ? currentTokens : projectedTokens;

		if (!isManual && !engine.shouldCompact(effectiveTokens)) {
			return undefined; // No compaction needed
		}

		const tier = isManual
			? ("full" as const)
			: engine["config"]?.cacheAware
				? ("auto" as const)
				: ("full" as const);

		if (typeof ctx.ui?.notify === "function") {
			ctx.ui.notify(
				tier === "auto" && engine.determineTier(messagesToCompact) === CompactionTier.MICRO
					? `Ultra-compact micro compacting ${currentTokens.toLocaleString()} tokens…`
					: `Ultra-compact threshold reached (${currentTokens.toLocaleString()}), compacting…`,
				"info",
			);
		}

		// ── Snapshot ────────────────────────────────────────────────────
		const snapshot = JSON.parse(JSON.stringify(messagesToCompact));
		let snapshotPreviousSummary = preparation.previousSummary;

		try {
			// ── Cache-Aware: append instead of rewrite ──────────────────
			// When cache-aware is enabled, the previous summary is kept as-is
			// and only the NEW content is summarized. This keeps the prefix stable
			// for prompt caching.
			const isCacheAware = engine["config"]?.cacheAware ?? false;
			let cacheAwarePrefix = "";

			if (isCacheAware && snapshotPreviousSummary) {
				// Keep the previous summary block immutable — append new content
				cacheAwarePrefix = snapshotPreviousSummary;
				snapshotPreviousSummary = undefined; // Don't re-summarize
			}

			// ── Tier-aware compaction ───────────────────────────────────
			let result: import("./types").CompactionResult;

			if (
				!isManual &&
				engine.determineTier(messagesToCompact) === CompactionTier.MICRO
			) {
				// Micro-compaction: no LLM, just strip tool outputs
				const micro = engine.microCompact(messagesToCompact);
				const extractMicroContent = (m: any): string => {
					if (typeof m.content === "string") return m.content;
					if (Array.isArray(m.content)) {
						return m.content
							.filter((b: any) => b?.type === "text")
							.map((b: any) => b.text ?? "")
							.join(" ");
					}
					return String(m.content ?? "");
				};
				const conversationText = micro.messages
					.map(
						(m: any) =>
							`[${m.role}]: ${extractMicroContent(m).substring(0, 200)}`,
					)
					.join("\n");
				result = {
					summary: isCacheAware
						? cacheAwarePrefix + "\n\n## Chat\n" + conversationText
						: "## Chat\n" + conversationText,
					tokensBefore: currentTokens,
					tokensAfter: engine.estimateTokens(micro.messages),
					compressionRatio: 0,
					readFiles: [],
					modifiedFiles: [],
					timestamp: Date.now(),
				};
			} else {
				// Full compaction
				result = await engine.generateSummary(
					snapshot,
					snapshotPreviousSummary,
				);
				if (isCacheAware && cacheAwarePrefix) {
					result.summary = cacheAwarePrefix + "\n\n" + result.summary;
				}
			}

			// ── Validate output ─────────────────────────────────────────
			if (!result.summary || result.summary.trim().length === 0) {
				throw new Error("Empty summary returned from compaction");
			}

			// Success — reset circuit breaker
			compactionFailures = 0;

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
			// ── Circuit breaker ─────────────────────────────────────────
			compactionFailures++;
			console.error(
				`[pi-ultra-compact] Compaction failed (${compactionFailures}/${engine["config"]?.circuitBreakerMaxFailures ?? 3}):`,
				error,
			);

			if (
				compactionFailures >= (engine["config"]?.circuitBreakerMaxFailures ?? 3)
			) {
				breakerTrippedAtTurn = currentTurn;
				console.error(
					"[pi-ultra-compact] Circuit breaker tripped! Using lossy truncation.",
				);

				// ── Lossy truncation (last resort) ──────────────────────
				const tailKeep = 10;
				const system = snapshot.filter((m: any) => m.role === "system");
				const nonSystem = snapshot.filter((m: any) => m.role !== "system");
				const tail = nonSystem.slice(-tailKeep);

				const extractContent = (m: any): string => {
					if (typeof m.content === "string") return m.content;
					if (Array.isArray(m.content)) {
						return m.content
							.filter((b: any) => b?.type === "text")
							.map((b: any) => b.text ?? "")
							.join(" ");
					}
					return String(m.content ?? "");
				};

				const lossySummary = [
					...system.map(
						(m: any) =>
							`[System]: ${extractContent(m)}`,
					),
					"",
					"[earlier history truncated — circuit breaker engaged]",
					"",
					...tail.map(
						(m: any) => {
							const text = extractContent(m);
							return text ? `[${m.role}]: ${text.substring(0, 500)}` : "";
						},
					),
				]
					.filter(Boolean)
					.join("\n");

				if (typeof ctx.ui?.notify === "function") {
					ctx.ui.notify(
						"Compaction failed repeatedly — emergency truncation applied",
						"warning",
					);
				}

				return {
					compaction: {
						summary: lossySummary,
						firstKeptEntryId: preparation.firstKeptEntryId,
						tokensBefore: preparation.tokensBefore,
						details: {
							ultracompact: true,
							circuitBreakerEngaged: true,
						},
					},
				};
			}

			// Fall back to Pi's default compaction
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
