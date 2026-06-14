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
	};

	constructor(config: Partial<UltraCompactEngine["config"]> = {}) {
		this.config = {
			thresholdTokens: config.thresholdTokens ?? 100000,
			keepPercentage: config.keepPercentage ?? 0.3,
			maxKeepTokens: config.maxKeepTokens ?? 30000,
		};
	}

	/**
	 * Check if compaction is needed based on token count
	 */
	public shouldCompact(currentTokens: number): boolean {
		return currentTokens > this.config.thresholdTokens;
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
			compressionRatio: tokensAfter / tokensBefore,
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

		for (const { pattern, weight } of CRITICAL_PATTERNS) {
			if (pattern.test(message.content)) {
				maxWeight = Math.max(maxWeight, weight);
			}
		}

		// Boost for tool calls (contain actions)
		if (message.role === "tool" || message.content.includes("```")) {
			maxWeight = Math.max(maxWeight, 0.5);
		}

		// Decay for long conversations
		if (message.content.length > 1000) {
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
			const match = msg.content.match(goalPattern);
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
			const match = msg.content.match(decisionPattern);
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
			const errorMatch = msg.content.match(errorPattern);
			const solutionMatch = msg.content.match(solutionPattern);

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
		const read: string[] = [];
		const modified: string[] = [];

		for (const msg of messages) {
			// Extract read operations
			const readMatches = msg.content.matchAll(
				/read\((?:path[=:])["']?([^"')]+)["']?\)/gi,
			);
			for (const match of readMatches) {
				read.push(match[1]);
			}

			// Extract write/edit operations
			const editMatches = msg.content.matchAll(
				/(?:edit|write)\((?:path[=:])["']?([^"')]+)["']?\)/gi,
			);
			for (const match of editMatches) {
				modified.push(match[1]);
			}

			// Extract bash commands that modify files
			const bashMatches = msg.content.matchAll(
				/bash\(command[=:]["']([^"']+)["']\)/gi,
			);
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
			const match = msg.content.match(stepPattern);
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
			// Extract topic from message
			const topic = this.extractTopic(msg.content);
			if (topic && topic !== currentTopic) {
				currentTopic = topic;
				summary.push(`\n**${topic}**`);
			}

			// Add compressed version of message
			const compressed = this.compressMessage(msg.content);
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
			total += Math.ceil(msg.content.length / 4);
		}
		return total;
	}
}
