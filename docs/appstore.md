# App Store Copy

Source of truth for Dexter's App Store Connect metadata: keywords, copy, and
review notes. Update this doc when the listing changes so the wording stays
consistent with the app (`src/app.json`) and the marketing site (`/www`).

## App identity

- **Name:** `Dexter Day Planner` (App Store name, ≤ 30 chars)
- **Subtitle:** `An opinionated day planner` (≤ 30 chars)
- **Bundle ID:** `com.dexterplanner` (`src/app.json` → `ios.bundleIdentifier`)
- **App Store Connect App ID (ascAppId):** `6790178708`
- **Apple Team ID:** `Q77C3BA452`
- **Primary category:** Productivity
- **Copyright:** `2026 Charles Burgess`
- **Marketing URL:** https://dexterplanner.com
- **Support URL:** https://dexterplanner.com
- **Privacy Policy URL:** https://dexterplanner.com/privacy

## Keywords

planner,to-do,tasks,productivity,eisenhower,priorities,habits,journal,adhd,focus,goals,calendar

### Notes for generating

Do not repeat words already in the app name or subtitle ("day", "planner") —
Apple indexes those automatically, so the keyword field spends its 100
characters on distinct terms.

## Description

Dexter is an opinionated day planner that helps you get more done while avoiding the trap of busyness.

It fills the gap between planners that are too simple to be useful and ones too complicated to use every day.

Plan each day intentionally, prioritize with a twist on the Eisenhower Matrix, and keep your whole day (tasks, notes, journal, and calendar) in one place.

FEATURES:

• Prioritization: label tasks important, urgent, both, or neither so your priorities are always clear
• Quick Planner: surface tasks that are overdue, due soon, or left behind
• Markdown notes and a customizable journal with reflection prompts
• Calendars in one place: your device calendars, or .ics feeds on the web
• Habit tracker, goals, and milestones
• Repeating tasks and native task alarms so nothing slips
• Connect to AI: an MCP server lets Claude, ChatGPT, Gemini, and Cursor plan alongside you
• Customizable themes, on iPhone, iPad, and the web

Dexter is open source under the MIT license: https://github.com/cvburgess/dexter

### Notes for generating

Copy is seeded from `CHANGELOG.md` - keep this description in sync with those when the
product changes.

## Review notes

```
Email: demo@dexterplanner.com
Code:  <DEMO_OTP>
```

## Build & submit

A manual **Build and Submit** GitHub Actions workflow
(`.github/workflows/build-and-submit.yml`, `workflow_dispatch`) builds the iOS
`production` profile with EAS, submits the latest build to App Store Connect,
then tags the release and publishes GitHub release notes from `CHANGELOG.md`
(`.github/scripts/tag-and-release.sh`). Version/build numbers auto-increment
(`appVersionSource: "remote"` + `autoIncrement` on the production profile).

## Screenshots

Stored in `www/src/assets/screenshots/` (auto-published by `www/_config.ts`'s
`site.add("/assets")`), so one set powers both the marketing site and the App
Store listing. Uploaded to App Store Connect manually.

Required iPhone size: **6.9" — 1320 × 2868**, with **no alpha channel**. Apple
downscales that set for smaller devices, so the optional 6.5" (1242 × 2688) set
is deliberately not maintained. See Apple's current
[screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).

Two traps cause "wrong dimensions" rejections, and both have bitten this project:
the iPhone Air (1260 × 2736) and iPhone 17 Pro (1206 × 2622) are **not accepted
sizes** no matter how clean the capture, and `simctl` screenshots always carry an
alpha channel that `sips` cannot strip.

**To capture a new set, use the `/generate-screenshots` skill**
(`.claude/skills/generate-screenshots/SKILL.md`) — it covers the simulator setup,
demo-account reseeding, maestro login/navigation flows, and the required
verification pass. Alpha stripping is handled by
`scripts/flatten-screenshot.swift`.
