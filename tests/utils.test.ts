/**
 * Tests for shared utilities (extensions/utils.ts)
 *
 * Covers extractByPattern, containsErrorIndicators, emptyCompactionResult,
 * and edge-case paths in messageContent.
 */

import { describe, it, expect } from "vitest";
import {
  messageContent,
  extractByPattern,
  containsErrorIndicators,
  emptyCompactionResult,
  KEYWORD_PATTERNS,
} from "../extensions/utils";
import type { Message } from "../extensions/types";

describe("messageContent", () => {
  it("returns plain string content as-is", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: "hello world",
      timestamp: 1,
    };
    expect(messageContent(msg)).toBe("hello world");
  });

  it("extracts text from structured content blocks", () => {
    const msg: Message = {
      id: "1",
      role: "assistant",
      content: [
        { type: "thinking", text: "Let me think..." },
        { type: "text", text: "Here is my answer" },
        { type: "text", text: "With more detail" },
      ],
      timestamp: 1,
    };
    const result = messageContent(msg);
    expect(result).toContain("Here is my answer");
    expect(result).toContain("With more detail");
    expect(result).not.toContain("Let me think");
  });

  it("filters out non-text blocks from structured content", () => {
    const msg: Message = {
      id: "1",
      role: "tool",
      content: [
        { type: "image", url: "img.png" },
        { type: "text", text: "result data" },
        { type: "tool_use", name: "search" },
      ],
      timestamp: 1,
    };
    const result = messageContent(msg);
    expect(result).toContain("result data");
    expect(result).not.toContain("img.png");
    expect(result).not.toContain("search");
  });

  it("handles empty structured content array", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: [],
      timestamp: 1,
    };
    expect(messageContent(msg)).toBe("");
  });

  it("handles structured blocks with missing text field", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: [{ type: "text" } as any, { type: "text", text: "valid" }],
      timestamp: 1,
    };
    const result = messageContent(msg);
    expect(result).toContain("valid");
  });

  it("coerces numeric content to string", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: 42 as any,
      timestamp: 1,
    };
    expect(messageContent(msg)).toBe("42");
  });

  it("coerces null content to empty string", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: null as any,
      timestamp: 1,
    };
    expect(messageContent(msg)).toBe("");
  });

  it("coerces undefined content to empty string", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: undefined as any,
      timestamp: 1,
    };
    expect(messageContent(msg)).toBe("");
  });

  it("coerces boolean content to string", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: true as any,
      timestamp: 1,
    };
    expect(messageContent(msg)).toBe("true");
  });

  it("coerces object content to string", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: { key: "val" } as any,
      timestamp: 1,
    };
    expect(messageContent(msg)).toBe("[object Object]");
  });
});

describe("extractByPattern", () => {
  it("extracts goal statements from messages", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "GOAL: Build a web app", timestamp: 1 },
      { id: "2", role: "user", content: "OBJECTIVE: Test login flow", timestamp: 2 },
    ];
    const goals = extractByPattern(msgs, "goal");
    expect(goals).toHaveLength(2);
    expect(goals).toContain("Build a web app");
    expect(goals).toContain("Test login flow");
  });

  it("deduplicates results", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "GOAL: Build a web app", timestamp: 1 },
      { id: "2", role: "user", content: "GOAL: Build a web app", timestamp: 2 },
    ];
    const goals = extractByPattern(msgs, "goal");
    expect(goals).toHaveLength(1);
  });

  it("extracts decisions", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "DECISION: Use React", timestamp: 1 },
      { id: "2", role: "user", content: "DECIDED: Switch to Vue", timestamp: 2 },
    ];
    const decisions = extractByPattern(msgs, "decision");
    expect(decisions).toContain("Use React");
    expect(decisions).toContain("Switch to Vue");
  });

  it("extracts errors", () => {
    const msgs: Message[] = [
      { id: "1", role: "tool", content: "ERROR: Connection timeout", timestamp: 1 },
      { id: "2", role: "tool", content: "FAILED: Build crashed", timestamp: 2 },
    ];
    const errors = extractByPattern(msgs, "error");
    expect(errors).toContain("Connection timeout");
    expect(errors).toContain("Build crashed");
  });

  it("extracts solutions", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "SOLUTION: Increase timeout", timestamp: 1 },
    ];
    const solutions = extractByPattern(msgs, "solution");
    expect(solutions).toContain("Increase timeout");
  });

  it("extracts discoveries", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "DISCOVERED: The bug is in config", timestamp: 1 },
    ];
    const d = extractByPattern(msgs, "discovery");
    expect(d).toContain("The bug is in config");
  });

  it("extracts constraints", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "REQUIREMENT: Must support HTTPS", timestamp: 1 },
    ];
    const c = extractByPattern(msgs, "constraint");
    expect(c).toContain("Must support HTTPS");
  });

  it("extracts file references", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "FILE: src/index.ts", timestamp: 1 },
    ];
    const f = extractByPattern(msgs, "file");
    expect(f).toContain("src/index.ts");
  });

  it("extracts changes", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "ADDED: new component", timestamp: 1 },
      { id: "2", role: "user", content: "DELETED: old module", timestamp: 2 },
    ];
    const changes = extractByPattern(msgs, "change");
    expect(changes).toContain("new component");
    expect(changes).toContain("old module");
  });

  it("extracts next/todo items", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "TODO: Write tests", timestamp: 1 },
    ];
    const n = extractByPattern(msgs, "next");
    expect(n).toContain("Write tests");
  });

  it("returns empty array when no patterns match", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "Just a normal message", timestamp: 1 },
    ];
    expect(extractByPattern(msgs, "goal")).toEqual([]);
    expect(extractByPattern(msgs, "error")).toEqual([]);
  });

  it("returns empty array for empty messages input", () => {
    expect(extractByPattern([], "goal")).toEqual([]);
  });

  it("handles messages with structured content", () => {
    const msgs: Message[] = [
      {
        id: "1",
        role: "user",
        content: [{ type: "text", text: "ERROR: Something broke" }],
        timestamp: 1,
      },
    ];
    const errors = extractByPattern(msgs, "error");
    expect(errors).toContain("Something broke");
  });

  it("uses case-insensitive matching", () => {
    const msgs: Message[] = [
      { id: "1", role: "user", content: "goal: lowercase works", timestamp: 1 },
      { id: "2", role: "user", content: "Goal: Capitalized works", timestamp: 2 },
    ];
    const goals = extractByPattern(msgs, "goal");
    expect(goals).toContain("lowercase works");
    expect(goals).toContain("Capitalized works");
  });
});

describe("containsErrorIndicators", () => {
  it("detects Error: in content", () => {
    expect(containsErrorIndicators("Error: something went wrong")).toBe(true);
  });

  it("detects error: in content", () => {
    expect(containsErrorIndicators("error: file not found")).toBe(true);
  });

  it("detects failed keyword", () => {
    expect(containsErrorIndicators("Build failed")).toBe(true);
  });

  it("detects Failed capitalized", () => {
    expect(containsErrorIndicators("Failed to compile")).toBe(true);
  });

  it("detects exit code phrase", () => {
    expect(containsErrorIndicators("Process exited with exit code 1")).toBe(true);
  });

  it("detects exit status phrase", () => {
    expect(containsErrorIndicators("exit status 127")).toBe(true);
  });

  it("detects SyntaxError", () => {
    expect(containsErrorIndicators("SyntaxError: Unexpected token")).toBe(true);
  });

  it("detects TypeError", () => {
    expect(containsErrorIndicators("TypeError: Cannot read property")).toBe(true);
  });

  it("returns false for clean content", () => {
    expect(containsErrorIndicators("Everything is working fine")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsErrorIndicators("")).toBe(false);
  });

  it("returns false for whitespace only", () => {
    expect(containsErrorIndicators("   \n  \t  ")).toBe(false);
  });

  it("handles mixed content with both clean and error parts", () => {
    expect(containsErrorIndicators("Started OK, then TypeError: boom")).toBe(true);
  });
});

describe("emptyCompactionResult", () => {
  it("returns a CompactionResult with default values", () => {
    const result = emptyCompactionResult();
    expect(result.summary).toBe("");
    expect(result.tokensBefore).toBe(0);
    expect(result.tokensAfter).toBe(0);
    expect(result.compressionRatio).toBe(1);
    expect(result.readFiles).toEqual([]);
    expect(result.modifiedFiles).toEqual([]);
    expect(typeof result.timestamp).toBe("number");
  });

  it("accepts a previous summary", () => {
    const result = emptyCompactionResult("Previous summary content");
    expect(result.summary).toBe("Previous summary content");
  });

  it("uses empty string if previous summary is empty", () => {
    const result = emptyCompactionResult("");
    expect(result.summary).toBe("");
  });

  it("has a valid timestamp (recent)", () => {
    const result = emptyCompactionResult();
    const now = Date.now();
    expect(result.timestamp).toBeGreaterThan(now - 5000);
    expect(result.timestamp).toBeLessThanOrEqual(now);
  });
});

describe("KEYWORD_PATTERNS", () => {
  it("has all expected categories", () => {
    const categories = Object.keys(KEYWORD_PATTERNS);
    expect(categories).toEqual([
      "goal",
      "decision",
      "error",
      "solution",
      "discovery",
      "constraint",
      "file",
      "change",
      "next",
    ]);
  });

  it("each category has pattern and weight", () => {
    for (const [, entry] of Object.entries(KEYWORD_PATTERNS)) {
      expect(entry.pattern).toBeInstanceOf(RegExp);
      expect(typeof entry.weight).toBe("number");
      expect(entry.weight).toBeGreaterThan(0);
      expect(entry.weight).toBeLessThanOrEqual(1);
    }
  });
});
