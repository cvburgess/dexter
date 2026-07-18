# Dexter — an opinionated day planner for iOS, Android, and the web

> The day planner that fixes _everything_ ... just kidding, but it will help you **get and stay organized** — and it's pretty, too!

<picture>
  <source srcset="https://dexterplanner.com/assets/screenshot-dark.png" media="(prefers-color-scheme: dark)" />
  <source srcset="https://dexterplanner.com/assets/screenshot-light.png" media="(prefers-color-scheme: light)" />
  <img src="https://dexterplanner.com/assets/screenshot-light.png" alt="Dexter app screenshot" />
</picture>

**[Open the web app](https://app.dexterplanner.com)** · [Website](https://dexterplanner.com) · [The Dexter Method](https://dexterplanner.com/method) · [Connect your AI](#connect-your-ai)

## What is Dexter?

Dexter fills the gap between planners that are _too simple to be useful_ and ones that are _too complicated to use every day_. It's carefully crafted to help you get more done while avoiding the trap of busyness — we call this [**the Dexter Method**](https://dexterplanner.com/method).

Prioritize with the Eisenhower Matrix, plan your day intentionally, brain-dump to quiet the anxiety, and keep your whole day — tasks, notes, journal, and calendar — in one place.

## Features

- [x] Prioritization (an adaptation of the Eisenhower matrix)
- [x] Quick Planner backlog triage — surface tasks that are overdue, due soon, or left behind
- [x] Markdown notes & a customizable journal with reflection prompts
- [x] Calendars in one place — device calendars on mobile, `.ics` feeds (Google, Outlook, iCloud, …) on web
- [x] Habit tracker
- [x] Goals & milestones — because being busy != being productive
- [x] Repeating tasks
- [x] Native task alarms so nothing slips (iOS 26+, via AlarmKit)
- [x] MCP server — plan alongside Claude, ChatGPT, Gemini, and Cursor
- [x] Customizable themes (`dexter`, `light`, `dim`, `dark`, `abyss`) with light/dark/system modes
- [x] One universal app for iOS, Android, and web
- [x] Fully deletable data — no third-party analytics, and we never sell your data
- [ ] Week-at-a-glance view
- [ ] Focus blocks (Pomodoro technique)
- [ ] Full-text search for tasks and notes
- [ ] Subtasks
- [ ] Fully exportable data

## Connect your AI

Dexter exposes a [Model Context Protocol](https://modelcontextprotocol.io) server, so any MCP-compatible assistant can plug into your planning data. Plan your day, capture tasks, and review what you wrote in your journal just by asking.

- **Server URL:** `https://api.dexterplanner.com/functions/v1/mcp-server`
- **Works with:** Claude (claude.ai, Claude Desktop, Claude Code), ChatGPT, Gemini CLI, Cursor, and other MCP clients

See the [MCP setup guide](https://dexterplanner.com/tips/mcp-server) for connection steps.

## For developers

Dexter is a monorepo:

| Directory | What it is |
|-----------|------------|
| [`/src`](src/) | Expo (React Native) app — iOS, Android, and web |
| [`/supabase`](supabase/) | Supabase backend — PostgreSQL + RLS, Auth, and Deno Edge Functions |
| [`/www`](www/) | Lume marketing site for [dexterplanner.com](https://dexterplanner.com) |
| [`/docs`](docs/) | Engineering documentation |

### Quick start

| Area | Command |
|------|---------|
| App | `cd src && npm install --legacy-peer-deps && npm start` |
| Backend | See [`supabase/README.md`](supabase/README.md) |
| Website | `cd www && deno task serve` |
| Docs | Start with [`docs/frontend.md`](docs/frontend.md) and [`docs/backend.md`](docs/backend.md) |

### Contributing

Found a bug or have a feature idea? Open a [GitHub issue](https://github.com/cvburgess/dexter/issues) (or use the in-app Settings menu).

Dexter is maintained by a solo indie developer, so please be kind and patient — features get added when they're something worth maintaining. Pull requests are welcome but never required. If Dexter makes your life a little easier, consider [sponsoring the project](https://github.com/sponsors/cvburgess) to help cover hosting (and the occasional matcha latte).

## License

Dexter is open source under the [MIT License](LICENSE).
