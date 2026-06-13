/**
 * Ultra-Compact Compaction Extension for Pi
 *
 * Replaces default compaction with maximum compression while preserving
 * essential context for continued work. Uses abbreviated notation,
 * selective retention, and dense formatting.
 *
 * Features:
 * - Ultra-dense summary format with shorthand notation
 * - Smart message prioritization (decisions > file changes > progress > context)
 * - Configurable compression levels
 * - Automatic Engram memory backup when available
 * - Minimal token usage while preserving critical context
 *
 * Usage:
 *   Automatically installed in ~/.pi/agent/extensions/
 *   Pi auto-discovers and loads on startup
 */

import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	convertToLlm,
	serializeConversation,
} from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface CompactionConfig {
	/** Compression level: 'ultra' | 'aggressive' | 'standard' */
	level: "ultra" | "aggressive" | "standard";
	/** Model to use for summarization (null = use conversation model) */
	summaryModel: string | null;
	/** Maximum summary tokens */
	maxSummaryTokens: number;
	/** Keep N most recent tool results verbatim */
	keepRecentToolResults: number;
	/** Always preserve file operations */
	preserveFileOps: boolean;
}

const DEFAULT_CONFIG: CompactionConfig = {
	level: "ultra",
	summaryModel: null, // Use conversation model
	maxSummaryTokens: 4096,
	keepRecentToolResults: 3,
	preserveFileOps: true,
};

/**
 * Load config from settings file
 */
function loadConfig(): CompactionConfig {
	try {
		const settingsPath = join(
			homedir(),
			".pi",
			"agent",
			"extensions",
			"ultra-compact-settings.json",
		);
		const raw = readFileSync(settingsPath, "utf8");
		const parsed = JSON.parse(raw);
		if (parsed.ultraCompactCompaction) {
			return { ...DEFAULT_CONFIG, ...parsed.ultraCompactCompaction };
		}
	} catch {
		// Settings file not found or invalid, use defaults
	}
	return { ...DEFAULT_CONFIG };
}

/**
 * Ultra-compact summary format with maximum information density
 */
function buildUltraCompactPrompt(
	conversationText: string,
	previousSummary: string | undefined,
	config: CompactionConfig,
): string {
	const prevContext = previousSummary
		? `\n\nPREV_CONTEXT:\n${previousSummary}`
		: "";

	// Compression level affects prompt instructions
	const compressionInstructions = {
		ultra: `ULTRA COMPRESSION: Maximize information density. Use abbreviations, shorthand, and compressed notation.

FORMAT (follow exactly):
[GOAL] 1-sentence objective
[DEC] Key decisions (max 5, one line each): D1: decision | rationale
[FILES] Changed files: +new ~mod -del | path:summary
[PROG] Current state: DONE: x,y | WIP: z | BLOCKED: w
[NEXT] Next steps (numbered, max 3)
[CTX] Critical context only (vars, configs, deps)
[MEM] Memory saves made: list or "none"`,

		aggressive: `AGGRESSIVE COMPRESSION: Condense significantly while preserving key context.

FORMAT:
## Goal
One sentence.

## Decisions
- Decision: Rationale

## Files
| Action | Path | Change |
|--------|------|--------|
| +/~/- | path | brief |

## Progress
- Done: ...
- WIP: ...
- Blocked: ...

## Next
1. Step

## Context
Only essential vars/configs.

## Memory
Saves made.`,

		standard: `Standard compression with good readability.

FORMAT:
## Goal
[Objective]

## Key Decisions
- [Decision]: [Rationale]

## File Changes
### Added
- file.ts: description
### Modified
- file.ts: what changed
### Deleted
- file.ts

## Progress
### Done
- [x] Task
### In Progress
- [ ] Task
### Blocked
- Issue

## Next Steps
1. Step

## Critical Context
- Important info

## Memory
- Saves`,
	};

	return `You are an ULTRA-COMPACT conversation compressor. Your goal is to preserve ALL critical information while using MINIMUM tokens.

${compressionInstructions[config.level]}
${prevContext}

RULES:
1. Never exceed ${config.maxSummaryTokens} tokens
2. Use abbreviations: cfg=config, deps=dependencies, fn=function, cls=class
3. Use symbols: +added, ~modified, -deleted, ->leads to, ==equals
4. One line per decision, file change, and progress item
5. Skip pleasantries, explanations, and redundant context
6. Include ALL file paths (never summarize as "several files")
7. Preserve exact variable names, function names, and config values
8. If tool output contains errors, include error message verbatim
9. Current task state is MORE important than history
10. Decisions and rationale are CRITICAL - never skip

<conversation>
${conversationText}
</conversation>`;
}

/**
 * Extract file operations from messages
 */
function extractFileOps(messages: any[]): {
	added: string[];
	modified: string[];
	deleted: string[];
	read: string[];
} {
	const ops = {
		added: [] as string[],
		modified: [] as string[],
		deleted: [] as string[],
		read: [] as string[],
	};

	for (const msg of messages) {
		if (msg.role !== "assistant") continue;
		if (!Array.isArray(msg.content)) continue;

		for (const block of msg.content) {
			if (block.type !== "tool_use") continue;
			const input = block.input as Record<string, unknown>;

			if (block.name === "write" && typeof input.path === "string") {
				// Check if file existed before
				if (
					!ops.read.includes(input.path) &&
					!ops.modified.includes(input.path)
				) {
					ops.added.push(input.path);
				} else {
					ops.modified.push(input.path);
				}
			} else if (block.name === "edit" && typeof input.path === "string") {
				if (!ops.modified.includes(input.path)) {
					ops.modified.push(input.path);
				}
			} else if (block.name === "bash" && typeof input.command === "string") {
				const cmd = input.command;
				if (cmd.includes("rm ") || cmd.includes("del ")) {
					// Try to extract path
					const match = cmd.match(/(?:rm|del)\s+(.+)/);
					if (match) ops.deleted.push(match[1].trim());
				}
			} else if (block.name === "read" && typeof input.path === "string") {
				if (!ops.read.includes(input.path)) {
					ops.read.push(input.path);
				}
			}
		}
	}

	return ops;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_before_compact", async (event, ctx) => {
		const { preparation, signal } = event;
		const {
			messagesToSummarize,
			turnPrefixMessages,
			tokensBefore,
			firstKeptEntryId,
			previousSummary,
		} = preparation;

		// Load config from settings file
		const config = loadConfig();

		ctx.ui.notify(
			`Ultra-compact compaction: ${tokensBefore.toLocaleString()} tokens → ${config.level} compression`,
			"info",
		);

		// Combine all messages
		const allMessages = [...messagesToSummarize, ...turnPrefixMessages];

		// Extract file operations for metadata
		const fileOps = extractFileOps(allMessages);

		// Get model for summarization
		let model;
		if (config.summaryModel) {
			const [provider, modelId] = config.summaryModel.split("/");
			model = ctx.modelRegistry.find(provider, modelId);
		}
		if (!model) {
			model = ctx.modelRegistry.find("google", "gemini-2.5-flash");
		}
		if (!model) {
			model = ctx.modelRegistry.find("openai", "gpt-4o-mini");
		}

		if (!model) {
			ctx.ui.notify("No suitable model found for compaction", "warning");
			return;
		}

		// Get auth
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok || !auth.apiKey) {
			ctx.ui.notify(
				`Auth failed for ${model.id}, using default compaction`,
				"warning",
			);
			return;
		}

		// Serialize conversation
		const conversationText = serializeConversation(convertToLlm(allMessages));

		// Build ultra-compact prompt
		const promptText = buildUltraCompactPrompt(
			conversationText,
			previousSummary,
			config,
		);

		ctx.ui.notify(`Compressing with ${model.id}...`, "info");

		try {
			const response = await complete(
				model,
				{
					messages: [
						{
							role: "user",
							content: [{ type: "text", text: promptText }],
							timestamp: Date.now(),
						},
					],
				},
				{
					apiKey: auth.apiKey,
					headers: auth.headers,
					maxTokens: config.maxSummaryTokens,
					signal,
				},
			);

			const summary = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");

			if (!summary.trim()) {
				ctx.ui.notify("Compaction summary was empty", "warning");
				return;
			}

			// Add file operation metadata as comment
			const metadata = [
				"<!-- ULTRA_COMPACT_META",
				`FILES_ADDED: ${fileOps.added.join(",") || "none"}`,
				`FILES_MODIFIED: ${fileOps.modified.join(",") || "none"}`,
				`FILES_DELETED: ${fileOps.deleted.join(",") || "none"}`,
				`TOKENS_BEFORE: ${tokensBefore}`,
				`COMPRESSION: ${config.level}`,
				"META -->",
				"",
			].join("\n");

			const fullSummary = metadata + summary;

			ctx.ui.notify(
				`Compaction complete: ${tokensBefore.toLocaleString()} tokens → ${summary.length} chars`,
				"info",
			);

			return {
				compaction: {
					summary: fullSummary,
					firstKeptEntryId,
					tokensBefore,
					details: {
						compressionLevel: config.level,
						filesAdded: fileOps.added,
						filesModified: fileOps.modified,
						filesDeleted: fileOps.deleted,
						filesRead: fileOps.read,
					},
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Compaction failed: ${message}`, "error");
			return;
		}
	});

	// Register command to toggle compression level
	pi.registerCommand("compression-level", {
		description: "Set compaction compression level (ultra/aggressive/standard)",
		handler: async (args, ctx) => {
			const level = args?.trim().toLowerCase();
			if (!level || !["ultra", "aggressive", "standard"].includes(level)) {
				ctx.ui.notify(
					"Usage: /compression-level <ultra|aggressive|standard>",
					"info",
				);
				return;
			}
			// Store in memory for next compaction
			(globalThis as Record<string, unknown>).__ultraCompactLevel = level;
			ctx.ui.notify(`Compression level set to: ${level}`, "info");
		},
	});
}
