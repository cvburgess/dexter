---
name: bump-version
description: Bump the app version and write release notes to CHANGELOG.md. Use when preparing a new app release.
argument-hint: <new-version> (e.g., 1.2.0)
allowed-tools: Bash(cd src && npm version *), Bash(git *), Bash(gh *), Read, Edit, Write, Glob
---

# Bump Version

Bump the app version in all required files and write release notes to `CHANGELOG.md`. The `build-and-submit` workflow reads this file, creates the git tag, GitHub release, and submits to the App Store.

## Instructions

### Part 1: Bump version

1. **Parse the version** from `$ARGUMENTS`. It should be a valid semver string (e.g., `1.2.0`). If no version is provided, ask the user for one.

2. **Check if this is a resubmission.** Read `src/package.json` — if the version already matches, ask: "Version is already X.Y.Z. Is this a resubmission after an App Store rejection?" If yes, skip to Part 2.

3. **Run npm version.** This is the whole bump — `src/package.json` is the single source of truth, and `src/app.config.ts` reads the Expo version from it (DEX-169), so there is no second file to hand-edit:

   ```bash
   cd src && npm version <new-version> --no-git-tag-version
   ```

4. **Verify** by reading `src/package.json` and `src/package-lock.json` — both must show the new version. Then confirm the version the app will actually ship with:

   ```bash
   cd src && npx expo config --type prebuild --json
   ```

   The `version` field in that output is what reaches the App Store. If it does not match, stop and fix it before Part 2 — do **not** add a `version` to `src/app.json` to force it, which is the drift DEX-169 removed.

### Part 2: Generate release notes

1. **Get the PR list.** Find the previous version tag with `git tag -l`, get its date with `git log -1 --format=%Y-%m-%d <tag>`, then:

   ```bash
   gh pr list --repo cvburgess/dexter --state merged --base main --search "merged:>YYYY-MM-DD" --json number,title --limit 100
   ```

   Also check if the current branch has an open PR and include it in the list — it will merge as part of this release:

   ```bash
   gh pr view --json number,title
   ```

   Format all as `- Title (#number)`.

2. **Read user-facing PRs.** For PRs that look user-facing from the title, run `gh pr view <number> --json title,body` to understand what changed.

3. **Update `CHANGELOG.md`.** Add a new `## vX.Y.Z` section at the top (below any existing header) with:

   1. User-facing bullet points:
      - Write for end users in marketing voice — no technical jargon, no implementation details
      - Avoid mentioning specific vendors, APIs, or third-party data sources by name (e.g. "USDA database", "OpenAI") — these tip off competitors and don't matter to users
      - For MCP / AI integrations, refer to "your favorite AI tools like Claude, ChatGPT, and Gemini" rather than naming a single client
      - One bullet per feature; group related PRs
      - Order by impact: features first, then improvements
      - Roll all bug fixes and minor polish into a single trailing bullet: "Fixed bugs and made improvements to improve the user experience"
      - Aim for ≤ 8 bullets total
   2. A horizontal rule (`---`)
   3. The full PR list from step 1

4. **Report** to the user. Remind them to commit, merge to main, then trigger `build-and-submit`.

## Example CHANGELOG.md entry

```markdown
## v1.2.0

- Scan printed recipes with your camera
- Faster recipe imports from your favorite cooking blogs
- Fixed bugs and made improvements to improve the user experience

---

- Add recipe scanning (#220)
- Fix ingredient combination when unit systems differ (#198)
- Add JSON-LD first-pass extraction for HTML recipes (#184)
- Fix mutations silently failing on web (#176)
```

## Important

- `npm version` updates the only two files that carry the version: `src/package.json` and `src/package-lock.json`. `src/app.json` deliberately has no `version` — `src/app.config.ts` injects it from `package.json`
- Do not create a git commit or git tag as part of this skill
- Do not fabricate features — every bullet must trace to a real PR or commit
- Bullet points are also used for iOS/Android app store release notes — keep them concise
- The `build-and-submit` workflow reads the latest `CHANGELOG.md` entry to create the GitHub release
