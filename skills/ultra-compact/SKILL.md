# Ultra-Compact Compaction

## When to Use

Use this skill when the session context is approaching limits and you need to compress conversation history while preserving critical information.

## Procedure

### 1. Identify Critical Elements

Before compaction, identify and preserve:
- **GOAL**: The current objective being worked toward
- **INSTRUCTIONS**: Key constraints and requirements
- **DISCOVERIES**: Important findings, decisions, and non-obvious learnings
- **ACCOMPLISHED**: What has been completed
- **NEXT STEPS**: What needs to be done next
- **RELEVANT FILES**: Important files and paths

### 2. Apply Compression Rules

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

### 3. Format Output

```markdown
## Session Summary

### GOAL
[Current objective]

### INSTRUCTIONS
[Key constraints and requirements]

### DISCOVERIES
[Important findings, decisions, learnings]

### ACCOMPLISHED
[What has been completed]

### NEXT STEPS
[What needs to be done]

### RELEVANT FILES
[Important files and paths]
```

## Pitfalls

- **Over-compression**: Don't remove information that's actively needed
- **Losing context**: Always preserve the current goal and next steps
- **Breaking references**: Keep file paths and function names intact
- **Forgetting decisions**: Always preserve the reasoning behind choices

## Verification

After compaction, verify:
1. The goal is still clear
2. Next steps are actionable
3. All critical file paths are preserved
4. Key decisions and their reasoning are intact
5. The session can continue seamlessly
