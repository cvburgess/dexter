# Design tokens

`src/utils/theme.ts` is the single source of truth for every color, size, and
space in the app. This file describes what each token means and when to reach
for it. `docs/frontend.md`'s Theming section covers the *plumbing* — how a theme
is resolved from the user's preferences and supplied through context.

The rule this document exists to enforce: **no style value is written as a
literal.** Every color, font size, radius, spacing step, control size, and icon
size comes from `useTheme()`. The exceptions are enumerated at the bottom, and
that list is meant to stay short.

## Shape

A theme has two halves, composed by `useTheme()`:

| Half | Varies by | Lives in |
| --- | --- | --- |
| `colors` (`TThemeColors`) | which theme the user picked | `themes` |
| everything else (`TDensityTokens`) | screen size and platform | `DENSITY` |

`resolveTheme()` picks the palette; `useTheme()` adds the density tier. A
component only ever sees the composed `Theme`, so neither half is a special
case at the call site.

## Surfaces

Three steps, dark to light in a light theme and light to dark in a dark one:

| Token | Sits | Used for |
| --- | --- | --- |
| `surfaceSunken` | **below** `background` | The app's nav rail and dock |
| `background` | the baseline | Screen bodies, panes, the sheet behind cards |
| `card` | **above** `background` | Cards, inputs, stack headers, nav tiles |

The distinction is what makes chrome recede behind the content beside it. A pane
of content is always `background`; the navigation that frames it is
`surfaceSunken`; anything that should read as lifted off the page is `card`.
Nothing else is a surface — do not invent a fourth by alpha-filling one of these.

`surfaceSunken` marks the app's *outermost* navigation, not every list that
happens to sit on the left. The settings sidebar is deliberately `background`:
it and the detail pane are two halves of one settings surface, and sinking it
grouped it with the nav rail further left instead. Its hairline right border is
what separates the two, so that border is load-bearing.

## Priority colors

Three parallel arrays, indexed by `ETaskPriority`:

| Token | What it is | Used for |
| --- | --- | --- |
| `priority[i]` | the full-strength accent | Dots, bars, badges, menu icons, the overdue due-date pill |
| `priorityMuted[i]` | `priority[i]` pre-blended over `background` at 80% | The solid fill of a task card |
| `priorityContent[i]` | text readable on top of `priority[i]` | Labels and outlines drawn on a card |

`priorityMuted` is computed once per theme at module load, not at render time.
That is the point of it: a card composited at 80% alpha takes on whatever pane
is behind it, so the same task read as two different colors depending on which
column it was in. Pre-blending makes the fill opaque and stable.

The one deliberate alpha left on a card is the completed state — a 3% tint of
the raw `priority[i]`. It is meant to read as the *absence* of a card rather
than as a fourth surface color, so it does not get a token.

## Border

`colors.border` is the app's one hairline. It is opaque and tuned per theme
rather than derived as an alpha of `text`: a single alpha that reads correctly
on a light surface is invisible on a dark one. Light themes get a border darker
than their surface; dark themes get one *lighter* than theirs.

Use it for every divider and every hairline outline. The two places that
correctly do something else both draw on a colored fill rather than on a
surface, and derive their outline from the fill's own content color:
`StatusButton`'s circle and `ListButton`'s, where a neutral hairline would wash
out against the priority color behind it.

## Radius

`radii.md` is the app's **one** corner radius — cards, inputs, panes, tiles,
buttons all share it. It does not change between density tiers: a card should
read as the same card on a phone and a desktop, just a smaller one.

`radii.full` is for shapes meant to be circles or pills (status buttons,
priority chips, habit tiles, the due-date badge). It is deliberately not a point
on a radius scale — a shape is either cornered or round.

There is no `sm`/`lg` radius. If something looks like it needs one, it is
probably the wrong size rather than the wrong radius.

## Spacing

`space.xs` / `sm` / `md` / `lg`, used for padding, margins, and flex gaps alike.

- `md` is the standard screen inset and the gutter every pane lines up on.
- `sm` is the in-group gap — controls in a row, cards in a list.
- `xs` separates a label from the thing it labels.
- `lg` separates *groups* — the gap between settings sections, and the bottom
  padding that clears a sheet's edge.

The `lg`-between / `sm`-within pairing on the settings screens is deliberate:
the two had been the same step, so nothing on those screens read as grouped.
The inner step is `sm` rather than `xs` because a section title labels a whole
group rather than a single control — at `xs` it sat close enough to its first
row to read as part of it.

## Type scale

Six roles. Each is a `{ fontSize, fontWeight }` pair, so applying a role sets
both — spread it into a style rather than reading `.fontSize` off it.

| Role | Weight | Answers | Used for |
| --- | --- | --- | --- |
| `subtitle` | 400 | what else should I know about this thing | The second line under a `title` — a row's detail, a section's explanation |
| `body` | 400 | — | Running prose, empty states, row labels, calendar event names |
| `control` | 600 | — | Buttons, text inputs, date/time pickers |
| `title` | 600 | what is this thing | A component's primary line — a row's name, a field's label, a section heading |
| `heading` | 700 | what screen am I on | Screen and detail-pane headings |
| `display` | 900 | — | The login splash only |

`title` and `subtitle` are a **pair**: seven components render one directly
above the other (`ListRow`, `HabitRow`, `SettingsRow`, `TemplateRow`,
`SearchResultCard`, `WeekDayColumn`, `SettingsSectionTitle`). If you are
reaching for `subtitle`, there should be a `title` above it.

`heading` is not "a bigger `title`" — it is a different axis. `title` names a
*component*; `heading` names the *screen or pane*, and there is one per view.

**`control` must never drop below 16 on `comfortable`.** iOS Safari zooms the
page whenever a focused input's font-size is under 16px, and `components/TextInput.tsx`
has no `.web` variant, so it renders on mobile web where `comfortable` applies.
`control` carries the same values as `title` today and exists as its own role
precisely so that tuning `title` for density cannot silently reintroduce that
zoom.

**Pick the role, not the nearest size.** The roles carry weight as well as size,
so a 15pt semibold label is a `title` even though 15 is closer to `body`'s size.
Asking "what is this text *for*" gives the right answer; measuring it does not.

## Controls

`controls.md` is the diameter of a round icon button or a tile;
`controls.sm` is an inline control inside a row (the status circle, the list
button, the due-date badge). Sizes that sit *between* the two are derived from
them rather than added to the scale — the web nav rail's tile is
`controls.md + space.sm`, and a subtask's circle is three quarters of
`controls.sm` (see `subtaskGeometry` in `components/SubtaskConnector.tsx`, which
derives the whole checklist layout from one place so the connector rail can't
drift away from the rows it joins).

## Icons

`icons.sm` is an inline affordance (a chevron, a menu glyph); `icons.md` is a
row's or nav item's leading icon. Kept separate from `fonts` because an icon's
optical size doesn't track the type beside it — a 20pt icon reads as the peer of
a 16pt label.

**Emoji are icons**, not type: an emoji standing in for an icon (list tiles,
habit tiles, habit rings) is sized from `icons`, not from a font role.

## Density tiers

Two explicit tiers. **`compact` is web-only**, applying at and above
`LARGE_DEVICE_MIN_WIDTH` (768); everything else — every native device at every
width, and web below the breakpoint — is `comfortable`. Both are written out in
full rather than derived from a multiplier: spacing wants to tighten harder than
type does, and literals keep every value an integer.

| | `space` xs/sm/md/lg | `fonts` subtitle/body/control/title/heading/display | `radii` md/full | `controls` md/sm | `icons` sm/md |
| --- | --- | --- | --- | --- | --- |
| comfortable | 4 / 8 / 16 / 24 | 12 / 14 / 16 / 16 / 24 / 40 | 12 / 999 | 40 / 32 | 14 / 20 |
| compact | 3 / 6 / 12 / 18 | 11 / 13 / 14 / 14 / 20 / 32 | 12 / 999 | 32 / 26 | 12 / 18 |

Because `StyleSheet.create` values are static, anything that varies by tier goes
in the inline style array — the pattern `docs/frontend.md` already prescribes for
colors. In practice a `StyleSheet` entry ends up holding only layout
(`flexDirection`, `alignItems`, `position`, `flex`), which is the right split.

Density keys off `useIsLargeDevice()` rather than `useWindowDimensions` directly,
so a test that already mocks the breakpoint gets the matching tier for free. It
also checks `Platform.OS`, so a test asserting the compact tier has to say it is
on web — jest-expo's preset runs as iOS.

**Why `compact` stops at the browser.** It is a *pointer* tier, not a width
tier: it exists because the phone-tuned sizing read too large next to the legacy
desktop web app, where a cursor hits a 26dp target as easily as a 40dp one. A
tablet has the width but not the input — `controls.sm` at 26dp is well under the
44pt iOS minimum tap target, and an iPad on this tier reads cramped rather than
refined. Reach for a new tier before widening this one to touch.

## Iconography

Every icon names **both** an SF Symbol and an Ionicon, and goes through
`components/Icon.tsx` (`Icon.ios.tsx` draws the SF Symbol; `Icon.tsx` draws the
Ionicon on Android and web). `TIconName` requires both names, so neither can be
forgotten.

This exists because `expo-symbols` accepts an `{ ios, android, web }` name object
and silently falls back to **Google's Material Symbols** off iOS — which is how
the app ended up rendering two entirely different icon sets depending on the
platform. Naming the Ionicon explicitly is what keeps web and Android on
Dexter's own set. Menu options (`TIconMenuOption.icon`) carry the same pair.

Two documented exceptions:

- **`NativeTabs.Trigger.Icon`** accepts only `sf` plus `md` (an Android
  drawable / Material name). An Ionicon cannot be passed, so the four tab icons
  in `app/(app)/(tabs)/_layout.tsx` keep their Material names.
- **`NoteEditor.native.tsx`**'s four formatting toggles (bold, italic,
  underline, strikethrough). Ionicons has no glyph for any of them, so there is
  nothing to convert them to. That file is `.native.tsx`, so the web half of the
  fallback is unreachable and only Android draws a Material Symbol.

## Scrims and shadows

Neither is a token; both are derived with `withOpacity` from a theme color, and
which color depends on the job:

- **Shadows and hairline scrims** derive from `colors.text`. A shadow tuned for
  a light surface is invisible on a dark one, and `text` is the maximum-contrast
  color against whatever surface it sits on.
- **Full-screen backdrops** (the web confirmation modal, the emoji picker)
  derive from `colors.background` at high opacity. A black wash all but
  disappears over a dark theme, while the app's own background always pushes the
  page back a step on either scheme.

`withOpacity` is also still the right tool for dimming content (a disabled row,
the completed-card tint). It is *not* the right tool for a tinted surface — use
a pre-blended token, or the fill takes on whatever is behind it.

## Documented exceptions to "no literals"

Everything below is a deliberate literal. Adding to this list should be
uncomfortable.

- **`CalendarView`'s coordinate system.** `GUTTER_WIDTH`, `HOUR_HEIGHT`,
  `GUTTER_INSET`, `EVENT_GAP`, `NOW_DOT_SIZE` and friends position the hour
  labels, hour lines, now line, and events area against each other. They
  misalign the moment one of them moves independently, so the whole system stays
  fixed and lives in named constants at the top of the file.
- **`CalendarView`'s decorative marks** — the now line's 2px height and 1px
  radius, and the event accent bar's 3px width and 2px radius. These are strokes,
  not shapes with corners; `radii` has nothing to say about them.
- **The subtask checklist's 2px row gap** (`subtaskGeometry`). The rows read as
  one stacked block; anything on the spacing scale separates them into cards.
- **Component dimensions that answer a content question, not a design one** —
  the settings sidebar's 280pt width, the web menu's 220pt minimum width, a
  three-digit numeric field's 56pt minimum. These are "how wide must this be to
  hold its content", which no scale answers.
- **`0`.** A reset (`padding: 0` to undo an inherited inset) is not a spacing
  step.

## Where the palettes came from

Each theme is a daisyUI theme ported oklch → hex, mapping
`background = base-200`, `card = base-100`, `surfaceSunken = base-300`,
`text = base-content`, and the priority arrays =
`[warning, error, info, base-100, neutral]` with their `-content` pairs.
`border` is the exception: daisyUI has no border token, and `base-300` would be
*darker* than the surface in a dark theme, so each theme supplies one tuned to
sit against its own surface.

`dexter` is Dexter's own brand theme (green primary on a warm base); the rest are
faithful ports of the daisyUI themes of the same name.

**`src/utils/theme.ts` is canonical.** The marketing site (`/www`) carries its
own daisyUI variables in `src/index.css` and they do not currently agree with the
app's — `dexterplanner.com/brand` renders the app's values directly from inline
hexes for exactly that reason. Reconciling the two is not done.
