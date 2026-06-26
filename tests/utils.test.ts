/**
 * Unit tests for extensions/utils.ts
 *
 * Covers: messageContent, extractByPattern, containsErrorIndicators,
 * emptyCompactionResult with edge cases and branches.
 */

import { describe, it, expect } from "vitest";
import {
  messageContent,
  extractByPattern,
  containsErrorIndicators,
  emptyCompactionResult,
  KEYWORD_PATTERNS,
} from "../extensions/utils";
import type { Message, TextContent } from "../extensions/types";

// --- messageContent ---

describe("messageContent", () => {
  it("returns plain string content as-is", () => {
    const msg: Message = {
      id: "1", role: "user", content: "hello world", timestamp: 0,
    };
    expect(messageContent(msg)).toBe("hello world");
  });

  it("joins text blocks from structured content", () => {
    const msg: Message = {
      id: "2", role: "assistant",
      content: [{ type: "text", text: "first block" } as TextContent,
                 { type: "text", text: "second block" } as TextContent] as any,
      timestamp: 0,
    };
    expect(messageContent(msg)).toBe("first block second block");
  });

  it("filters out non-text blocks", () => {
    const msg: Message = {
      id: "3", role: "assistant",
      content: [{ type: "text", text: "visible" } as TextContent,
                 { type: "tool_use", name: "bash" } as any] as any,
      timestamp: 0,
    };
    expect(messageContent(msg)).toBe("visible");
  });

  it("handles empty block array", () => {
    const msg: Message = {
      id: "4", role: "user", content: [] as any, timestamp: 0,
    };
    expect(messageContent(msg)).toBe("");
  });

  it("handles missing text field in blocks", () => {
    const msg: Message = {
      id: "5", role: "user",
      content: [{ type: "text" }] as any, timestamp: 0,
    };
    expect(messageContent(msg)).toBe("");
  });

  it("converts non-string non-array content to string", () => {
    const msg: Message = {
      id: "6", role: "user", content: 42 as any, timestamp: 0,
    };
    expect(messageContent(msg)).toBe("42");
  });

  it("handles null content returns empty string", () => {
    const msg: Message = {
      id: "7", role: "user", content: null as any, timestamp: 0,
    };
    expect(messageContent(msg)).toBe("");
  });
});

// --- extractByPattern ---

describe("extractByPattern", () => {
  function makeMsg(c: string): Message {
    return { id: "t", role: "user", content: c, timestamp: 0 };
  }

  it("extracts goal patterns", () => {
    expect(extractByPattern([makeMsg("GOAL: build a mousetrap")], "goal"))
      .toEqual(["build a mousetrap"]);
  });

  it("extracts decision patterns", () => {
    expect(extractByPattern([makeMsg("DECISION: use TS")], "decision"))
      .toEqual(["use TS"]);
  });

  it("extracts error patterns", () => {
    expect(extractByPattern([makeMsg("ERROR: connection refused")], "error"))
      .toEqual(["connection refused"]);
  });

  it("extracts solution patterns", () => {
    expect(extractByPattern([makeMsg("SOLUTION: restart")], "solution"))
      .toEqual(["restart"]);
  });

  it("extracts discovery patterns", () => {
    expect(extractByPattern([makeMsg("DISCOVERED: root cause")], "discovery"))
      .toEqual(["root cause"]);
  });

  it("extracts constraint patterns", () => {
    expect(extractByPattern([makeMsg("CONSTRAINT: offline")], "constraint"))
      .toEqual(["offline"]);
  });

  it("extracts file patterns", () => {
    expect(extractByPattern([makeMsg("FILE: /etc/config")], "file"))
      .toEqual(["/etc/config"]);
  });

  it("extracts change patterns", () => {
    expect(extractByPattern([makeMsg("ADDED: feature flag")], "change"))
      .toEqual(["feature flag"]);
  });

  it("extracts next/todo patterns", () => {
    expect(extractByPattern([makeMsg("TODO: write tests")], "next"))
      .toEqual(["write tests"]);
  });

  it("returns empty array when no match", () => {
    expect(extractByPattern([makeMsg("regular message")], "goal")).toEqual([]);
  });

  it("deduplicates repeated matches", () => {
    expect(extractByPattern(
      [makeMsg("GOAL: build X"), makeMsg("GOAL: build X")], "goal"
    )).toEqual(["build X"]);
  });

  it("handles mixed case patterns", () => {
    expect(extractByPattern([makeMsg("goal: lowercase")], "goal"))
      .toEqual(["lowercase"]);
  });

  it("handles empty messages array", () => {
    expect(extractByPattern([], "goal")).toEqual([]);
  });

  it("trims extracted text", () => {
    expect(extractByPattern([makeMsg("ERROR:   spaces   ")], "error"))
      .toEqual(["spaces"]);
  });
});

// --- containsErrorIndicators ---

describe("containsErrorIndicators", () => {
  it("detects Error: prefix", () => {
    expect(containsErrorIndicators("Error: something broke")).toBe(true);
  });

  it("detects error: prefix (lowercase)", () => {
    expect(containsErrorIndicators("error: something broke")).toBe(true);
  });

  it("detects 'failed' keyword", () => {
    expect(containsErrorIndicators("the test failed")).toBe(true);
  });

  it("detects 'Failed' (capitalized)", () => {
    expect(containsErrorIndicators("Failed to connect")).toBe(true);
  });

  it("detects 'exit code'", () => {
    expect(containsErrorIndicators("exit code 1")).toBe(true);
  });

  it("detects 'exit status'", () => {
    expect(containsErrorIndicators("exit status 127")).toBe(true);
  });

  it("detects SyntaxError", () => {
    expect(containsErrorIndicators("SyntaxError: unexpected token")).toBe(true);
  });

  it("detects TypeError", () => {
    expect(containsErrorIndicators("TypeError: undefined")).toBe(true);
  });

  it("returns false for benign content", () => {
    expect(containsErrorIndicators("everything is fine")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsErrorIndicators("")).toBe(false);
  });
});

// --- emptyCompactionResult ---

describe("emptyCompactionResult", () => {
  it("returns empty result with defaults", () => {
    const r = emptyCompactionResult();
    expect(r).toEqual({
      summary: "", tokensBefore: 0, tokensAfter: 0,
      compressionRatio: 1, readFiles: [], modifiedFiles: [],
      timestamp: expect.any(Number),
    });
  });

  it("includes previous summary when provided", () => {
    expect(emptyCompactionResult("prev").summary).toBe("prev");
  });

  it("timestamp is current time", () => {
    const b = Date.now();
    const r = emptyCompactionResult();
    expect(r.timestamp).toBeGreaterThanOrEqual(b);
    expect(r.timestamp).toBeLessThanOrEqual(Date.now() + 100);
  });
});

// --- KEYWORD_PATTERNS structure ---

describe("KEYWORD_PATTERNS", () => {
  it("has all expected categories", () => {
    expect(Object.keys(KEYWORD_PATTERNS)).toEqual([
      "goal", "decision", "error", "solution", "discovery",
      "constraint", "file", "change", "next",
    ]);
  });

  it("each entry has pattern and weight", () => {
    for (const cat of Object.values(KEYWORD_PATTERNS)) {
      expect(cat).toHaveProperty("pattern");
      expect(cat).toHaveProperty("weight");
      expect(cat.pattern).toBeInstanceOf(RegExp);
      expect(typeof cat.weight).toBe("number");
    }
  });
});
