---
name: create-issue
description: Create a GitHub issue. Use when the user wants to file a new enhancement, bug report, or chore issue.
argument-hint: [description of the issue]
allowed-tools: Bash(gh *), Bash(find *), Bash(ls*), Agent
---

# Create Issue

Create a GitHub issue. Delegate research and writing to sonnet subagents.

## Instructions

You are the orchestrator. Delegate research and writing to sonnet subagents and use `gh` CLI commands yourself.

### Step 1: Determine issue type and understand the request

Read `$ARGUMENTS` carefully.

**Determine the issue type** from the user's description:
- `enhancement` — new feature, improvement, or capability
- `bug` — something is broken or not working as expected
- `chore` — maintenance, refactoring, dependency updates, tooling, CI/CD changes

If the type is ambiguous, ask the user to clarify before proceeding.

If a number is included like #33, this is an update — fetch the existing issue first with `gh issue view`.

Ask the user follow up questions if any implementation details are unclear.

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
- **Body** using this template:

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

### Step 5: Create (or update) the issue

If creating a new issue:
```bash
gh issue create --label "<type>" --title "<title>" --body "<body>"
```

If updating an existing issue (number provided in arguments):
```bash
gh issue edit <number> --body "<body>"
```

### Step 6: Return the issue URL to the user.

## Important

- If the user provides a vague description, ask clarifying questions before creating the issue
- Use the correct label for the issue type: `enhancement`, `bug`, or `chore`
- Write the plan steps at a level of detail useful for implementation
- When adding file paths, verify they exist in the codebase first
