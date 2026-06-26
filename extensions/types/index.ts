/**
 * Types for pi-ultra-compact extension
 */

/** Eviction levels for graduated content stripping */
export enum EvictionLevel {
	/** Remove assistant thinking/reasoning blocks */
	STRIP_REASONING = 1,
	/** Remove large tool outputs (directory listings, grep results) */
	STRIP_BULK_OUTPUT = 2,
	/** Remove all non-error tool results */
	STRIP_ARTIFACTS = 3,
	/** Remove entire non-protected messages */
	FULL_REMOVAL = 4,
}

/** Stats from an eviction pass */
export interface EvictionStats {
	/** How many messages were modified */
	messagesStripped: number;
	/** Tokens saved by eviction */
	tokensSaved: number;
	/** The highest eviction level that was needed (1-4) */
	levelUsed: EvictionLevel;
}

/** Configuration for ultra-compact compaction */
export interface UltraCompactConfig {
	/** Token threshold to trigger automatic compaction */
	thresholdTokens?: number;
	/** Percentage of context to keep (0.0 - 1.0) */
	keepPercentage?: number;
	/** Maximum tokens to keep after compaction */
	maxKeepTokens?: number;
	/** Enable automatic compaction */
	autoCompact?: boolean;
	/** Custom prompt for summarization */
	customPrompt?: string;
	/** Minimum messages required for structured summary (avoids bloat) */
	minMessagesForCompression?: number;
	/** Use Pi's model for smart LLM summarization (optional) */
	useLLM?: boolean;
	/** Max eviction aggressiveness (graduated eviction cap, default FULL_REMOVAL) */
	maxEvictionLevel?: EvictionLevel;
	/** Enable cache-aware compaction (immutable prefix, append-only summaries) */
	cacheAware?: boolean;
	/** Soft watermark for preemptive compaction (default 0.70 = 70%) */
	preemptiveWatermark?: number;
	/**
	 * Hard cap on context usage (0-1). Compaction fires when tokens reach this
	 * fraction of the context window, even if the percentage threshold hasn't
	 * been hit. Default: 0.5 (50%). Set lower for smaller models.
	 */
	hardWatermark?: number;
	/** Tokens to reserve for model output during preemptive check */
	outputHeadroom?: number;
	/** Max failures before circuit breaker trips (default 3) */
	circuitBreakerMaxFailures?: number;
	/** Turns before circuit breaker resets (default 5) */
	circuitBreakerCooldown?: number;
}

/** Result of a compaction operation */
export interface CompactionResult {
	/** The generated summary */
	summary: string;
	/** Number of tokens before compaction */
	tokensBefore: number;
	/** Estimated tokens after compaction */
	tokensAfter: number;
	/** Compression ratio achieved */
	compressionRatio: number;
	/** Files that were read during the session */
	readFiles: string[];
	/** Files that were modified during the session */
	modifiedFiles: string[];
	/** Timestamp of the compaction */
	timestamp: number;
}

/** Tier of compaction to perform */
export enum CompactionTier {
	/** No compaction needed */
	NONE = 0,
	/** Fast tool-output pruning only (no LLM) */
	MICRO = 1,
	/** Full structured summarization */
	FULL = 2,
}

/** Stats from a micro-compaction pass */
export interface MicroCompactStats {
	tokensSaved: number;
	messagesStripped: number;
	filesCollapsed: string[];
}

/** State for the circuit breaker mechanism */
export interface CircuitBreakerState {
	failures: number;
	trippedAtTurn: number;
	turn: number;
}

/** Entry for tracking compaction history */
export interface CompactionEntry {
	id: string;
	timestamp: number;
	summary: string;
	tokensBefore: number;
	tokensAfter: number;
	compressionRatio: number;
}

/** Text content block in Pi messages */
export interface TextContent {
	type: "text";
	text: string;
}

/** Image content block in Pi messages */
export interface ImageContent {
	type: "image";
	source?: { type: "base64"; media_type: string; data: string };
}

/** Message structure for Pi sessions */
export interface Message {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string | (TextContent | ImageContent)[];
	timestamp: number;
	tokens?: number;
}

/** Session context for compaction */
export interface SessionContext {
	messages: Message[];
	currentTokens: number;
	maxTokens: number;
	summary?: string;
}

// ─── Pi Extension API Types ────────────────────────────────────────────────

/** Model information from Pi runtime context */
export interface PiModel {
	id: string;
	contextWindow?: number;
}

/** UI notification helpers from Pi context */
export interface PiUI {
	notify?: (message: string, level: "info" | "warn" | "error") => void;
}

/** Pi runtime context passed to event handlers */
export interface PiContext {
	model?: PiModel;
	ui?: PiUI;
}

/** Preparation object passed in the before_compact event */
export interface CompactPreparation {
	tokensBefore: number;
	messagesToSummarize: Message[];
	firstKeptEntryId?: string;
	previousSummary?: string;
}

/** before_compact event payload */
export interface BeforeCompactEvent {
	preparation?: CompactPreparation;
	customInstructions?: string;
}

/** model_select event payload */
export interface ModelSelectEvent {
	models?: Array<{ id: string; contextWindow?: number }>;
}

/** Pi extension registration helpers */
export interface PiExtensionAPI {
	on: (event: string, handler: (...args: unknown[]) => unknown) => void;
	commands?: {
		register: (name: string, handler: (...args: unknown[]) => unknown) => void;
	};
}
