/**
 * Shared utilities for pi-ultra-compact
 *
 * Centralizes duplicated logic: message content extraction, pattern-based
 * information extraction, error detection, and result construction.
 */

import type { CompactionResult, Message, TextContent } from "./types";

/**
 * Normalize message content to string, handling both plain text and structured arrays.
 */
export function messageContent(msg: Message): string {
	const c = msg.content;
	if (typeof c === "string") return c;
	if (Array.isArray(c)) {
		return c
			.filter((block): block is TextContent => block?.type === "text")
			.map((block) => block.text ?? "")
			.join(" ");
	}
	return String(c ?? "");
}

/**
 * Shared keyword patterns used for both importance scoring and information extraction.
 * Each entry maps a category to its regex and weight.
 */
export const KEYWORD_PATTERNS = {
	goal: {
		pattern: /\b(?:GOAL|OBJECTIVE|TARGET|WANT TO|TRYING TO)\b:?\s*(.+)/i,
		weight: 1.0,
	},
	decision: {
		pattern: /\b(?:DECISION|DECIDED|CHOSE|SELECTED)\b:?\s*(.+)/i,
		weight: 0.95,
	},
	error: {
		pattern: /\b(?:ERROR|FAILED|BUG|ISSUE|PROBLEM|CRASH)\b:?\s*(.+)/i,
		weight: 0.9,
	},
	solution: {
		pattern: /\b(?:SOLUTION|FIX|RESOLVED|FIXED|WORKAROUND)\b:?\s*(.+)/i,
		weight: 0.85,
	},
	discovery: {
		pattern: /\b(?:DISCOVERED|FOUND|LEARNED|INSIGHT|REALIZED)\b:?\s*(.+)/i,
		weight: 0.8,
	},
	constraint: {
		pattern: /\b(?:CONSTRAINT|REQUIREMENT|REQUIRED|MUST)\b:?\s*(.+)/i,
		weight: 0.75,
	},
	file: {
		pattern: /\b(?:FILE|PATH|DIRECTORY|MODULE)\b:?\s*(.+)/i,
		weight: 0.7,
	},
	change: {
		pattern:
			/\b(?:ADDED|REMOVED|MODIFIED|CHANGED|UPDATED|CREATED|DELETED)\b:?\s*(.+)/i,
		weight: 0.65,
	},
	next: {
		pattern: /\b(?:TODO|NEXT|SHOULD|PLAN TO|NEED TO)\b:?\s*(.+)/i,
		weight: 0.6,
	},
} as const;

export type KeywordCategory = keyof typeof KEYWORD_PATTERNS;

/**
 * Extract matching text from messages for a given keyword category.
 * Returns deduplicated results.
 */
export function extractByPattern(
	messages: Message[],
	category: KeywordCategory,
): string[] {
	const { pattern } = KEYWORD_PATTERNS[category];
	const results: string[] = [];

	for (const msg of messages) {
		const text = messageContent(msg);
		const match = text.match(pattern);
		if (match) {
			results.push(match[1].trim());
		}
	}

	return [...new Set(results)];
}

/**
 * Check if content contains error indicators.
 * Used by both tool output stripping and summarization.
 */
export function containsErrorIndicators(content: string): boolean {
	return (
		content.includes("Error:") ||
		content.includes("error:") ||
		content.includes("failed") ||
		content.includes("Failed") ||
		content.includes("exit code") ||
		content.includes("exit status") ||
		content.includes("SyntaxError") ||
		content.includes("TypeError")
	);
}

/**
 * Create an empty CompactionResult with default values.
 */
export function emptyCompactionResult(
	previousSummary?: string,
): CompactionResult {
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
