/**
 * Ultra-Compact Engine v0.6.0
 *
 * Advanced compaction engine with:
 * - Smart hybrid compaction (sliding window + summarization)
 * - Tool output pruning (saves 30-50% tokens)
 * - Deduplication of repeated content
 * - Recency-based importance scoring
 * - Token budget protection for recent messages
 * - Iterative summary updates
 * - Hierarchical summarization
 */

import type {
	CompactionResult,
	Message,
	EvictionStats,
	MicroCompactStats,
} from "./types";
import { EvictionLevel, CompactionTier } from "./types";

/**
 * Normalize message content to string, handling both plain text and structured arrays.
 */
function messageContent(msg: Message): string {
	const c = msg.content;
	if (typeof c === "string") return c;
	if (Array.isArray(c)) {
		return c
			.filter((block: any): boolean => block?.type === "text")
			.map((block: any): string => block.text ?? "")
			.join(" ");
	}
	return String(c ?? "");
}

const DEFAULT_CONTEXT_WINDOW = 128000;

/**
 * Importance signals for message scoring
 */
const IMPORTANCE_SIGNALS = {
	// Keyword patterns with weights
	keywords: [
		{
			pattern: /\b(?:GOAL|OBJECTIVE|TARGET|WANT TO|TRYING TO)\b:?\s*(.+)/i,
			weight: 1.0,
		},
		{
			pattern: /\b(?:DECISION|DECIDED|CHOSE|SELECTED)\b:?\s*(.+)/i,
			weight: 0.95,
		},
		{
			pattern: /\b(?:ERROR|FAILED|BUG|ISSUE|PROBLEM|CRASH)\b:?\s*(.+)/i,
			weight: 0.9,
		},
		{
			pattern: /\b(?:SOLUTION|FIX|RESOLVED|FIXED|WORKAROUND)\b:?\s*(.+)/i,
			weight: 0.85,
		},
		{
			pattern: /\b(?:DISCOVERED|FOUND|LEARNED|INSIGHT|REALIZED)\b:?\s*(.+)/i,
			weight: 0.8,
		},
		{
			pattern: /\b(?:CONSTRAINT|REQUIREMENT|REQUIRED|MUST)\b:?\s*(.+)/i,
			weight: 0.75,
		},
		{ pattern: /\b(?:FILE|PATH|DIRECTORY|MODULE)\b:?\s*(.+)/i, weight: 0.7 },
		{
			pattern:
				/\b(?:ADDED|REMOVED|MODIFIED|CHANGED|UPDATED|CREATED|DELETED)\b:?\s*(.+)/i,
			weight: 0.65,
		},
		{
			pattern: /\b(?:TODO|NEXT|SHOULD|PLAN TO|NEED TO)\b:?\s*(.+)/i,
			weight: 0.6,
		},
	],

	// Content type multipliers
	contentMultipliers: {
		codeBlock: 1.3, // Code is hard to reconstruct
		filePath: 1.2, // Files track project state
		toolCall: 1.15, // Actions contain key state
		errorLog: 1.25, // Errors need tracking
		multiLine: 0.9, // Long messages slightly less important
	},
};

/**
 * Patterns for tool output pruning
 */
const TOOL_OUTPUT_PATTERNS = {
	// Tool result indicators
	toolResult: /^(?:result|output|response|tool_result)/i,
	// Command execution output
	commandOutput: /^(?:\$|>|bash|shell|terminal|command)/i,
	// File read output
	fileRead: /^(?:read|cat|type|file)/i,
	// Large output indicators
	largeOutput: /\[\d+ lines?\s+(?:output|results?)\]/i,
	// Exit code indicators
	exitCode: /exit(?:\s+code)?\s*[=:]\s*\d+/i,
};

/**
 * Ultra-Compact Engine class
 */
export class UltraCompactEngine {
	private config: {
		thresholdTokens: number;
		keepPercentage: number;
		maxKeepTokens: number;
		modelName?: string;
		contextWindow?: number;
		minMessagesForCompression: number;
		useLLM: boolean;
		/** Optional async LLM summarizer: receives conversation text, returns condensed summary */
		llmSummarize?: (text: string) => Promise<string>;
		maxEvictionLevel: import("./types").EvictionLevel;
		cacheAware: boolean;
		preemptiveWatermark: number;
		hardWatermark: number;
		outputHeadroom: number;
		circuitBreakerMaxFailures: number;
		circuitBreakerCooldown: number;
	};

	private contextWindow: number;
	private userThresholdOverride?: number;

	// Compression history for iterative updates
	private compressionHistory: Array<{
		timestamp: number;
		summary: string;
		tokensBefore: number;
		tokensAfter: number;
	}> = [];

	constructor(config: Partial<UltraCompactEngine["config"]> = {}) {
		this.config = {
			thresholdTokens: config.thresholdTokens ?? 100000,
			keepPercentage: config.keepPercentage ?? 0.3,
			maxKeepTokens: config.maxKeepTokens ?? 30000,
			modelName: config.modelName,
			contextWindow: config.contextWindow,
			minMessagesForCompression: config.minMessagesForCompression ?? 100,
			useLLM: config.useLLM ?? false,
			llmSummarize: config.llmSummarize,
			maxEvictionLevel: config.maxEvictionLevel ?? EvictionLevel.FULL_REMOVAL,
			cacheAware: config.cacheAware ?? false,
			preemptiveWatermark: config.preemptiveWatermark ?? 0.7,
			hardWatermark: config.hardWatermark ?? 0.95,
			outputHeadroom: config.outputHeadroom ?? 4096,
			circuitBreakerMaxFailures: config.circuitBreakerMaxFailures ?? 3,
			circuitBreakerCooldown: config.circuitBreakerCooldown ?? 5,
		};

		if (config.thresholdTokens !== undefined) {
			this.userThresholdOverride = config.thresholdTokens;
		}

		this.contextWindow =
			this.config.contextWindow ?? this.detectContextWindow(this.config.modelName);

		if (this.userThresholdOverride === undefined) {
			this.config.thresholdTokens = Math.floor(this.contextWindow * 0.8);
		}
	}

	/**
	 * Return the generic fallback used only when Pi model metadata is unavailable.
	 */
	private detectContextWindow(_modelName?: string): number {
		return DEFAULT_CONTEXT_WINDOW;
	}

	/**
	 * Dynamically reconfigure the engine with a new model name
	 */
	public reconfigure(modelName?: string, contextWindow?: number): void {
		this.config.modelName = modelName;
		this.config.contextWindow = contextWindow;
		this.contextWindow = contextWindow ?? this.detectContextWindow(modelName);
		if (this.userThresholdOverride === undefined) {
			this.config.thresholdTokens = Math.floor(this.contextWindow * 0.8);
		}
	}

	/**
	 * Get the detected context window size
	 */
	public getContextWindow(): number {
		return this.contextWindow;
	}

	/**
	 * Get model-specific recommendations
	 */
	public getModelRecommendations(): {
		contextWindow: number;
		recommendedThreshold: number;
		recommendedKeep: number;
		modelFamily: string;
	} {
		const modelFamily = this.config.modelName?.toLowerCase() || "unknown";
		const family = this.detectModelFamily(modelFamily);

		return {
			contextWindow: this.contextWindow,
			recommendedThreshold: Math.floor(this.contextWindow * 0.8),
			recommendedKeep: Math.floor(this.contextWindow * 0.2),
			modelFamily: family,
		};
	}

	private detectModelFamily(modelName: string): string {
		const familyPatterns: [string, string][] = [
			["claude", "anthropic"],
			["gpt", "openai"],
			["gemini", "google"],
			["deepseek", "deepseek"],
			["llama", "meta"],
			["mistral", "mistral"],
		];

		for (const [pattern, family] of familyPatterns) {
			if (modelName.includes(pattern)) return family;
		}

		return "unknown";
	}

	/**
	 * Get the effective threshold used by shouldCompact
	 */
	public shouldCompactDefaultThreshold(): number {
		return this.config.thresholdTokens;
	}

	/**
	 * Calculate how many tokens to keep
	 */
	public calculateKeepTokens(currentTokens: number): number {
		const basedOnPercentage = Math.floor(
			currentTokens * this.config.keepPercentage,
		);
		return Math.min(basedOnPercentage, this.config.maxKeepTokens);
	}

	/**
	 * Extract critical information from messages
	 */
	public extractCriticalInfo(messages: Message[]): {
		critical: Message[];
		compressible: Message[];
		scores: Map<string, number>;
	} {
		if (!Array.isArray(messages)) {
			return { critical: [], compressible: [], scores: new Map() };
		}

		const critical: Message[] = [];
		const compressible: Message[] = [];
		const scores = new Map<string, number>();

		for (const message of messages) {
			const score = this.calculateMessageImportance(message);
			scores.set(message.id, score);

			if (score > 0.6) {
				critical.push(message);
			} else {
				compressible.push(message);
			}
		}

		return { critical, compressible, scores };
	}

	/**
	 * Generate a compact summary from messages
	 *
	 * Smart Hybrid Algorithm:
	 * 1. Pre-process: Deduplicate, prune tool outputs
	 * 2. Classify: Protected vs Compressible vs Discardable
	 * 3. Summarize: Generate structured summary
	 * 4. Merge: Combine with protected messages
	 */

	/**
	 * Determine which compaction tier to use based on token usage.
	 *
	 * - NONE: < 60% usage — no compaction needed
	 * - MICRO: 60-90% usage — fast tool-output pruning (no LLM)
	 * - FULL: >= 90% usage — full structured summarization
	 */
	public determineTier(messages: Message[]): CompactionTier {
		const tokens = this.estimateTokens(messages);
		const ratio = this.contextWindow > 0 ? tokens / this.contextWindow : 0;

		if (ratio >= 0.9) return CompactionTier.FULL;
		if (ratio >= 0.6) return CompactionTier.MICRO;
		return CompactionTier.NONE;
	}

	/**
	 * Micro-compaction: fast tool-output pruning without LLM summarization.
	 *
	 * Uses graduated eviction at levels 1-2 (strip reasoning + bulk outputs).
	 * Suitable for 60-90% context usage where the budget can be recovered
	 * by pruning tool outputs alone.
	 *
	 * @returns MicroCompactStats with details about what was stripped
	 */
	public microCompact(
		messages: Message[],
	): { messages: Message[] } & MicroCompactStats {
		const before = this.estimateTokens(messages);
		const targetBudget = Math.floor(this.contextWindow * 0.5); // Target 50% usage

		const evicted = this.evictGradually(
			messages,
			targetBudget,
			EvictionLevel.STRIP_BULK_OUTPUT, // Levels 1-2 only
		);

		const after = this.estimateTokens(evicted.messages);

		return {
			messages: evicted.messages,
			tokensSaved: before - after,
			messagesStripped: evicted.stats.messagesStripped,
			filesCollapsed: [],
		};
	}

	/**
	 * Tier-aware compaction — automatically selects micro or full based on usage.
	 *
	 * @param messages Messages to compact
	 * @param tier Optional override tier (auto-detected if omitted)
	 */
	public async compact(
		messages: Message[],
		previousSummary?: string,
		tier?: CompactionTier,
	): Promise<CompactionResult> {
		const actualTier = tier ?? this.determineTier(messages);

		if (actualTier === CompactionTier.MICRO) {
			const result = this.microCompact(messages);
			const tokensBefore = this.estimateTokens(messages);
			const tokensAfter = this.estimateTokens(result.messages);

			return {
				summary: "",
				tokensBefore,
				tokensAfter,
				compressionRatio: tokensBefore > 0 ? tokensAfter / tokensBefore : 1,
				readFiles: [],
				modifiedFiles: [],
				timestamp: Date.now(),
			};
		}

		return this.generateSummary(messages, previousSummary);
	}

	/**
	 * Check if compaction is needed based on token count.
	 * Returns true at 60%+ usage (lower threshold for micro-compact).
	 */
	public shouldCompact(currentTokens: number): boolean {
		return currentTokens >= Math.floor(this.contextWindow * 0.6);
	}

	public async generateSummary(
		messages: Message[],
		previousSummary?: string,
	): Promise<CompactionResult> {
		if (!Array.isArray(messages) || messages.length === 0) {
			return {
				summary: previousSummary || "",
				tokensBefore: 0,
				tokensAfter: 0,
				compressionRatio: 1,
				readFiles: [],
				modifiedFiles: [],
				timestamp: Date.now(),
			};
		}

		// Phase 1: Pre-processing (no LLM)
		const preprocessed = this.preprocessMessages(messages);

		// Phase 2: Classification
		const {
			protected: protectedMsgs,
			compressible,
			discardable: _discardable,
		} = this.classifyMessages(preprocessed);

		const tokensBefore = this.estimateTokens(messages);
		const targetBudget = this.calculateKeepTokens(tokensBefore);

		// Phase 3: Attempt graduated eviction first to strip content before summarization
		// (eviction reduces the input size, making the structured summary more compact)
		let summary: string;

		if (compressible.length > 0) {
			const evicted = this.evictGradually(
				compressible,
				targetBudget,
				this.config.maxEvictionLevel ?? EvictionLevel.FULL_REMOVAL,
			);

			// Always generate structured summary from the remaining content.
			// Graduated eviction strips noise first so the summary is more compact.
			summary = await this.generateSummaryFromRemaining(
				evicted.messages,
				protectedMsgs,
				previousSummary,
			);
		} else if (protectedMsgs.length > 0) {
			// All messages were classified as protected (important content) —
			// still need a structured summary to extract and format the content
			summary = await this.generateSummaryFromRemaining(
				protectedMsgs,
				[],
				previousSummary,
			);
		} else {
			// No compressible messages — just use previous summary or empty
			summary = previousSummary || "";
		}

		// Phase 4: Calculate metrics

		// Phase 5: Calculate metrics
		const protectedTokens = this.estimateTokens(protectedMsgs);
		const summaryTokens = this.estimateTokens([
			{
				id: "summary",
				role: "system",
				content: summary,
				timestamp: Date.now(),
			},
		]);
		const tokensAfter = protectedTokens + summaryTokens;

		const fileOps = this.extractFileOperations(messages);

		// Store in history for iterative updates
		this.compressionHistory.push({
			timestamp: Date.now(),
			summary,
			tokensBefore,
			tokensAfter,
		});

		// Keep only last 5 compression records
		if (this.compressionHistory.length > 5) {
			this.compressionHistory = this.compressionHistory.slice(-5);
		}

		return {
			summary,
			tokensBefore,
			tokensAfter,
			compressionRatio: tokensBefore > 0 ? tokensAfter / tokensBefore : 1,
			readFiles: fileOps.read,
			modifiedFiles: fileOps.modified,
			timestamp: Date.now(),
		};
	}

	/**
	 * Phase 1: Pre-process messages
	 * - Deduplicate repeated content
	 * - Prune old tool outputs
	 * - Remove redundant messages
	 */
	private preprocessMessages(messages: Message[]): Message[] {
		let result = [...messages];

		// Step 1: Deduplicate exact duplicates
		result = this.deduplicateMessages(result);

		// Step 2: Prune old tool outputs (only if there are multiple messages)
		if (result.length > 1) {
			result = this.pruneToolOutputs(result);
		}

		// Step 3: Remove empty messages
		result = result.filter((msg) => {
			const content = messageContent(msg);
			return content.trim().length > 0;
		});

		return result;
	}

	/**
	 * Remove exact duplicate messages
	 */
	private deduplicateMessages(messages: Message[]): Message[] {
		const seen = new Map<string, number>();
		const result: Message[] = [];

		for (const msg of messages) {
			const content = messageContent(msg);
			const key = `${msg.role}:${content.substring(0, 100)}`;

			if (!seen.has(key)) {
				seen.set(key, 1);
				result.push(msg);
			} else {
				// Keep only the last occurrence
				const index = result.findIndex((m) => {
					const mContent = messageContent(m);
					return (
						m.role === msg.role &&
						mContent.substring(0, 100) === content.substring(0, 100)
					);
				});
				if (index !== -1) {
					result.splice(index, 1);
				}
				result.push(msg);
			}
		}

		return result;
	}

	/**
	 * Prune old tool outputs to save tokens
	 *
	 * Strategy:
	 * - Keep recent tool outputs (last 20% of conversation)
	 * - Summarize older tool outputs to 1 line
	 * - Deduplicate repeated file reads
	 */
	private pruneToolOutputs(messages: Message[]): Message[] {
		const result: Message[] = [];
		const protectRecentCount = Math.max(5, Math.floor(messages.length * 0.2));
		const fileReads = new Map<string, number>(); // Track file reads for dedup

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i];
			const isRecent = i >= messages.length - protectRecentCount;
			const content = messageContent(msg);

			// Check if this is a tool output
			if (msg.role === "tool" || this.isToolOutput(content)) {
				if (isRecent) {
					// Keep recent tool outputs
					result.push(msg);
				} else {
					// Summarize old tool outputs
					const summary = this.summarizeToolOutput(content);
					result.push({
						...msg,
						content: summary,
					});
				}
			} else if (this.isFileRead(content)) {
				// Deduplicate file reads
				const filePath = this.extractFilePath(content);
				if (filePath) {
					const lastRead = fileReads.get(filePath);
					if (lastRead === undefined || i - lastRead > 10) {
						// Keep if first read or read was more than 10 messages ago
						fileReads.set(filePath, i);
						result.push(msg);
					}
					// Otherwise skip (duplicate read)
				} else {
					result.push(msg);
				}
			} else {
				result.push(msg);
			}
		}

		return result;
	}

	/**
	 * Check if content looks like tool output
	 */
	private isToolOutput(content: string): boolean {
		return (
			TOOL_OUTPUT_PATTERNS.toolResult.test(content) ||
			TOOL_OUTPUT_PATTERNS.commandOutput.test(content) ||
			TOOL_OUTPUT_PATTERNS.largeOutput.test(content)
		);
	}

	/**
	 * Check if content looks like a file read
	 */
	private isFileRead(content: string): boolean {
		return TOOL_OUTPUT_PATTERNS.fileRead.test(content);
	}

	/**
	 * Extract file path from content
	 */
	private extractFilePath(content: string): string | null {
		const match = content.match(
			/(?:read|cat|type|file)\s+(?:`"?)([\w./\\-]+)(?:`"?)/i,
		);
		return match ? match[1] : null;
	}

	/**
	 * Summarize a tool output to 1 line
	 */
	private summarizeToolOutput(content: string): string {
		const lines = content.split("\n");
		const lineCount = lines.length;

		// Check for exit code
		const exitCodeMatch = content.match(TOOL_OUTPUT_PATTERNS.exitCode);
		const exitCode = exitCodeMatch ? exitCodeMatch[0] : "unknown";

		// Check for common patterns
		if (content.includes("error") || content.includes("Error")) {
			return `[tool] Error output (${lineCount} lines): ${lines[0]?.substring(0, 80) || "error"}`;
		}

		if (
			content.includes("success") ||
			content.includes("Success") ||
			content.includes("✓")
		) {
			return `[tool] Success output (${lineCount} lines): ${lines[0]?.substring(0, 80) || "success"}`;
		}

		return `[tool] Output (${lineCount} lines, ${exitCode}): ${lines[0]?.substring(0, 80) || "output"}`;
	}

	/**
	 * Phase 2: Classify messages into protected, compressible, and discardable
	 */
	private classifyMessages(messages: Message[]): {
		protected: Message[];
		compressible: Message[];
		discardable: Message[];
	} {
		const protectedMsgs: Message[] = [];
		const compressible: Message[] = [];
		const discardable: Message[] = [];

		// Protect system prompts
		let systemProtected = false;

		for (const msg of messages) {
			const content = messageContent(msg);

			// Protect system messages
			if (msg.role === "system" && !systemProtected) {
				protectedMsgs.push(msg);
				systemProtected = true;
				continue;
			}

			// Protect high-importance messages
			const importance = this.calculateMessageImportance(msg);
			if (importance > 0.7) {
				protectedMsgs.push(msg);
				continue;
			}

			// Check for content patterns that should be protected
			if (this.shouldProtectContent(content)) {
				protectedMsgs.push(msg);
				continue;
			}

			// Classify remaining messages
			// All non-protected messages go to compressible for summarization
			compressible.push(msg);
		}

		// Protect recent messages by token budget
		const recentProtected = this.protectRecentByTokenBudget(
			compressible,
			20000,
		);
		const remainingCompressible = compressible.filter(
			(msg) => !recentProtected.includes(msg),
		);

		return {
			protected: [...protectedMsgs, ...recentProtected],
			compressible: remainingCompressible,
			discardable,
		};
	}

	/**
	 * Check if content should be protected based on patterns
	 */
	private shouldProtectContent(content: string): boolean {
		// Protect code blocks
		if (content.includes("```") && content.split("```").length > 2) {
			return true;
		}

		// Protect file paths
		if (
			/\b(?:src|lib|extensions|tests?)\/[\w./\\-]+\.(?:ts|js|tsx|jsx)/.test(
				content,
			)
		) {
			return true;
		}

		// Protect error messages with stack traces
		if (content.includes("Error:") && content.includes("at ")) {
			return true;
		}

		return false;
	}

	/**
	 * Protect recent messages by token budget
	 */
	private protectRecentByTokenBudget(
		messages: Message[],
		tokenBudget: number,
	): Message[] {
		const protectedMsgs: Message[] = [];
		let protectedTokens = 0;

		// Walk backwards from most recent
		for (let i = messages.length - 1; i >= 0; i--) {
			const msgTokens = this.estimateTokens([messages[i]]);
			if (protectedTokens + msgTokens > tokenBudget) {
				break;
			}
			protectedTokens += msgTokens;
			protectedMsgs.unshift(messages[i]);
		}

		return protectedMsgs;
	}

	/**
	 * Graduated eviction — strip content in incremental levels.
	 *
	 * Each level removes progressively more content, re-checking the token
	 * budget after each pass. Stops as soon as the budget is satisfied.
	 *
	 * Levels:
	 *   1. STRIP_REASONING — Remove assistant thinking/reasoning blocks
	 *   2. STRIP_BULK_OUTPUT — Remove large tool outputs (>100 lines, >5000 chars)
	 *   3. STRIP_ARTIFACTS — Remove all non-error tool results
	 *   4. FULL_REMOVAL — Remove oldest non-protected messages (never user/system)
	 *
	 * @returns stats about what was stripped and at what level
	 */
	public evictGradually(
		messages: Message[],
		tokenBudget: number,
		maxLevel: EvictionLevel = EvictionLevel.FULL_REMOVAL,
	): { messages: Message[]; stats: EvictionStats } {
		if (!Array.isArray(messages) || messages.length === 0) {
			return {
				messages: [],
				stats: {
					messagesStripped: 0,
					tokensSaved: 0,
					levelUsed: EvictionLevel.STRIP_REASONING,
				},
			};
		}

		let current = [...messages];
		const currentTokens = this.estimateTokens(current);

		// Budget already satisfied — no eviction needed
		if (currentTokens <= tokenBudget) {
			return {
				messages: current,
				stats: {
					messagesStripped: 0,
					tokensSaved: 0,
					levelUsed: EvictionLevel.STRIP_REASONING,
				},
			};
		}

		let totalStripped = 0;

		// ── Level 1: Strip reasoning blocks from assistant messages ──────────
		if (maxLevel >= EvictionLevel.STRIP_REASONING) {
			const before = this.estimateTokens(current);
			current = this.stripReasoningBlocks(current);
			const after = this.estimateTokens(current);
			const saved = before - after;
			totalStripped += saved;

			if (after <= tokenBudget) {
				return {
					messages: current,
					stats: {
						messagesStripped: saved,
						tokensSaved: saved,
						levelUsed: EvictionLevel.STRIP_REASONING,
					},
				};
			}
		}

		// ── Level 2: Strip bulk tool outputs (>100 lines, >5000 chars) ──────
		if (maxLevel >= EvictionLevel.STRIP_BULK_OUTPUT) {
			const before = this.estimateTokens(current);
			current = this.stripBulkToolOutputs(current);
			const after = this.estimateTokens(current);
			const saved = before - after;
			totalStripped += saved;

			if (after <= tokenBudget) {
				return {
					messages: current,
					stats: {
						messagesStripped: saved,
						tokensSaved: saved,
						levelUsed: EvictionLevel.STRIP_BULK_OUTPUT,
					},
				};
			}
		}

		// ── Level 3: Strip all non-error tool outputs ────────────────────────
		if (maxLevel >= EvictionLevel.STRIP_ARTIFACTS) {
			const before = this.estimateTokens(current);
			current = this.stripArtifactToolOutputs(current);
			const after = this.estimateTokens(current);
			const saved = before - after;
			totalStripped += saved;

			if (after <= tokenBudget) {
				return {
					messages: current,
					stats: {
						messagesStripped: saved,
						tokensSaved: saved,
						levelUsed: EvictionLevel.STRIP_ARTIFACTS,
					},
				};
			}
		}

		// ── Level 4: Full message removal (oldest non-protected first) ────────
		if (maxLevel >= EvictionLevel.FULL_REMOVAL) {
			const before = this.estimateTokens(current);
			current = this.removeOldCompressibleMessages(current, tokenBudget);
			const after = this.estimateTokens(current);
			const saved = before - after;
			totalStripped += saved;

			return {
				messages: current,
				stats: {
					messagesStripped: saved,
					tokensSaved: saved,
					levelUsed: EvictionLevel.FULL_REMOVAL,
				},
			};
		}

		return {
			messages: current,
			stats: {
				messagesStripped: totalStripped,
				tokensSaved: totalStripped,
				levelUsed: maxLevel,
			},
		};
	}

	/**
	 * Strip reasoning/thinking blocks from assistant messages.
	 * Removes content where type === "thinking" from structured message content arrays.
	 */
	private stripReasoningBlocks(messages: Message[]): Message[] {
		return messages.map((msg) => {
			if (msg.role !== "assistant") return msg;
			if (!Array.isArray(msg.content)) return msg;

			const hasThinking = msg.content.some((b: any) => b?.type === "thinking");
			if (!hasThinking) return msg;

			const newContent = msg.content.filter((b: any) => b?.type !== "thinking");
			// If all content was thinking, keep a placeholder
			if (newContent.length === 0) {
				return { ...msg, content: "[reasoning stripped]" };
			}
			return { ...msg, content: newContent };
		});
	}

	/**
	 * Strip bulk tool outputs (large file reads, directory listings).
	 * Only targets outputs > 100 lines or > 5000 characters of plain text.
	 */
	private stripBulkToolOutputs(messages: Message[]): Message[] {
		return messages.map((msg) => {
			if (msg.role !== "tool") return msg;
			const content = messageContent(msg);

			// Only strip if it's genuinely large
			if (content.length < 5000) return msg;

			const lines = content.split("\n");

			// Check for directory-like output (many lines, each short)
			if (lines.length > 100) {
				const truncated = content.substring(0, 3000);
				return {
					...msg,
					content: `[tool output truncated: ${lines.length} lines, ${content.length} chars]\n${truncated}`,
				};
			}

			return msg;
		});
	}

	/**
	 * Strip all non-error tool outputs — replace with concise summaries.
	 * Preserves error messages (they're critical context for debugging).
	 */
	private stripArtifactToolOutputs(messages: Message[]): Message[] {
		return messages.map((msg) => {
			if (msg.role !== "tool") return msg;
			const content = messageContent(msg);

			// Preserve error outputs
			if (
				content.includes("Error:") ||
				content.includes("error:") ||
				content.includes("failed") ||
				content.includes("Failed") ||
				content.includes("exit code") ||
				content.includes("exit status") ||
				content.includes("SyntaxError") ||
				content.includes("TypeError")
			) {
				return msg;
			}

			// Determine what kind of output it was
			const lines = content.split("\n").length;
			const firstLine = content.split("\n")[0]?.substring(0, 80) || "";
			const shortSummary = firstLine.substring(0, 120);

			return {
				...msg,
				content: `[tool result stripped: ${lines} lines | ${shortSummary}${firstLine.length > 120 ? "…" : ""}]`,
			};
		});
	}

	/**
	 * Remove oldest non-protected, non-user messages until token budget is met.
	 * Never removes user or system messages (inviolable).
	 */
	private removeOldCompressibleMessages(
		messages: Message[],
		tokenBudget: number,
	): Message[] {
		// Separate into protected (keep) and candidates for removal
		const protectedMsgs: Message[] = [];
		const candidates: Message[] = [];

		for (const msg of messages) {
			if (msg.role === "user" || msg.role === "system") {
				protectedMsgs.push(msg);
			} else {
				// Check importance — keep high-importance messages
				const importance = this.calculateMessageImportance(msg);
				if (importance > 0.7) {
					protectedMsgs.push(msg);
				} else {
					candidates.push(msg);
				}
			}
		}

		// Keep removing from oldest until budget is satisfied
		const result = [...protectedMsgs];
		const initialTokens = this.estimateTokens(result);

		// Add back candidates from newest to oldest while staying under budget
		for (let i = candidates.length - 1; i >= 0; i--) {
			const candidateTokens = this.estimateTokens([candidates[i]]);
			if (initialTokens + candidateTokens <= tokenBudget) {
				result.push(candidates[i]);
				// Need to re-check budget with newly added message
			}
		}

		// Sort back to original order
		const keptIds = new Set(result.map((m) => m.id));
		return messages.filter((m) => keptIds.has(m.id));
	}

	/**
	 * Generate a summary from remaining messages after graduated eviction.
	 * Tries LLM summarization if configured, otherwise uses heuristic structured format.
	 */
	private async generateSummaryFromRemaining(
		compressible: Message[],
		protectedMsgs: Message[],
		previousSummary?: string,
	): Promise<string> {
		if (this.config.useLLM && typeof this.config.llmSummarize === "function") {
			const llmInput = compressible
				.map((m) => `[${m.role}] ${messageContent(m).substring(0, 500)}`)
				.join("\n---\n");
			try {
				const llmResult = await this.config.llmSummarize(llmInput);
				const header = previousSummary
					? `## Previous Context\n${previousSummary}\n\n`
					: "";
				return header + "## Summary\n" + llmResult;
			} catch {
				// Fallback to heuristic if LLM fails
			}
		}
		return this.generateStructuredSummary(
			compressible,
			protectedMsgs,
			previousSummary,
		);
	}

	/**
	 * Phase 3: Generate structured summary (compact format)
	 * Uses terse headers, skips empty sections, and avoids extra whitespace.
	 */
	private generateStructuredSummary(
		compressible: Message[],
		protectedMsgs: Message[],
		previousSummary?: string,
	): string {
		const sections: string[] = [];

		// Add previous summary if exists (iterative update)
		if (previousSummary) {
			sections.push("## Previous Context\n" + previousSummary);
		}

		// Extract from ALL messages (both compressible and protected)
		const allMessages = [...compressible, ...protectedMsgs];
		const goals = this.extractGoals(allMessages);
		const decisions = this.extractDecisions(allMessages);
		const errors = this.extractErrors(allMessages);
		const nextSteps = this.extractNextSteps(allMessages);
		const fileOps = this.extractFileOperations(allMessages);

		// Compact goals section
		if (goals.length > 0) {
			sections.push("## Goals\n- " + goals.join(" / "));
		}

		// Compact decisions section
		if (decisions.length > 0) {
			sections.push("## Decisions\n- " + decisions.join(" / "));
		}

		// Compact errors & solutions section
		if (errors.length > 0) {
			sections.push("## Errors\n- " + errors.join("\n- "));
		}

		// Compact file operations (single line with pipe separators)
		if (fileOps.read.length > 0 || fileOps.modified.length > 0) {
			const parts: string[] = [];
			if (fileOps.read.length > 0) {
				parts.push("R: " + fileOps.read.join(", "));
			}
			if (fileOps.modified.length > 0) {
				parts.push("M: " + fileOps.modified.join(", "));
			}
			sections.push("## Files\n- " + parts.join(" | "));
		}

		// Compact next steps section
		if (nextSteps.length > 0) {
			sections.push("## Next\n- " + nextSteps.join(" → "));
		}

		// Compact conversation summary
		const compressedConversation = this.compressConversation(compressible);
		if (compressible.length > 0 && compressedConversation) {
			sections.push(
				"## Chat" +
					(compressedConversation ? "\n" + compressedConversation : ""),
			);
		}

		return sections.join("\n\n");
	}

	/**
	 * Calculate message importance score (0-1)
	 */
	private calculateMessageImportance(message: Message): number {
		let maxWeight = 0;
		const text = messageContent(message);

		// Check keyword patterns
		for (const { pattern, weight } of IMPORTANCE_SIGNALS.keywords) {
			if (pattern.test(text)) {
				maxWeight = Math.max(maxWeight, weight);
			}
		}

		// Apply content multipliers
		if (text.includes("```")) {
			maxWeight *= IMPORTANCE_SIGNALS.contentMultipliers.codeBlock;
		}

		if (/\b[\w./\\-]+\.(?:ts|js|tsx|jsx|py|rs|go)\b/.test(text)) {
			maxWeight *= IMPORTANCE_SIGNALS.contentMultipliers.filePath;
		}

		if (message.role === "tool") {
			maxWeight *= IMPORTANCE_SIGNALS.contentMultipliers.toolCall;
		}

		if (text.includes("Error:") || text.includes("error")) {
			maxWeight *= IMPORTANCE_SIGNALS.contentMultipliers.errorLog;
		}

		// Decay for very long messages
		if (text.length > 2000) {
			maxWeight *= IMPORTANCE_SIGNALS.contentMultipliers.multiLine;
		}

		// Boost for tool calls
		if (message.role === "tool" || text.includes("```")) {
			maxWeight = Math.max(maxWeight, 0.5);
		}

		return Math.min(1, maxWeight);
	}

	/**
	 * Extract goals from messages
	 */
	private extractGoals(messages: Message[]): string[] {
		const goals: string[] = [];
		const goalPattern =
			/\b(?:GOAL|OBJECTIVE|TARGET|WANT TO|TRYING TO)\b:?\s*(.+)/i;

		for (const msg of messages) {
			const text = messageContent(msg);
			const match = text.match(goalPattern);
			if (match) {
				goals.push(match[1].trim());
			}
		}

		return [...new Set(goals)];
	}

	/**
	 * Extract decisions from messages
	 */
	private extractDecisions(messages: Message[]): string[] {
		const decisions: string[] = [];
		const decisionPattern = /\b(?:DECIDED|DECISION|CHOSE|SELECTED)\b:?\s*(.+)/i;

		for (const msg of messages) {
			const text = messageContent(msg);
			const match = text.match(decisionPattern);
			if (match) {
				decisions.push(match[1].trim());
			}
		}

		return [...new Set(decisions)];
	}

	/**
	 * Extract errors and solutions from messages
	 */
	private extractErrors(messages: Message[]): string[] {
		const errors: string[] = [];
		const errorPattern = /\b(?:ERROR|FAILED|BUG|ISSUE|PROBLEM)\b:?\s*(.+)/i;
		const solutionPattern = /\b(?:SOLUTION|FIX|RESOLVED|FIXED)\b:?\s*(.+)/i;

		for (const msg of messages) {
			const text = messageContent(msg);
			const errorMatch = text.match(errorPattern);
			const solutionMatch = text.match(solutionPattern);

			if (errorMatch) {
				const error = errorMatch[1].trim();
				const solution = solutionMatch ? solutionMatch[1].trim() : null;
				errors.push(solution ? `${error} → ${solution}` : error);
			}
		}

		return [...new Set(errors)];
	}

	/**
	 * Extract file operations from messages
	 */
	private extractFileOperations(messages: Message[]): {
		read: string[];
		modified: string[];
	} {
		if (!Array.isArray(messages)) {
			return { read: [], modified: [] };
		}

		const read: string[] = [];
		const modified: string[] = [];

		const readPatterns = [
			/\bread\s+(?:the\s+)?(?:file\s+)?(?:`|"|\u2018|\u2019)?([\w./\\-]+)(?:`|"|\u2018|\u2019)?(?:\b|\s|$)/gi,
			/\bread(?:ing)?\s+(?:the\s+)?(?:file\s+)?[`"']?([\w./\\-]+)[`"']?\b/gi,
		];

		const modifiedPatterns = [
			/\b(?:edit|write|update|change|create|add|fix|delete|remove|modify|modifies|modified)\s+(?:the\s+)?(?:file\s+)?(?:`|"|\u2018|\u2019)?([\w./\\-]+)(?:`|"|\u2018|\u2019)?(?:\b|\s|$)/gi,
			/\b(?:edit|write|update|change|create|add|fix|delete|remove|modify|modifies|modified)\s+\(?(?:path[=:])?[`"']?([\w./\\-]+)[`"']?\)?/gi,
		];

		for (const msg of messages) {
			const content = messageContent(msg);

			for (const pattern of readPatterns) {
				const matches = content.matchAll(pattern);
				for (const match of matches) {
					if (match[1]) read.push(match[1].trim());
				}
			}

			for (const pattern of modifiedPatterns) {
				const matches = content.matchAll(pattern);
				for (const match of matches) {
					if (match[1]) modified.push(match[1].trim());
				}
			}
		}

		return {
			read: [...new Set(read)],
			modified: [...new Set(modified)],
		};
	}

	/**
	 * Extract next steps from messages
	 */
	private extractNextSteps(messages: Message[]): string[] {
		const steps: string[] = [];
		const stepPattern = /\b(?:NEXT|TODO|SHOULD|PLAN TO|NEED TO)\b:?\s*(.+)/i;

		for (const msg of messages) {
			const text = messageContent(msg);
			const match = text.match(stepPattern);
			if (match) {
				steps.push(match[1].trim());
			}
		}

		return [...new Set(steps)].slice(0, 5);
	}

	/**
	 * Compress conversation into a summary
	 */
	private compressConversation(messages: Message[]): string {
		if (!Array.isArray(messages) || messages.length === 0) return "";

		const summary: string[] = [];
		let currentTopic = "";

		for (const msg of messages) {
			const text = messageContent(msg);
			const topic = this.extractTopic(text);
			if (topic && topic !== currentTopic) {
				currentTopic = topic;
				summary.push(`\n**${topic}**`);
			}

			const compressed = this.compressMessage(text);
			if (compressed) {
				summary.push(`- ${compressed}`);
			}
		}

		return summary.join("\n");
	}

	/**
	 * Extract topic from message content
	 */
	private extractTopic(content: string): string {
		const cleanContent = content.replace(/```[\s\S]*?```/g, "");
		const topicMatch = cleanContent.match(/(?:TOPIC|SUBJECT|ABOUT):?\s*(.+)/i);
		if (topicMatch) return topicMatch[1].trim();

		const firstSentence = cleanContent.split(/[.!?]/)[0];
		if (firstSentence && firstSentence.length < 100) {
			return firstSentence.trim();
		}

		return "";
	}

	/**
	 * Compress a single message
	 */
	private compressMessage(content: string): string {
		let compressed = content.replace(/```[\s\S]*?```/g, (match) => {
			const firstLine = match.split("\n")[1] || "";
			return `[code: ${firstLine.substring(0, 50)}]`;
		});

		compressed = compressed.replace(/\s+/g, " ").trim();

		if (compressed.length > 200) {
			compressed = compressed.substring(0, 197) + "...";
		}

		return compressed;
	}

	/**
	 * Estimate token count with content-type awareness.
	 *
	 * Uses different ratios based on content structure:
	 *   - Code blocks: ~3 chars/token (dense special characters)
	 *   - Mixed/structured: ~4 chars/token
	 *   - Plain prose: ~5 chars/token
	 *   - Whitespace-heavy: ~6 chars/token (tool outputs, tables)
	 */
	public estimateTokens(messages: Message[]): number {
		if (!Array.isArray(messages)) return 0;

		let total = 0;
		for (const msg of messages) {
			const text = messageContent(msg);
			const len = text.length;
			if (len === 0) continue;

			// Detect code blocks
			const codeBlockCount = (text.match(/```/g) || []).length;
			const hasCodeBlocks = codeBlockCount > 1;

			// Count non-whitespace characters
			const nonSpace = text.replace(/\s/g, "").length;
			const whitespaceRatio = nonSpace > 0 ? (len - nonSpace) / len : 0;

			// Select chars-per-token ratio based on content type
			let ratio: number;
			if (hasCodeBlocks) {
				ratio = 3.5; // Code is denser
			} else if (whitespaceRatio > 0.3) {
				ratio = 6; // Lots of whitespace (tables, logs)
			} else if (nonSpace / len > 0.85) {
				ratio = 3.5; // Dense text (code, keys)
			} else {
				ratio = 4.5; // Standard prose
			}

			total += Math.ceil(len / ratio);
		}
		return total;
	}

	/**
	 * Get compression history
	 */
	public getCompressionHistory(): Array<{
		timestamp: number;
		summary: string;
		tokensBefore: number;
		tokensAfter: number;
	}> {
		return [...this.compressionHistory];
	}

	/**
	 * Clear compression history
	 */
	public clearCompressionHistory(): void {
		this.compressionHistory = [];
	}
}
