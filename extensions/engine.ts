/**
 * Ultra-Compact Engine
 *
 * Advanced compaction engine with:
 * - Hierarchical summarization (summary of summaries)
 * - Entropy-based information extraction
 * - Critical context preservation
 * - Incremental compaction
 */

import type { CompactionResult, Message } from "./types";

/**
 * Normalize message content to string, handling both plain text and structured arrays.
 * Pi's AgentMessage content may be string or (TextContent | ImageContent)[].
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

/**
 * Comprehensive model context window sizes (in tokens)
 * Updated: June 2025
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
	// ==================== OPENAI ====================
	// GPT-5 Series (2025)
	"gpt-5": 400000,
	"gpt-5-pro": 400000,
	"gpt-5-mini": 400000,
	"gpt-5-nano": 400000,
	"gpt-5-codex": 400000,
	"gpt-5.1": 400000,
	"gpt-5.1-pro": 400000,
	"gpt-5.1-codex": 400000,
	"gpt-5.1-codex-max": 400000,
	"gpt-5.2": 400000,
	"gpt-5.2-pro": 400000,
	// GPT-4.1 Series (2025)
	"gpt-4.1": 1047576,
	"gpt-4.1-mini": 1047576,
	"gpt-4.1-nano": 1047576,
	// GPT-4o Series
	"gpt-4o": 128000,
	"gpt-4o-mini": 128000,
	"gpt-4o-all": 128000,
	// GPT-4 Legacy
	"gpt-4-turbo": 128000,
	"gpt-4-turbo-preview": 128000,
	"gpt-4": 8192,
	"gpt-4-32k": 32768,
	// GPT-3.5
	"gpt-3.5-turbo": 16385,
	"gpt-3.5-turbo-16k": 16385,
	// O-Series Reasoning
	o1: 200000,
	"o1-mini": 128000,
	"o1-preview": 128000,
	"o1-pro": 200000,
	o3: 200000,
	"o3-mini": 200000,
	"o3-pro": 200000,
	"o4-mini": 200000,
	// OpenAI OSS
	"gpt-oss-120b": 128000,
	"gpt-oss-20b": 128000,

	// ==================== ANTHROPIC ====================
	// Claude 4.5 Series (2025)
	"claude-4.5-opus": 200000,
	"claude-4.5-sonnet": 200000,
	// Claude 4.0 Series
	"claude-4.0-sonnet": 200000,
	// Claude 3.7
	"claude-3.7-sonnet": 200000,
	"claude-3.7-sonnet-extended": 1000000,
	// Claude 3.5 Series
	"claude-3.5-sonnet": 200000,
	"claude-3.5-haiku": 200000,
	// Claude 3 Series
	"claude-3-opus": 200000,
	"claude-3-sonnet": 200000,
	"claude-3-haiku": 200000,
	// Generic Claude
	"claude-opus": 200000,
	"claude-sonnet": 200000,
	"claude-haiku": 200000,

	// ==================== GOOGLE ====================
	// Gemini 2.5 Series (2025)
	"gemini-2.5-pro": 1000000,
	"gemini-2.5-pro-exp": 1000000,
	"gemini-2.5-flash": 1000000,
	"gemini-2.5-flash-lite": 1000000,
	// Gemini 2.0 Series
	"gemini-2.0-flash": 1000000,
	"gemini-2.0-flash-lite": 1000000,
	"gemini-2.0-pro": 2000000,
	// Gemini 1.5 Series
	"gemini-1.5-pro": 2000000,
	"gemini-1.5-flash": 1000000,
	"gemini-1.5-flash-8b": 1000000,
	// Gemini 1.0
	"gemini-pro": 32768,
	"gemini-pro-vision": 16384,
	// Gemma (Open Models)
	"gemma-3-27b": 128000,
	"gemma-3-12b": 128000,
	"gemma-3-4b": 32000,
	"gemma-2-27b": 8192,
	"gemma-2-9b": 8192,
	"gemma-2-2b": 8192,
	"gemma-7b": 8192,
	"gemma-2b": 2048,

	// ==================== DEEPSEEK ====================
	// DeepSeek V4 Series (2025)
	"deepseek-v4-pro": 1000000,
	"deepseek-v4": 128000,
	// DeepSeek V3 Series
	"deepseek-v3": 65536,
	"deepseek-v3-chat": 65536,
	"deepseek-v3-0324": 65536,
	// DeepSeek V2 Series
	"deepseek-v2.5": 131072,
	"deepseek-v2.5-1210": 131072,
	"deepseek-v2": 131072,
	"deepseek-v2-chat": 131072,
	// DeepSeek Coder
	"deepseek-coder-v2": 131072,
	"deepseek-coder": 131072,
	"deepseek-coder-33b": 16384,
	"deepseek-coder-6.7b": 16384,
	"deepseek-coder-1.3b": 4096,
	// DeepSeek Reasoner
	"deepseek-r1": 65536,
	"deepseek-r1-0528": 65536,
	"deepseek-reasoner": 65536,
	// DeepSeek LLM
	"deepseek-llm-67b-chat": 16384,
	"deepseek-llm-7b-chat": 4096,

	// ==================== META LLAMA ====================
	// Llama 4 Series (2025)
	"llama-4-maverick": 1000000,
	"llama-4-scout": 1000000,
	// Llama 3.3
	"llama-3.3-70b": 128000,
	"llama-3.3-70b-instruct": 128000,
	// Llama 3.1 Series
	"llama-3.1-405b": 128000,
	"llama-3.1-405b-instruct": 128000,
	"llama-3.1-70b": 128000,
	"llama-3.1-70b-instruct": 128000,
	"llama-3.1-8b": 128000,
	"llama-3.1-8b-instruct": 128000,
	"llama-3.1-4b": 128000,
	"llama-3.1-1b": 128000,
	// Llama 3 Series
	"llama-3-70b": 8192,
	"llama-3-70b-instruct": 8192,
	"llama-3-8b": 8192,
	"llama-3-8b-instruct": 8192,
	"llama-3-70b-chat": 8192,
	"llama-3-8b-chat": 8192,
	// Llama 2 Series
	"llama-2-70b": 4096,
	"llama-2-70b-chat": 4096,
	"llama-2-13b": 4096,
	"llama-2-13b-chat": 4096,
	"llama-2-7b": 4096,
	"llama-2-7b-chat": 4096,
	// Llama Legacy
	"llama-70b": 2048,
	"llama-13b": 2048,
	"llama-7b": 2048,

	// ==================== MISTRAL ====================
	// Mistral Medium Series (2025)
	"mistral-medium-3.5": 128000,
	"mistral-medium-3.1": 128000,
	"mistral-medium-3": 128000,
	"mistral-medium": 32000,
	// Mistral Large Series
	"mistral-large-3": 128000,
	"mistral-large-2.1": 128000,
	"mistral-large-2.0": 128000,
	"mistral-large": 32000,
	// Mistral Small Series
	"mistral-small-4": 128000,
	"mistral-small-3.2": 128000,
	"mistral-small-3.1": 128000,
	"mistral-small-3.0": 32000,
	"mistral-small-2.0": 32000,
	"mistral-small": 32000,
	// Ministral Series
	"ministral-3-14b": 128000,
	"ministral-3-8b": 128000,
	"ministral-3-3b": 128000,
	"ministral-8b": 32000,
	"ministral-3b": 32000,
	// Mistral Nemo
	"mistral-nemo-12b": 128000,
	"mistral-nemo": 128000,
	// Codestral
	codestral: 256000,
	"codestral-25-08": 256000,
	"codestral-mamba-7b": 256000,
	// Pixtral
	"pixtral-large": 128000,
	"pixtral-12b": 128000,
	// Devstral
	"devstral-2": 128000,
	"devstral-small-2": 128000,
	"devstral-medium": 128000,
	"devstral-small": 128000,
	// Magistral
	"magistral-medium-1.2": 128000,
	"magistral-small-1.2": 128000,
	"magistral-medium-1.1": 128000,
	"magistral-small-1.1": 128000,
	"magistral-medium-1.0": 128000,
	"magistral-small-1.0": 128000,
	// Mixtral
	"mixtral-8x22b": 65536,
	"mixtral-8x7b": 32768,
	// Mistral Legacy
	"mistral-7b": 32000,
	"mistral-tiny": 32000,
	"mistral-7b-instruct": 32000,

	// ==================== QWEN (Alibaba) ====================
	// Qwen3 Series (2025)
	"qwen3-235b-a22b": 128000,
	"qwen3-30b-a3b": 128000,
	"qwen3-32b": 128000,
	"qwen3-14b": 128000,
	"qwen3-8b": 128000,
	"qwen3-4b": 32000,
	"qwen3-1.7b": 32000,
	"qwen3-0.6b": 32000,
	// Qwen2.5 Series
	"qwen2.5-72b-instruct": 128000,
	"qwen2.5-32b-instruct": 128000,
	"qwen2.5-14b-instruct": 128000,
	"qwen2.5-7b-instruct": 128000,
	"qwen2.5-3b-instruct": 128000,
	"qwen2.5-coder-32b": 128000,
	"qwen2.5-coder-14b": 128000,
	"qwen2.5-coder-7b": 128000,
	"qwen2.5-coder-3b": 128000,
	"qwen2.5-math-72b": 128000,
	"qwen2.5-math-7b": 128000,
	"qwen2.5-72b": 128000,
	"qwen2.5-32b": 128000,
	"qwen2.5-14b": 128000,
	"qwen2.5-7b": 128000,
	"qwen2.5-3b": 128000,
	// Qwen2 Series
	"qwen2-72b-instruct": 128000,
	"qwen2-7b-instruct": 128000,
	"qwen2-72b": 128000,
	"qwen2-7b": 32768,
	// Qwen Legacy
	"qwen-72b": 32768,
	"qwen-14b": 8192,
	"qwen-7b": 8192,
	"qwen-1.8b": 8192,
	// Qwen-Plus/Max/Turbo (API)
	"qwen-plus": 128000,
	"qwen-max": 32000,
	"qwen-turbo": 128000,

	// ==================== MICROSOFT PHI ====================
	// Phi-4 Series
	"phi-4": 16384,
	"phi-4-mini": 8192,
	"phi-4-reasoning": 32768,
	// Phi-3 Series
	"phi-3-medium-128k": 128000,
	"phi-3-medium": 4096,
	"phi-3-small-128k": 128000,
	"phi-3-small": 8192,
	"phi-3-mini-128k": 128000,
	"phi-3-mini": 4096,
	// Phi-2
	"phi-2": 2048,
	// Phi-1
	"phi-1": 2048,
	"phi-1.5": 2048,

	// ==================== COHERE ====================
	"command-r-plus-08-2024": 128000,
	"command-r-plus": 128000,
	"command-r": 128000,
	"command-light": 4096,
	command: 2048,

	// ==================== YI (01.AI) ====================
	"yi-1.5-34b-chat": 200000,
	"yi-1.5-9b-chat": 200000,
	"yi-1.5-6b-chat": 200000,
	"yi-34b-chat": 200000,
	"yi-6b-chat": 200000,
	"yi-34b": 4096,
	"yi-6b": 4096,

	// ==================== BAAI ====================
	"bge-large-en-v1.5": 512,
	"bge-base-en-v1.5": 512,
	"bge-small-en-v1.5": 512,

	// ==================== NVIDIA ====================
	"nemotron-4-340b": 4096,
	"nemotron-4-340b-instruct": 4096,

	// ==================== XAI (Grok) ====================
	"grok-3": 131072,
	"grok-3-mini": 131072,
	"grok-2": 131072,
	"grok-2-mini": 131072,
	"grok-1": 8192,

	// ==================== INFLECTION ====================
	"pi-1": 8192,
	"pi-2": 8192,

	// ==================== ALIBABA QWEN (API) ====================
	"qwen-long": 10000000,

	// ==================== DEFAULT ====================
	default: 128000,
};

/** Weight factors for information importance */
const IMPORTANCE_WEIGHTS = {
	goal: 1.0,
	decision: 0.9,
	error: 0.85,
	discovery: 0.8,
	constraint: 0.75,
	file_path: 0.7,
	code_change: 0.6,
	conversation: 0.3,
};

/** Patterns to detect important information */
const CRITICAL_PATTERNS = [
	{
		pattern: /(?:GOAL|OBJECTIVE|TARGET):?\s*(.+)/i,
		weight: IMPORTANCE_WEIGHTS.goal,
	},
	{
		pattern: /(?:DECISION|DECIDED|CHOSE):?\s*(.+)/i,
		weight: IMPORTANCE_WEIGHTS.decision,
	},
	{
		pattern: /(?:ERROR|FAILED|BUG|ISSUE):?\s*(.+)/i,
		weight: IMPORTANCE_WEIGHTS.error,
	},
	{
		pattern: /(?:DISCOVERED|FOUND|LEARNED|INSIGHT):?\s*(.+)/i,
		weight: IMPORTANCE_WEIGHTS.discovery,
	},
	{
		pattern: /(?:CONSTRAINT|REQUIREMENT|REQUIRED|CONSTRAINED):?\s*(.+)/i,
		weight: IMPORTANCE_WEIGHTS.constraint,
	},
	{
		pattern: /(?:FILE|PATH|DIRECTORY):?\s*(.+)/i,
		weight: IMPORTANCE_WEIGHTS.file_path,
	},
	{
		pattern: /(?:ADDED|REMOVED|MODIFIED|CHANGED|UPDATED):?\s*(.+)/i,
		weight: IMPORTANCE_WEIGHTS.code_change,
	},
];

/**
 * Ultra-Compact Engine class
 */
export class UltraCompactEngine {
	private config: {
		thresholdTokens: number;
		keepPercentage: number;
		maxKeepTokens: number;
		modelName?: string;
	};

	private contextWindow: number;

	constructor(config: Partial<UltraCompactEngine["config"]> = {}) {
		this.config = {
			thresholdTokens: config.thresholdTokens ?? 100000,
			keepPercentage: config.keepPercentage ?? 0.3,
			maxKeepTokens: config.maxKeepTokens ?? 30000,
			modelName: config.modelName,
		};

		// Auto-detect context window from model name
		this.contextWindow = this.detectContextWindow(this.config.modelName);

		// If no custom threshold provided, use 80% of context window
		if (!config.thresholdTokens) {
			this.config.thresholdTokens = Math.floor(this.contextWindow * 0.8);
		}
	}

	/**
	 * Detect context window size from model name
	 */
	private detectContextWindow(modelName?: string): number {
		if (!modelName) return MODEL_CONTEXT_WINDOWS["default"];

		const normalized = modelName.toLowerCase();

		// Check for exact match
		if (MODEL_CONTEXT_WINDOWS[normalized]) {
			return MODEL_CONTEXT_WINDOWS[normalized];
		}

		// Check for partial match
		for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
			if (normalized.includes(key) || key.includes(normalized)) {
				return value;
			}
		}

		return this.detectFromFamily(normalized);
	}

	private detectFromFamily(normalized: string): number {
		const familyDefaults: [string, number][] = [
			["claude", 200000],
			["gpt-4o", 128000],
			["gpt-4", 8192],
			["gemini", 1000000],
			["deepseek", 128000],
			["llama", 128000],
			["mistral", 128000],
		];

		for (const [family, defaultWindow] of familyDefaults) {
			if (normalized.includes(family)) return defaultWindow;
		}

		return MODEL_CONTEXT_WINDOWS["default"];
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
	 * Check if compaction is needed based on token count
	 */
	public shouldCompact(currentTokens: number): boolean {
		return currentTokens > this.config.thresholdTokens;
	}

	/**
	 * Get the effective threshold used by shouldCompact (for logging)
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
	 */
	public generateSummary(
		messages: Message[],
		previousSummary?: string,
	): CompactionResult {
		// Extract critical information
		const { critical, compressible } = this.extractCriticalInfo(messages);

		// Build summary sections
		const sections: string[] = [];

		// Add previous summary if exists
		if (previousSummary) {
			sections.push("## Previous Context\n" + previousSummary);
		}

		// Extract and add sections
		this.addGoalsSection(sections, critical);
		this.addDecisionsSection(sections, critical);
		this.addErrorsSection(sections, critical);
		this.addFileOperationsSection(sections, messages);
		this.addNextStepsSection(sections, critical);

		// Summarize compressible content
		const compressedSummary = this.compressConversation(compressible);
		if (compressedSummary) {
			sections.push("## Conversation Summary\n" + compressedSummary);
		}

		const summary = sections.join("\n\n");

		// Calculate metrics
		const tokensBefore = this.estimateTokens(messages);
		const tokensAfter = this.estimateTokens([
			{
				id: "summary",
				role: "system",
				content: summary,
				timestamp: Date.now(),
			},
		]);

		const fileOps = this.extractFileOperations(messages);

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

	private addGoalsSection(sections: string[], critical: Message[]): void {
		const goals = this.extractGoals(critical);
		if (goals.length > 0) {
			sections.push("## Goals\n" + goals.map((g) => `- ${g}`).join("\n"));
		}
	}

	private addDecisionsSection(sections: string[], critical: Message[]): void {
		const decisions = this.extractDecisions(critical);
		if (decisions.length > 0) {
			sections.push(
				"## Key Decisions\n" + decisions.map((d) => `- ${d}`).join("\n"),
			);
		}
	}

	private addErrorsSection(sections: string[], critical: Message[]): void {
		const errors = this.extractErrors(critical);
		if (errors.length > 0) {
			sections.push(
				"## Errors & Solutions\n" + errors.map((e) => `- ${e}`).join("\n"),
			);
		}
	}

	private addFileOperationsSection(
		sections: string[],
		messages: Message[],
	): void {
		const fileOps = this.extractFileOperations(messages);
		if (fileOps.read.length > 0 || fileOps.modified.length > 0) {
			sections.push("## File Operations");
			if (fileOps.read.length > 0) {
				sections.push("Read:\n" + fileOps.read.map((f) => `- ${f}`).join("\n"));
			}
			if (fileOps.modified.length > 0) {
				sections.push(
					"Modified:\n" + fileOps.modified.map((f) => `- ${f}`).join("\n"),
				);
			}
		}
	}

	private addNextStepsSection(sections: string[], critical: Message[]): void {
		const nextSteps = this.extractNextSteps(critical);
		if (nextSteps.length > 0) {
			sections.push(
				"## Next Steps\n" +
					nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
			);
		}
	}

	/**
	 * Calculate message importance score (0-1)
	 */
	private calculateMessageImportance(message: Message): number {
		let maxWeight = 0;
		const text = messageContent(message);

		for (const { pattern, weight } of CRITICAL_PATTERNS) {
			if (pattern.test(text)) {
				maxWeight = Math.max(maxWeight, weight);
			}
		}

		// Boost for tool calls (contain actions)
		if (message.role === "tool" || text.includes("```")) {
			maxWeight = Math.max(maxWeight, 0.5);
		}

		// Decay for long conversations
		if (text.length > 1000) {
			maxWeight *= 0.8;
		}

		return maxWeight;
	}

	/**
	 * Extract goals from messages
	 */
	private extractGoals(messages: Message[]): string[] {
		const goals: string[] = [];
		const goalPattern = /(?:GOAL|OBJECTIVE|TARGET|WANT TO|TRYING TO):?\s*(.+)/i;

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
		const decisionPattern =
			/(?:DECIDED|DECISION|CHOSE|SELECTED|WILL USE):?\s*(.+)/i;

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
		const errorPattern = /(?:ERROR|FAILED|BUG|ISSUE|PROBLEM):?\s*(.+)/i;
		const solutionPattern = /(?:SOLUTION|FIX|RESOLVED|FIXED):?\s*(.+)/i;

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
	 *
	 * Matches patterns found in Pi conversation text:
	 * - "read path/to/file.ext" or "I read path/to/file"
	 * - "edit path/to/file.ext" or "I modified path/to/file"
	 * - bash code blocks referencing file paths
	 */
	private extractFileOperations(messages: Message[]): {
		read: string[];
		modified: string[];
	} {
		const read: string[] = [];
		const modified: string[] = [];

		// Patterns that match READ operations in conversation text
		const readPatterns = [
			/\bread\s+(?:the\s+)?(?:file\s+)?(?:`|"|\u2018|\u2019)?([\w./\\-]+)(?:`|"|\u2018|\u2019)?(?:\b|\s|$)/gi,
			/\bread(?:ing)?\s+(?:the\s+)?(?:file\s+)?[`"']?([\w./\\-]+)[`"']?\b/gi,
			/\bread\s*\{?\s*path\s*[=:]\s*["']?([\w./\\-]+)["']?\s*\}?/gi,
		];

		// Patterns that match WRITE/EDIT operations in conversation text
		const modifiedPatterns = [
			/\b(?:edit|write|update|change|create|add|fix|delete|remove)\s+(?:the\s+)?(?:file\s+)?(?:`|"|\u2018|\u2019)?([\w./\\-]+)(?:`|"|\u2018|\u2019)?(?:\b|\s|$)/gi,
			/\b(?:edit|write|update|change|create|add|fix|delete|remove)\s+\(?(?:path[=:])?[`"']?([\w./\\-]+)[`"']?\)?/gi,
		];

		for (const msg of messages) {
			const content = messageContent(msg);

			// Match read patterns
			for (const pattern of readPatterns) {
				const matches = content.matchAll(pattern);
				for (const match of matches) {
					if (match[1]) read.push(match[1].trim());
				}
			}

			// Match write/edit patterns
			for (const pattern of modifiedPatterns) {
				const matches = content.matchAll(pattern);
				for (const match of matches) {
					if (match[1]) modified.push(match[1].trim());
				}
			}

			// Extract bash commands that modify files (from code blocks)
			const bashMatches = content.matchAll(/```(?:bash)?\s*\n?([\s\S]*?)```/gi);
			for (const match of bashMatches) {
				const cmd = match[1];
				if (
					cmd.includes(" > ") ||
					cmd.includes(" >> ") ||
					cmd.includes("mv ") ||
					cmd.includes("rm ")
				) {
					modified.push(cmd);
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
		const stepPattern = /(?:NEXT|TODO|SHOULD|WILL|PLAN TO|NEED TO):?\s*(.+)/i;

		for (const msg of messages) {
			const text = messageContent(msg);
			const match = text.match(stepPattern);
			if (match) {
				steps.push(match[1].trim());
			}
		}

		return [...new Set(steps)].slice(0, 5); // Limit to 5 next steps
	}

	/**
	 * Compress conversation into a summary
	 */
	private compressConversation(messages: Message[]): string {
		if (messages.length === 0) return "";

		const summary: string[] = [];
		let currentTopic = "";

		for (const msg of messages) {
			const text = messageContent(msg);
			// Extract topic from message
			const topic = this.extractTopic(text);
			if (topic && topic !== currentTopic) {
				currentTopic = topic;
				summary.push(`\n**${topic}**`);
			}

			// Add compressed version of message
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
		// Look for explicit topic markers
		const topicMatch = content.match(/(?:TOPIC|SUBJECT|ABOUT):?\s*(.+)/i);
		if (topicMatch) return topicMatch[1].trim();

		// Use first sentence as topic
		const firstSentence = content.split(/[.!?]/)[0];
		if (firstSentence && firstSentence.length < 100) {
			return firstSentence.trim();
		}

		return "";
	}

	/**
	 * Compress a single message
	 */
	private compressMessage(content: string): string {
		// Remove code blocks (keep first line only)
		let compressed = content.replace(/```[\s\S]*?```/g, (match) => {
			const firstLine = match.split("\n")[1] || "";
			return `\`code: ${firstLine.substring(0, 50)}\``;
		});

		// Remove excessive whitespace
		compressed = compressed.replace(/\s+/g, " ").trim();

		// Truncate if too long
		if (compressed.length > 200) {
			compressed = compressed.substring(0, 197) + "...";
		}

		return compressed;
	}

	/**
	 * Estimate token count (rough approximation)
	 */
	private estimateTokens(messages: Message[]): number {
		let total = 0;
		for (const msg of messages) {
			// Rough estimate: 1 token per 4 characters
			total += Math.ceil(messageContent(msg).length / 4);
		}
		return total;
	}
}
