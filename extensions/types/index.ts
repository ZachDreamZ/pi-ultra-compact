/**
 * Types for pi-ultra-compact extension
 */

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

/** Entry for tracking compaction history */
export interface CompactionEntry {
	id: string;
	timestamp: number;
	summary: string;
	tokensBefore: number;
	tokensAfter: number;
	compressionRatio: number;
}

/** Message structure for Pi sessions */
export interface Message {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
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
