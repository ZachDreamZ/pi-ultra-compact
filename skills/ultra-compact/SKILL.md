---
name: ultra-compact
description: "Advanced compaction skill for Pi with automatic threshold-based compaction and support for 200+ models. Trigger: session context approaching limits, manual /ultracompact command, or auto-compaction at 80% of model context window."
license: MIT
metadata:
  author: Vendex
  version: "0.8.0"
---

# Ultra-Compact Compaction

Advanced compaction skill for Pi with automatic threshold-based compaction and support for 200+ models.

## When to Use

Use this skill when:
- Session context is approaching limits
- You need to compress conversation history while preserving critical information
- Manual compaction is needed via `/ultracompact`
- Auto-compaction triggers when context exceeds 80% of your model's detected context window

## Supported Models

| Provider | Models | Context Window |
|----------|--------|----------------|
| **OpenAI** | GPT-5/5.1/5.2, GPT-4.1, GPT-4o, O3, O4-mini | 8K - 1M tokens |
| **Anthropic** | Claude 4.5/4.0/3.7/3.5/3 | 200K tokens |
| **Google** | Gemini 2.5/2.0/1.5, Gemma 3/2 | 32K - 2M tokens |
| **DeepSeek** | V4 Pro, V3, V2.5, R1 | 64K - 1M tokens |
| **Meta** | Llama 4, 3.3, 3.1, 3, 2 | 4K - 1M tokens |
| **Mistral** | Medium 3.5, Large 3, Small 4, Codestral | 32K - 256K tokens |
| **Qwen** | Qwen3, Qwen2.5, Qwen2 | 32K - 128K tokens |
| **Microsoft** | Phi-4, Phi-3, Phi-2 | 2K - 32K tokens |
| **xAI** | Grok 3, Grok 2 | 8K - 131K tokens |

## Procedure

### 1. Manual Compaction

Use the `/ultracompact` command for manual compaction:

```
/ultracompact
```

### 2. Auto-Compaction

The extension auto-detects your model from Pi's configuration and sets the threshold at 80% of its context window:

| Model | Context Window | Threshold (80%) |
|-------|---------------|-----------------|
| Claude Opus/Sonnet | 200,000 | 160,000 |
| GPT-5 | 400,000 | 320,000 |
| GPT-4.1 | 1,047,576 | ~838,000 |
| Gemini 2.5 Pro | 1,000,000 | 800,000 |
| DeepSeek V4 Pro | 1,000,000 | 800,000 |
| Default (unknown model) | 128,000 | 102,400 |

If the model cannot be detected (e.g., no model name available), a safe default threshold of 100,000 tokens is used.

### 3. Critical Information Extraction

The skill automatically extracts and preserves:
- **Goals**: Current objectives being worked toward
- **Decisions**: Key choices and their reasoning
- **Errors**: Problems encountered and solutions found
- **File Paths**: Important files read or modified
- **Next Steps**: What needs to be done next

### 4. Compression Rules

**Preserve (Never Remove):**
- Active goals and acceptance criteria
- Key decisions and their reasoning
- Error patterns and solutions discovered
- File paths and configuration values
- User preferences and constraints

**Summarize Aggressively:**
- Conversation back-and-forth → Single decision points
- Long code blocks → Key changes only
- Debugging sessions → Final solution
- Research → Key findings with sources

**Remove Entirely:**
- Redundant information
- Failed attempts (keep only the lesson learned)
- Verbose explanations (keep the conclusion)
- Repeated context

### 5. Format Output

```markdown
## Session Summary

### GOAL
[Current objective]

### KEY DECISIONS
[Important choices and reasoning]

### ERRORS & SOLUTIONS
[Problems encountered and how they were solved]

### FILE OPERATIONS
Read:
- path/to/file1.ts
- path/to/file2.ts

Modified:
- path/to/changed.ts

### NEXT STEPS
1. [Action item 1]
2. [Action item 2]

### CONTEXT
[Other critical information needed to continue]
```

## Pitfalls

- **Over-compression**: Don't remove information that's actively needed
- **Losing context**: Always preserve the current goal and next steps
- **Breaking references**: Keep file paths and function names intact
- **Forgetting decisions**: Always preserve the reasoning behind choices
- **Wrong threshold**: Extension auto-detects from model - set `thresholdTokens` explicitly in config only to override

## Verification

After compaction, verify:
1. The goal is still clear
2. Next steps are actionable
3. All critical file paths are preserved
4. Key decisions and their reasoning are intact
5. The session can continue seamlessly

## Installation

```bash
pi install npm:pi-ultra-compact
```

## Commands

| Command | Description |
|---------|-------------|
| `/ultracompact` | Trigger manual ultra-compact compaction |

> **Note:** `/compression-level` was removed. Compression uses the engine-based approach with automatic model-aware thresholds.

