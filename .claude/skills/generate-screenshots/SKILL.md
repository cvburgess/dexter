---
name: generate-screenshots
description: Capture App Store screenshots for iOS on a simulator, at accepted dimensions with no alpha channel. Use when the user wants new App Store screenshots, is preparing a submission, or hit a "wrong dimensions" rejection from App Store Connect.
allowed-tools: Bash, Read, Write, Edit, Glob
---

# Generate App Store Screenshots

The capture itself is one command:

```sh
DEMO_OTP=... scripts/screenshots/capture.sh --device all --build
```

It creates and boots the simulators, verifies their geometry before building,
makes a Release build, signs in as the demo account, walks the manifest in
`scripts/screenshots/screens.tsv`, strips the alpha channel, and **exits
non-zero if any file would be rejected by App Store Connect**. Output lands in
`www/src/assets/screenshots/{iphone,ipad}/`.

`scripts/screenshots/README.md` explains why it is built that way and lists the
mechanical gotchas. Everything below is the judgment the script cannot hold.

## Before the run

**Ask for `DEMO_OTP`.** It is a Supabase function secret. Never write it into a
committed file — the script takes it from the environment and passes it to
Maestro at runtime.

**Point the app at production.** The demo account lives only there:

```sh
.claude/skills/use-preview-branch/scripts/swap-env.sh --prod
```

The script checks this and refuses otherwise, but doing it first saves a cycle.

## Reconciling the demo data

This is the part worth thinking about, and the reason this skill still exists.

`supabase/scripts/seed-demo.ts` deletes and re-inserts **every** row for
`demo@dexterplanner.com`. **Reconcile `supabase/scripts/demoData.ts` against the
live data before reseeding, not after** — otherwise hand-edits made in the app to
stage a shot are silently reverted and the screenshots capture stale state.

Diff live against the seed first (project `isreileykodwkyedcewv`):

```sql
select t.title, t.priority, t.status,
       (t.scheduled_for - current_date) as sched_off,
       (t.due_on - current_date) as due_off, l.title as list
from tasks t left join lists l on l.id = t.list_id
where t.user_id = (select id from auth.users where email='demo@dexterplanner.com')
order by t.scheduled_for nulls last, t.priority, t.title;
```

If the only delta is a few added rows, **insert those directly instead of a full
reseed** — a reseed resets the demo password, which the App Store reviewer also
uses. Otherwise prefer the workflow over passing production credentials on your
own shell:

```sh
gh workflow run "Reset Demo Account" --repo cvburgess/dexter
```

Day offsets are relative to "today", so dates always look current. The account
also reseeds itself daily at 12:00 UTC (`.github/workflows/reset-demo.yml`).

If you change which tasks appear on a captured screen, check the anchors in
`screens.tsv` still exist — they are demo-data strings, and
`src/utils/__tests__/screenshotManifest.test.ts` only checks the links, not the
anchor text.

## After the run

**Read every image back.** The script verifies dimensions and alpha, which is
what App Store Connect checks — it cannot tell you a permission dialog is open, a
menu is showing, or a screen rendered empty. Those are obvious in the picture and
invisible in the exit code.

To change the set, edit `scripts/screenshots/screens.tsv` — a screenshot is a
row, not a new flow file — and re-run with `--screens` to capture just the ones
you changed.

Uploading to App Store Connect is manual; no workflow does it.
`docs/appstore.md` has the listing metadata.
