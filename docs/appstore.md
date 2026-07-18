# App Store Listing

Source of truth for Dexter's App Store Connect metadata: keywords, copy, and
review notes. Update this doc when the listing changes so the wording stays
consistent with the app (`src/app.json`) and the marketing site (`/www`).

The app is not yet live on the App Store — `www/src/_data/metadata.json`'s
`links.ios` is empty and the site's "Get iPhone app" link is disabled. This
doc is the staging ground for the first submission. There is no `submit`
profile in `src/eas.json` or `store.config.json` yet; add those when wiring
`eas submit` / `eas metadata`.

## App identity

- **Name:** `Dexter: Day Planner` (App Store name, ≤ 30 chars)
- **Subtitle:** `An opinionated day planner` (≤ 30 chars)
- **Bundle ID:** `com.dexterplanner` (`src/app.json` → `ios.bundleIdentifier`)
- **Apple Team ID:** `Q77C3BA452`
- **Primary category:** Productivity
- **Copyright:** `2026 Charles Burgess`
- **Marketing URL:** https://dexterplanner.com
- **Support URL:** https://dexterplanner.com
- **Privacy Policy URL:** https://dexterplanner.com/privacy

## Keywords

App Store keyword field (comma-separated, ≤ 100 chars, no spaces after commas):

```
planner,to-do,tasks,productivity,eisenhower,priorities,habits,journal,adhd,focus,goals,calendar
```

Do not repeat words already in the app name or subtitle ("day", "planner") —
Apple indexes those automatically, so the keyword field spends its 100
characters on distinct terms.

## Promotional text

Editable without a new build (≤ 170 chars):

> Now a single universal app for iPhone, iPad, and the web — with native task
> alarms and an MCP server so Claude, ChatGPT, and Gemini can plan alongside
> you.

## Description

> Dexter is an opinionated day planner that helps you get more done while
> avoiding the trap of busyness. It fills the gap between planners that are too
> simple to be useful and ones too complicated to use every day.
>
> Plan each day intentionally, prioritize with a twist on the Eisenhower
> Matrix, and keep your whole day — tasks, notes, journal, and calendar — in
> one place.
>
> FEATURES
> • Prioritization — label tasks important, urgent, both, or neither so your
>   priorities are always clear
> • Quick Planner — surface tasks that are overdue, due soon, or left behind
> • Markdown notes and a customizable journal with reflection prompts
> • Calendars in one place — your device calendars, or .ics feeds on the web
> • Habit tracker, goals, and milestones
> • Repeating tasks and native task alarms so nothing slips
> • Connect your AI — an MCP server lets Claude, ChatGPT, Gemini, and Cursor
>   plan alongside you
> • Customizable themes, on iPhone, iPad, and the web
>
> Your data is yours. Dexter uses row-level security, ships with no
> third-party analytics, and never sells your data — delete everything at any
> time.
>
> Dexter is open source under the MIT license: https://github.com/cvburgess/dexter

Copy is seeded from `CHANGELOG.md` (v2.0.0), `www/src/_data/features.json`,
and `www/src/method.md`. Keep this description in sync with those when the
product changes.

## Review notes

Provide the App Store reviewer with the demo account credentials (sent
separately, never committed):

```
Email: <DEMO_EMAIL>
Password: <DEMO_PASSWORD>
```

- The demo account is reset to a curated, known-good state by
  `supabase/scripts/seed-demo.ts` (see `supabase/scripts/README.md`). Re-run it
  before capturing screenshots or submitting for review so the data is fresh.
- **Task alarms** use AlarmKit and require **iOS 26+**; on older versions the
  "Set alarm" action is hidden. Sign-in is passwordless magic-link email or
  "Continue with Google".
- The **MCP server** and calendar feeds are optional and not required to
  review core planning functionality.

## Screenshots

Not captured yet. Device-framed screenshots should be added under
`www/src/assets/screenshots/` (auto-published by `www/_config.ts`'s
`site.add("/assets")`) so the same set can power the marketing site and the
App Store listing. Track that work separately from this doc.

Required iPhone sizes for submission: 6.9" (1320 × 2868) and 6.5"
(1242 × 2688). See Apple's current
[screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).
