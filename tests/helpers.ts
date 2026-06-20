/**
 * Shared test helpers for pi-ultra-compact tests.
 */

import type { Message } from "../extensions/types";

/**
 * Create a test message with positional args (id, role, content).
 */
export function makeMsg(
	id: string,
	role: string,
	content: string,
): Message {
	return { id, role: role as any, content, timestamp: Date.now() };
}

/**
 * Create a test message with structured content blocks.
 */
export function makeStructuredMsg(
	id: string,
	role: string,
	blocks: { type: string; text?: string }[],
): Message {
	return {
		id,
		role: role as any,
		content: blocks as any,
		timestamp: Date.now(),
	};
}

/**
 * Create a test message from partial overrides (defaults to user role).
 */
export function makeMsgFrom(
	overrides: Partial<Message> & { content: string },
): Message {
	return {
		id: `msg-${Math.random().toString(36).slice(2, 8)}`,
		role: "user",
		timestamp: Date.now(),
		...overrides,
	};
}
