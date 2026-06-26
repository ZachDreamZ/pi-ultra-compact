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



/** Track current model at runtime (updated by session_start and model_select events) */

let currentModel: { id?: string; contextWindow?: number } | undefined;
/** Circuit breaker state (module-level for __resetModuleState access) */
let compactionFailures = 0;
let breakerTrippedAtTurn: number | null = null;
let currentTurn = 0;



/** Default configuration — thresholdTokens omitted so engine auto-detects from model context window */

const DEFAULT_CONFIG: UltraCompactConfig = {

	keepPercentage: 0.3,

	maxKeepTokens: 30000,

	autoCompact: true,

};



function captureModel(model: any): void {

	if (!model) return;



	const id =

		typeof model === "string"

			? model

			: model.id || model.name || model.model || undefined;

	const contextWindow =

		typeof model === "object" && typeof model.contextWindow === "number"

			? model.contextWindow

			: undefined;



	if (id || contextWindow) {

		currentModel = { id, contextWindow };

	}

}



function notify(

	ctx: any,

	message: string,

	type: "info" | "warning" | "error" = "info",

): void {

	if (typeof ctx?.ui?.notify === "function") {

		ctx.ui.notify(message, type);

	}

}



/**

 * Reconfigure the engine to match the current model before a compaction operation.

 * Ensures the threshold adapts even if the user changed models mid-session.

 */

function reconfigureEngineForCurrentModel(engine: UltraCompactEngine): void {

	engine.reconfigure(currentModel?.id, currentModel?.contextWindow);

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
			console.warn("Ultra-compact warning: ctx.compact unavailable");
			return;

		}

		// Notify user that compaction is starting
		notify(ctx, "Starting Ultra-compact compaction...", "info");

		// Reconfigure engine to current model before compaction

		reconfigureEngineForCurrentModel(engine);



		// Use Pi's built-in compact() API with a marker so our

		// session_before_compact hook applies ultra-compact logic

		ctx.compact({

			customInstructions: "ultracompact",
			onComplete: () => {
				notify(ctx, "Ultra-compact compaction complete!", "info");
			},
			onError: (error: Error) => {
				if (typeof ctx?.ui?.notify === "function") {
					notify(ctx, `Ultra-compact failed: ${error.message}`, "error");
				} else {
					console.error("Ultra-compact failed:", error.message);
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



	return async (event: any, ctx: any) => {

		currentTurn++;



		// ── Circuit breaker check ───────────────────────────────────────

		if (breakerTrippedAtTurn !== null) {

			const COOLDOWN_TURNS = engine["config"]?.circuitBreakerCooldown ?? 5;

			if (currentTurn - breakerTrippedAtTurn < COOLDOWN_TURNS) {

				notify(

					ctx,

					"Ultra-compact circuit breaker open; using default compaction",

					"warning",

				);

				return undefined; // Fall back to Pi default

			}

			// Cool-down expired, reset breaker

			compactionFailures = 0;

			breakerTrippedAtTurn = null;

		}



		// Capture model from ctx at runtime

		if (ctx?.model) {

			captureModel(ctx.model);

		}

		reconfigureEngineForCurrentModel(engine);



		const preparation = event?.preparation;

		if (!preparation) {

			return undefined;

		}



		const currentTokens = preparation.tokensBefore;

		const messagesToCompact = preparation.messagesToSummarize;

		const isManual = event?.customInstructions === "ultracompact";
		// Manual trigger already notified by handleUltracompactCommand



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

				engine.determineTier(messagesToCompact) === 1 // MICRO

			) {

				// Micro-compaction: no LLM, just strip tool outputs

				const micro = engine.microCompact(messagesToCompact);

				const conversationText = micro.messages

					.map(

						(m: any) =>

							`[${m.role}]: ${typeof m.content === "string" ? m.content.substring(0, 200) : ""}`,

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

			notify(

				ctx,

				`Ultra-compact failed (${compactionFailures}/${engine["config"]?.circuitBreakerMaxFailures ?? 3})`,

				"warning",

			);



			if (

				compactionFailures >= (engine["config"]?.circuitBreakerMaxFailures ?? 3)

			) {

				breakerTrippedAtTurn = currentTurn;

				notify(

					ctx,

					"Ultra-compact circuit breaker tripped; emergency truncation applied",

					"error",

				);



				// ── Lossy truncation (last resort) ──────────────────────

				const tailKeep = 10;

				const system = snapshot.filter((m: any) => m.role === "system");

				const nonSystem = snapshot.filter((m: any) => m.role !== "system");

				const tail = nonSystem.slice(-tailKeep);



				const lossySummary = [

					...system.map(

						(m: any) =>

							`[System]: ${typeof m.content === "string" ? m.content : ""}`,

					),

					"",

					"[earlier history truncated — circuit breaker engaged]",

					"",

					...tail.map(

						(m: any) =>

							`${typeof m.content === "string" ? `[${m.role}]: ${m.content.substring(0, 500)}` : ""}`,

					),

				]

					.filter(Boolean)

					.join("\n");



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



/**

 * Pi extension factory function

 */

export default function piUltraCompact(

	pi: any,

	config: UltraCompactConfig = {},

): void {

	const mergedConfig = { ...DEFAULT_CONFIG, ...config };



	const engine = new UltraCompactEngine({

		...mergedConfig,

	});



	// Guard: ensure required Pi APIs are available

	if (typeof pi?.registerCommand !== "function") {
		console.error(
			"pi.registerCommand is unavailable",
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

		pi.on("session_start", (_event: any, ctx: any) => {

			captureModel(ctx?.model);

			reconfigureEngineForCurrentModel(engine);

		});



		pi.on("model_select", (event: any, _ctx: any) => {

			if (event?.model) {
				const id = typeof event.model === "string"
					? event.model
					: event.model.id || event.model.name || undefined;
				captureModel(event.model);

				reconfigureEngineForCurrentModel(engine);
				if (id) {
					console.log("Model updated: " + id);
				}
			}

		});

	}



	// Register automatic compaction hook (single handler)

	if (mergedConfig.autoCompact) {

		pi.on("session_before_compact", handleBeforeCompact(engine));

	}

}



// Export engine for programmatic use

export { UltraCompactEngine } from "./engine";

export type { UltraCompactConfig, CompactionResult } from "./types";

/**
 * @internal — Reset module-level state for testing isolation.
 * Vitest caches modules across test files, so shared state must be
 * explicitly reset between suites.
 */
export function __resetModuleState(): void {
	currentModel = undefined;
	compactionFailures = 0;
	breakerTrippedAtTurn = null;
	currentTurn = 0;
}
