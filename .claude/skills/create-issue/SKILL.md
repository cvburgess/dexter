---
name: create-issue
description: Create or update a Linear issue. Use when the user wants to file a new enhancement, bug report, chore, or update an existing Linear issue.
argument-hint: [description of the issue, or Linear issue id/URL to update]
allowed-tools: Agent, mcp__linear-server__get_issue, mcp__linear-server__list_teams, mcp__linear-server__list_issues, mcp__linear-server__list_issue_labels, mcp__linear-server__list_issue_statuses, mcp__linear-server__save_issue, Bash(find *), Bash(ls*)
---

# Create Linear Issue

Create or update a Linear issue. Delegate research and writing to sonnet subagents. Use Linear MCP (`get_issue`, `list_teams`, `save_issue`, etc.).

## Instructions

You are the orchestrator. Delegate research and writing to sonnet subagents. Perform Linear MCP calls yourself.

### Step 1: Determine issue type and understand the request

Read `$ARGUMENTS` carefully.

**Determine the issue type** from the user's description:

- `enhancement` — new feature, improvement, or capability
- `bug` — something is broken or not working as expected
- `chore` — maintenance, refactoring, dependency updates, tooling, CI/CD changes

If the type is ambiguous, ask the user to clarify before proceeding.

If `$ARGUMENTS` contains a Linear identifier (`DEX-123`) or URL, fetch with `get_issue` and treat this as an update. Otherwise create new. Don't accept bare numeric ids — ask for an identifier or URL.

Ask follow-up questions if team, project, or labels are unclear.

### Step 2: Launch research agent

Launch a sonnet subagent to explore the codebase for context:

#### Agent A — Codebase Research

Prompt the agent with the user's request description. Ask it to:

- Check `docs/` for relevant product context (personas, features, pricing, brand guidelines)
- Find relevant source files, components, hooks, utilities related to the request
- Find existing patterns or implementations that relate to or would be affected by this request
- Find relevant types, database schemas, or edge functions
- Return a structured list of findings with file paths and brief descriptions

Set `model: "sonnet"` and `subagent_type: "Explore"`.

### Step 3: Collaborate on the plan

Use the `/grill-me` skill to collaborate with the user on the proposed issue. Pass the research findings from Agent A and the user's original request as context. Resolve any open questions or gaps before proceeding to draft the issue.

```
/grill-me
```

### Step 4: Launch author agent

Once the research agent completes, launch a sonnet subagent to draft the issue:

#### Agent B — Issue Author

Prompt the agent with:

- The user's request description from `$ARGUMENTS` (along with the determined issue type from Step 1)
- The codebase findings from Agent A

Ask it to draft a complete issue with:

- **Title**: concise, under 80 characters
- **Description** (Markdown) using this template:

```
## Why
< What problem does this solve? >

## Goal
< What does "done" look like? >

## Plan
- [ ] Step 1
- [ ] Step 2
...

## Test Cases
- [ ] Test case 1
- [ ] Test case 2
...

## Notes
1. Any relevant notes, links, or references
```

Fill each section thoughtfully:

- **Why**: Explain the problem or motivation clearly
- **Goal**: Describe the desired end state in concrete terms
- **Plan**: Break the work into actionable checklist items, referencing specific files from the research
- **Test Cases**: List how to verify the issue is resolved or the work is complete
- **Notes**: Add relevant context, file paths, library doc links from the research

Set `model: "sonnet"` and `subagent_type: "general-purpose"`.

### Step 5: Resolve team and labels

Default to team `DEX` per AGENTS.md unless the user specifies another team. Map the issue type to a Linear label (`Bug`, `Enhancement`, `Chore`); use `list_issue_labels` if unsure which exist.

### Step 6: Create (or update) the issue

**Create** (no existing Linear `id`):

- Call `save_issue` with at least `title`, `team`, `description` (Markdown body), and `state: "Ready"` so the new issue lands in the team's `Ready` column instead of the default `In Refinement` state. Add `labels`, `project`, `priority`, etc. only when known and supported by the schema.

**Update** (existing Linear issue):

- Call `save_issue` with `id` set to the identifier (e.g. `DEX-294`), `state: "Ready"` (unless the user explicitly asked for a different state), and any other fields to change (`title`, `description`, `labels`, …).

### Step 7: Return the Linear issue URL to the user

Return the `url` field from the `save_issue` / `get_issue` response (or construct it from the identifier).

## Important

- If the user provides a vague description, ask clarifying questions before creating the issue
- Write the plan steps at a level of detail useful for implementation
- When adding file paths, verify they exist in the codebase first
