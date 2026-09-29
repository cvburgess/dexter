---
name: refine-issue
description: Refine an existing Linear issue by filling gaps and adding codebase references. Use when the user wants to improve an issue's clarity, detail, or technical context.
argument-hint: [Linear issue id (e.g. DEX-294) or Linear issue URL]
allowed-tools: Agent, mcp__linear-server__get_issue, mcp__linear-server__list_comments, mcp__linear-server__save_issue, mcp__linear-server__save_comment
---

# Refine Linear Issue

Act as a technical business analyst to refine an existing Linear issue. Fill in gaps, enhance with codebase and documentation references, and improve clarity — without modifying any code.

## Instructions

You are the orchestrator. Delegate research and writing to sonnet subagents. Use Linear MCP for reads and writes.

### Step 1: Fetch the issue

Parse `$ARGUMENTS` for a Linear identifier (`DEX-294`) or issue URL. Call `get_issue` with that `id`. Optionally call `list_comments` for context.

Build a compact summary for subagents: `title`, `description`, `labels`, `state`, `url`, and recent comment bodies if fetched.

### Step 2: Launch research agents in parallel

Launch these two sonnet subagents **in parallel** (single message, two Agent tool calls):

#### Agent A — Issue Analysis

Prompt the agent with the issue summary from step 1. Ask it to:

- Identify gaps: vague/missing **Why**, unclear **Goal**, missing/shallow **Plan** steps, missing **Test Cases**, no code/doc references
- List specific questions or areas that need enhancement
- Return a structured list of gaps and suggestions

Set `model: "sonnet"` and `subagent_type: "general-purpose"`.

#### Agent B — Codebase Exploration

Prompt the agent with the issue title and description. Ask it to:

- Check `docs/` first for product/implementation context (personas, features, pricing, brand, backend architecture)
- Find relevant source files, components, hooks, utilities
- Find existing patterns the issue should follow or reference
- Find relevant types, database schemas, or edge functions
- Return a structured list of relevant file paths with brief descriptions of why each is relevant

Set `model: "sonnet"` and `subagent_type: "Explore"`.

### Step 3: Collaborate on the plan

Use the `/grill-me` skill to collaborate with the user on the refinement approach. Pass the gap analysis from Agent A and codebase findings from Agent B as context. Resolve any open questions before proceeding to rewrite the issue.

```
/grill-me
```

### Step 4: Launch author agent

Once both research agents complete, launch a single sonnet subagent to draft the enhanced issue:

#### Agent C — Issue Author

Prompt the agent with:

- The original issue title and description
- The gap analysis from Agent A
- The codebase findings from Agent B

Ask it to:

- Rewrite/augment the issue **description** using the standard template (Why, Goal, Plan, Test Cases, Notes)
- Fill in missing sections identified by Agent A
- Add file path references and library doc links from Agent B's findings
- Preserve the original author's intent — enhance, don't replace
- Also draft a short summary **comment** listing what was changed/added

Return two things: the enhanced Markdown **description** and the summary comment body.

Set `model: "sonnet"` and `subagent_type: "general-purpose"`.

### Step 5: Update the issue and add a summary comment

1. Call `save_issue` with `id` set to the Linear identifier, `description` set to the enhanced body, and `state: "Ready"` so the refined issue moves out of `In Refinement` into the `Ready` column.
2. Call `save_comment` with `issueId` set to the same identifier and `body` set to the summary comment (create path: do not pass `id` on the comment).

### Step 6: Return the Linear issue URL to the user

Return the issue `url` from `get_issue` / `save_issue`.

## Important

- Never modify code, create branches, or attempt implementation
- Preserve the original author's intent — enhance, don't rewrite
- If the issue is already well-detailed, note that and make only minor additions
- Always leave a comment summarizing what changed so the original author can review
- Use the standard issue template sections (Why, Goal, Plan, Test Cases, Notes) but don't force sections that don't apply
- When adding file paths, verify they exist in the codebase first
