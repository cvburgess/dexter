---
title: "MCP server"
layout: layouts/tips.vto
---

# MCP server

Plan your day, capture tasks, and review what you wrote in your journal just by
asking. Dexter exposes a
[Model Context Protocol](https://modelcontextprotocol.io/) server, so any
MCP-compatible assistant can connect to your planning data.

**Server URL**

```
https://api.dexterplanner.com/functions/v1/mcp-server
```

## What it can do

Most of what you can do inside Dexter is available through the connector. Some
examples:

- _"Plan my day tomorrow around my calendar and top priorities."_
- _"Create a list called 'Q3 Goals' and add three tasks to it."_
- _"Move all unscheduled high-priority tasks to this week."_
- _"Summarize what I journaled about last week."_

## Claude

Works on Claude.ai, Claude Desktop, and Claude Code.

**Claude.ai or Claude Desktop.** Open Settings → Connectors → Add custom
connector, then paste the server URL.

**Claude Code.** Run:

```
claude mcp add --transport http dexter https://api.dexterplanner.com/functions/v1/mcp-server
```

## ChatGPT

Custom MCP connectors in ChatGPT run in Developer Mode. Plus and Pro accounts
can read your planning data; writing (creating or updating tasks, lists, goals)
needs Business, Enterprise, or Edu.

1. Open **Settings → Apps & Connectors → Advanced settings** and toggle
   **Developer Mode** on.
2. Go to **Apps & Connectors → Add new connector**.
3. Name it _Dexter_, paste the server URL, set authentication to **OAuth**,
   check "I trust this application", and click **Create**.

## Gemini CLI

Add Dexter to your Gemini CLI config at `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "dexter": {
      "httpUrl": "https://api.dexterplanner.com/functions/v1/mcp-server"
    }
  }
}
```

Restart Gemini CLI; it'll prompt you to sign in to Dexter the first time it
calls a tool.

## Cursor and other MCP clients

Dexter speaks Model Context Protocol over Streamable HTTP. Any MCP-compatible
client — Cursor, MCP Inspector, your own agent — can connect using the server
URL above.

## Authorizing

You'll need a [Dexter account](https://app.dexterplanner.com). The first time
your assistant calls a tool, it opens Dexter in your browser. Sign in if you
aren't already, then you'll land on a consent screen that names the app
requesting access and lists what it can reach — your tasks, lists, goals, days,
habits, and journals. Choose **Approve** to connect (or **Deny** to cancel), and
your browser returns you to the assistant.

After that, your assistant can use the connector until you revoke it from its
settings.
