---
name: triage-sentry
description: Triage Sentry issues by investigating root cause, then either resolving noise in Sentry or creating a Linear bug issue. Use when the user wants to triage, review, or act on Sentry errors.
argument-hint: [Sentry issue ID, URL, or "all" to triage open issues]
disable-model-invocation: true
allowed-tools: Agent, Read, Grep, Glob, Bash(git log*), mcp__sentry__search_issues, mcp__sentry__get_issue_details, mcp__sentry__update_issue, mcp__sentry__find_organizations, mcp__sentry__find_projects, mcp__claude_ai_Sentry__search_issues, mcp__claude_ai_Sentry__get_issue_details, mcp__claude_ai_Sentry__update_issue, mcp__claude_ai_Sentry__find_organizations, mcp__claude_ai_Sentry__find_projects, mcp__linear-server__list_issue_labels, mcp__linear-server__save_issue, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__save_issue
---

# Triage Sentry Issues

Investigate Sentry issues, determine root cause, and take action: resolve noise in Sentry or create a Linear bug issue with full context.

## Execution requirements

- **A Sentry MCP connection is required.** This repo does not configure one — `.cursor/mcp.json` declares only `supabase`, `expo`, and `linear-server`, and Claude Code does not read that file. Sentry must be connected at the user/connector level.
- **If the first Sentry tool call fails or no Sentry tool is available, stop and say so.** Tell the user to connect the Sentry MCP server, then stop. Never guess at issue IDs, error messages, or event counts — a fabricated triage is worse than no triage.
- **MCP tool prefixes vary by connector.** Sentry tools surface as either `mcp__sentry__*` or `mcp__claude_ai_Sentry__*`, and Linear as either `mcp__linear-server__*` or `mcp__claude_ai_Linear__*`. Use whichever prefix the environment actually exposes; both are listed in `allowed-tools`.

## Setup

The Sentry organization is `cvburgess` with region URL `https://us.sentry.io`. Projects:

- `dexter-app` — Expo (React Native) app. Confirmed by the `@sentry/react-native/expo` config plugin block in `src/app.json`.
- `dexter-api` — Supabase edge functions. Reporting goes through `supabase/functions/_shared/sentry.ts`.

If either slug fails to resolve, call `find_projects` for the `cvburgess` org and use the real slugs rather than retrying the hardcoded ones.

## Instructions

You are the orchestrator. Delegate source investigation and issue drafting to sonnet subagents. Perform all Sentry and Linear MCP calls yourself.

### Step 1: Find issues to triage

If `$ARGUMENTS` contains a specific Sentry issue ID (e.g. `DEXTER-APP-E`) or URL, fetch that single issue with `get_issue_details`.

If `$ARGUMENTS` is "all" or a general description, search for matching unresolved issues with `search_issues` across both projects.

If `$ARGUMENTS` is empty, treat it as "all" and search both projects for unresolved issues.

### Step 2: Get issue details

For each issue, fetch full details with `get_issue_details`. Extract:

- Error message and stacktrace
- Culprit file and function
- Event count and user impact
- Environment (production vs development)
- Tags (device, OS, browser, etc.)
- First/last seen dates

### Step 3: Investigate root cause

Launch a sonnet Explore subagent to investigate the source. Prompt it with:

- The error message and stacktrace
- The culprit file path, mapped into this repo:
  - Edge function frames arrive as `/var/tmp/sb-compile-edge-runtime/functions/...` — strip that prefix and read under `supabase/functions/`
  - App frames map into `src/`
- Ask it to read the relevant source files and identify the root cause
- Ask it to suggest a fix with specific file paths and line numbers

Tell the agent that these frames are deliberate reporting paths, not necessarily the bug:

- `captureException` / `withSentry` in `supabase/functions/_shared/sentry.ts` — the shared capture helper every function funnels through
- `toolError(...)` in `supabase/functions/mcp-server/` — MCP tools return errors rather than throwing, and every `toolError` also reports
- `Sentry.captureException` in `src/app/_layout.tsx`'s `ErrorBoundary` and in `src/providers/QueryProvider.tsx`'s query/mutation `onError` handlers

The real culprit is usually the frame beneath these. See the "Error monitoring (Sentry)" section of `docs/frontend.md` and the Sentry paragraph in `docs/backend.md` for how reporting is wired.

Set `model: "sonnet"` and `subagent_type: "Explore"`.

### Step 4: Classify the issue

Based on the investigation, classify each issue. **Evaluate the noise rules first — they take precedence.** Only if none of them match do you consider the bug rules; an issue that matches a noise rule is noise even when it also looks like a bug (a dev-only error with many events is still dev noise, and an already-fixed crash that hit production users is still resolved, not re-filed).

**Resolve as noise** if ANY of these are true:

- Environment is `development` (dev-only errors, HMR artifacts, etc.)
- Error is transient/expected (network offline, user-caused, etc.) AND event count is very low
- The code has already been fixed — check with `git log` against the **root-cause file Step 3 identified**, not the raw culprit path. Sentry's culprit is often a reporting funnel (`_shared/sentry.ts`, `toolError`, `QueryProvider`) that changes for unrelated reasons, so a recent commit there says nothing about this error. The commit must plausibly address *this* error, not merely touch the file; if Step 3 found no root-cause file, this rule does not apply
- Error is in third-party code with no first-party fix possible

**Otherwise, create a Linear bug issue** if ANY of these are true:

- Error is in first-party code with a clear root cause
- Error affects production users
- Error is recurring (multiple events)
- There is a concrete fix available

### Step 5: Take action

#### For noise — resolve in Sentry

Use `update_issue` to set status to `resolved`. Never use `ignored`.

Note that Sentry re-opens a resolved issue as a regression the next time it receives an event, so recurring noise (dev-only errors especially) will come back into the queue. That is expected — re-resolve it; don't reclassify it as a bug just because it reappeared.

Report to the user: issue ID and the reason for resolution.

#### For bugs — create a Linear issue

Launch a sonnet subagent to draft the issue description. Prompt it with the error details, root cause analysis, and suggested fix from Step 3.

Set `model: "sonnet"` and `subagent_type: "general-purpose"`.

The issue **description** (Markdown) must follow this template:

```
## Sentry Issue

- **Issue:** [ISSUE-ID](sentry-url)
- **Error:** `error message`
- **Events:** X events, Y users
- **First seen:** date
- **Last seen:** date
- **Environment:** production/development

## Root Cause

< Clear explanation of why this error occurs, referencing specific files and line numbers >

## Suggested Fix

< Code-level description of what to change, with file paths >

## Reproduction

< How to trigger this error, if known from the Sentry event context >
```

Then call `save_issue` with `team: "DEX"` (per CLAUDE.md), `title`, `description`, `labels: ["Bug"]` (confirm the label exists with `list_issue_labels` if the call is rejected), and `state: "Ready"` so the issue lands in the team's `Ready` column instead of the default `In Refinement` — the same convention as `.claude/skills/create-issue/SKILL.md`. If the user specifies a different team or state, use that instead.

### Step 6: Report results

Summarize every action taken in a table:

| Sentry issue | Action | Link |
|--------------|--------|------|
| ISSUE-ID | Resolved as noise / Created DEX-123 | URL |

## Important

- Always check the environment tag — dev-only errors are almost always noise
- For edge function errors, map `/var/tmp/sb-compile-edge-runtime/functions/` to `supabase/functions/`
- Use the `Bug` label for every bug issue created by this skill
- Include the Sentry issue link in every Linear bug issue
- This skill triages and files issues — it never modifies app code. Suggest the fix in the Linear issue; leave implementation to `/implement-issue`
- Sentry MCP has no comment tool here, so don't try to post the Linear URL back onto the Sentry issue — the Linear issue's Sentry link is the connection, and the summary table is the record
- When no rule in Step 4 clearly applies, create the Linear issue — better a tracked issue that gets closed than a missed bug. This is a tiebreak for genuinely unclassified issues, not an override of the noise rules, which always win when they match
