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

A theme has two halves, composed by `useTheme()`: `colors` (`TThemeColors`)
varies by which theme the user picked and lives in `themes`; everything else
(`TDensityTokens`) varies by screen size and platform and lives in `DENSITY`.
`resolveTheme()` picks the palette; `useTheme()` adds the density tier. A
component only ever sees the composed `Theme`.

## Surfaces

Two steps, and the direction is the point: **content is the lightest plane in
the app, and everything that frames content recedes from it.**

| Token | daisyUI | Used for |
| --- | --- | --- |
| `background` | `base-100` | Screen bodies, panes, the sheet behind cards, the nav rail's tiles |
| `surfaceSunken` | `base-200` | Cards, inputs, rows, menus, stack chrome, the nav rail and dock |

This is the inverse of a "cards float above the page" ramp, and it is deliberate
(DEX-61): the legacy web app anchors content on `base-100`, and anchoring a rung
lower made every screen read a step darker than the app it replaces.

Ask "is this content, or is it holding content?" Nothing else is a surface — do
not invent a third by alpha-filling one of these. The nav rail is the one place
both tokens meet head-on: a `surfaceSunken` rail with `background` tiles, the
legacy nav exactly. The settings sidebar is deliberately `background`, not
sunken: it and the detail pane are two halves of one settings surface, and
sinking it grouped it with the nav rail instead. Its hairline right border is
load-bearing — it is what separates the two.

## Priority colors

Three parallel arrays, indexed by `ETaskPriority` (`src/utils/taskPriority.ts`):
`priority[i]` (the full-strength accent), `priorityMuted[i]` (the solid fill of
a task card), `priorityContent[i]` (text readable on top of `priority[i]`).

- **`priorityMuted` is pre-blended over `background` at 80%, at module load.**
  A card composited at 80% alpha at render time took on whatever pane was behind
  it, so the same task read as two colors depending on its column.
- **`priorityMuted[NEITHER]` is `surfaceSunken` outright, not a blend**
  (DEX-114): `priority[NEITHER]` is `base-100`, so blending it dissolves the
  card into the pane.
- **`priority[UNPRIORITIZED]` is always the theme's `text`**, never daisyUI's
  `neutral`. The unprioritized card and the active nav tile are the same mark —
  a block of ink — and `neutral` is a dark swatch on every daisyUI theme, which
  inverted the pair on dark themes (DEX-114).
- **Task cards have no outline** (DEX-114). The fill is the whole shape; a
  hairline read as a second edge.
- The one deliberate alpha left on a card is the completed state — a 3% tint of
  raw `priority[i]`, meant to read as the *absence* of a card. No token.

## Sentiment

A horoscope's sentiment colors the Ritual tab's Horoscope panel (DEX-128).
`sentimentTints(sentiment)` returns the two ends it breathes between —
**fixed brand colors, not theme tokens** (positive = green `#021c1a→#032622`,
negative = purple `#1d0218→#270220`, mixed = blue `#070e1d→#0a1429`). The panel
has to say *green day / purple day / blue day* at a glance, which a token that
changes hue with the user's palette cannot do. This is a listed exception at the
bottom of this file.

**Sentiment is derived, not sent** (DEX-145): the database generates it from
the upstream's 1-5 `overall_rating`, and `ratingBucket()` in `utils/horoscope.ts`
groups each of the day's twelve life areas with the *same* thresholds. One rule
at two scales — the whole day, and one area of it — so a green card can never
sit over a band of down arrows.

Those bands' circles reuse **the panel's own colors** rather than a second
palette — `sentimentTints(bucket).peak`, so a band and a day of the same mood
are literally the same hue. A brighter set was tried and cut: it read as a
fourth vocabulary competing with the card behind it, and it meant three more
literals on the list below. The cost is that these fills sit at the panel's own
~6-10% lightness, so **the hairline is what describes the shape**, not the fill.
That is also why it is an edge and not a shadow, per **Scrims and shadows**
below: a near-black card shows no lift at all.

**It is a night sky on every theme, light ones included** — a pale set for
light schemes was tried and cut. That makes it the app's one surface that does
not follow the user's scheme, so **anything drawn on it takes
`sentimentInk(theme)`, never `colors.text`** — on a light theme `colors.text`
is near-black ink on a near-black panel. `theme.test.ts` pins the legibility.
The hues sit at ~6% lightness (the first cut sat at 11–19% and dissolved into
`dim`'s background) with deliberately high saturation, both authored ends —
deriving `peak` by blending toward a paler shade washed every hue toward the
same grey.

The breath's mechanics, each learned by getting it wrong first:

- **It animates `opacity`, not `backgroundColor`** — the same picture, not the
  same work: `backgroundColor` re-paints a screen-sized layer every frame and
  re-parses an rgba string; `opacity` is a compositor property. That was the
  difference between a slideshow and a fade.
- **It eases linearly** — a color has no momentum to sell, and ease-in-out read
  as stepping.
- **Amplitude and pace are one setting**: the largest per-channel delta between
  the ends is the number of distinct colors the breath can show, so narrowing
  the amplitude without shortening `BREATHE_LEG_MS` just holds each shade
  longer.

The panel is framed as a tarot card: a `space.md` white (`SENTIMENT_FRAME`)
border on **three sides, not four** — the card runs off the bottom of the
screen, and a line across the bottom would say it stopped there.
`colors.border` was tried for the frame and abandoned: that token is darker
than its surfaces, so it drew the frame from opposite sides on the two schemes.
The breathing tint layer carries the frame's inner radius itself; its parent
deliberately does not clip, because `overflow: hidden` on a rounded view is
re-composited every frame the tint changes.

The panel carries a drawn starfield (`components/StarField.tsx`) in
`sentimentInk` at partial opacity, and the content fades in on arrival in
reading order — one shared value with overlapping windows, keyed on the
horoscope's *date* so walking `DayNav` replays it and a refetch does not.
Reduce Motion jumps straight to visible. With no mood to show, the panel falls
back to `surfaceSunken` and draws neither stars nor frame.

## Border

`colors.border` is the app's one hairline — opaque and tuned per theme, because
a single alpha of `text` that reads on a light surface is invisible on a dark
one. **A divider is always darker than the surfaces it divides** — a line is
drawn by taking light away, never by adding it back. `theme.test.ts` pins the
ordering.

The places that correctly do something else derive their line from what it is
drawn *on*: `StatusButton`/`ListButton` circles take the fill's content color;
`CalendarView`'s hour lines take `text` at 25% to read with the hour labels.
`TaskDropTarget`'s drag highlight is the one non-hairline border: 2px in
`colors.primary`, and the width is *reserved* (transparent until hover) so
highlighting a drop target costs no layout — introducing the width on hover
would reflow every card in the region.

## Radius

`radii.md` is the app's **one** corner radius, identical across density tiers —
a card reads as the same card on a phone and a desktop, just smaller.
`radii.full` is for circles and pills. There is no `sm`/`lg`: if something
looks like it needs one, it is probably the wrong size rather than the wrong
radius.

## Spacing

`space.xs` / `sm` / `md` / `lg`, for padding, margins, and flex gaps alike:
`md` is the screen inset and pane gutter; `sm` the in-group gap; `xs` separates
a label from what it labels; `lg` separates *groups*. The `lg`-between /
`sm`-within pairing is deliberate — when both were one step nothing read as
grouped, and the inner step is `sm` not `xs` because a section title labels a
group, not a control.

**The group step lives in `SettingsSectionTitle`, not in the screens** — `lg`
above itself, `sm` below. When the `lg` was a `gap` on the settings screens, a
title rendered anywhere else (Search's results) got no separation at all. The
heading is not a member of the group it heads, so no uniform parent `gap` can
place it — the one case where a component owning its own surrounding space is
correct.

## Who owns spacing

**A component never pads itself away from its container's edge. Whoever placed
it does.** (DEX-115)

The same components lay out differently on a phone, an iPad, the web, and a Mac
window, and each host wants a different gutter — or none. A component that
hard-codes one can only be placed one way; that is how the Today view got a
`md + sm` gap on one side of Notes and `sm` on the other.

What a component *does* own:

- **Space between its own parts** — a list's `gap`, a card's internal padding.
- **Anything tied to its own scrolling** — `insets.bottom` on a
  `contentContainerStyle` exists so content scrolls *under* the translucent tab
  bar, which only works from inside the scroller; on a parent it shrinks the
  viewport and the last row can never clear the bar.
- **Appearance variants** — `NotesView`'s `card` prop is chrome, not layout;
  the give-away is that it changes what the component *is*, not where it sits.

Where the gutters live: `SwipeablePage` supplies the phone's side gutter once
per page; `LargeScreenToday` and `WeekView` supply theirs on the pane row; the
panes and Week columns supply none. The Ritual tab is the one place
`SwipeablePage` keeps that gutter on large screens too; its top inset is `md`
on the phone and `md * 2` above the breakpoint, both derived from the same
token so they cannot drift. It is also the only swipeable page above the
breakpoint, so it is where `SwipeablePage`'s width cap shows: the page holds a
centered column of at most `SWIPEABLE_PAGE_MAX_WIDTH` (DEX-138) — uncapped, the
horoscope summary became one 1400dp sentence — while the gesture stage stays
full-bleed so a drag starting in the margin still pages.

Reach for a `padding`/`inset` prop only after checking whether the caller can
just wrap the thing in a padded view — it almost always can.

## Type scale

Six roles, each a `{ fontSize, fontWeight }` pair — spread the role into a
style rather than reading `.fontSize` off it.

| Role | Weight | Used for |
| --- | --- | --- |
| `subtitle` | 400 | The second line under a `title` |
| `body` | 400 | Running prose, row labels, what a text input holds |
| `control` | 600 | Buttons and the web date/time pickers |
| `title` | 600 | A component's primary line |
| `heading` | 700 | Screen and detail-pane headings |
| `display` | 900 | The login splash only |

**`subtitle` and `body` deliberately resolve to the same numbers** — a row's
second line is content, and at a smaller size it read as fine print. The roles
stay separate because only `subtitle` is pinned to `title`: if `title` moves,
`subtitle` follows and `body` does not. Pick by role, not by measuring —
`heading` is not "a bigger `title`", it names the screen where `title` names a
component.

**A field's text is `body`; a button's label is `control`.** Known cost: iOS
Safari zooms the page when a focused input's font-size is under 16px, and
`body` is 14 on `comfortable` — accepted knowingly (DEX-61); the fix if it
bites is a 16px floor on web in `components/TextInput.tsx`, not pushing the
role up.

## Font families

**The system face is the app's voice, and `SERIF` is its second one.** Every one
of the six roles above carries a size and a weight and no family, because until
DEX-145 there was exactly one face — a role said how loud a thing is, never in
what voice. `SERIF` (`utils/theme.ts`, Playfair Display) is the exception, and
it is scoped by intent rather than by size: reach for it where the app is
*saying* something, not where it is labelling something. Today that is one
place, the Horoscope step's hero.

Two things to know before using it:

- **A custom family name maps to exactly one file.** There is no
  family-plus-weight resolution the way there is on the web, so anything set in
  `SERIF` must also set `fontWeight: "normal"` and `fontStyle: "normal"` — the
  loaded file already carries both, and leaving a role's weight in place gets a
  *synthetic* bold or oblique stacked on a real one. On a typeface picked for
  its italic that is exactly the wrong result, and it fails invisibly: the text
  still renders, just smeared.
- **Adding a cut costs a download.** Each weight/style is a separate ~100-200KB
  asset, imported in `app/_layout.tsx` and named in `SERIF`. Load only what is
  used.

This is also the app's **only startup gate**: `app/_layout.tsx` holds the splash
until the font is in memory. That is not caution on principle — the hero fades
in over ~3.6s, so a face that swaps a frame after first paint does it in full
view rather than under a splash the way a normal cold start would hide it.

## Controls

`controls.md` is a round icon button or tile; `controls.sm` an inline control
inside a row. In-between sizes are derived, not added to the scale — a
subtask's circle is three quarters of `controls.sm` (`subtaskGeometry` in
`components/SubtaskConnector.tsx` derives the whole checklist layout from one
place so the connector rail can't drift from its rows).

## Icons

`icons.sm` is an inline affordance (chevron, menu glyph); `icons.md` a row's or
nav item's leading icon — deliberately half again the type beside it, because
at parity the glyph read as subordinate to its own row's title. One exception:
a disclosure chevron opposite an `icons.md` leading glyph takes `icons.md` too
(`SettingsRow`), or the row reads lopsided.

**Emoji are icons**, sized from `icons`, not from a font role. The Ritual tab's
zodiac glyphs are `<Text>` (no icon set carries a zodiac) and **carry a
trailing U+FE0E**: those code points default to emoji presentation in a palette
no theme controls, and the variation selector is what lets the mark take
`colors.text`. Any future glyph from the emoji-presentation ranges needs the
same treatment — the Horoscope step's three rating arrows (DEX-145) are the
second case. **Pick marks that share a Unicode block.** Those started as faces
and could not: U+2639/U+263A carry the two ends, but Unicode's only
expressionless face is U+1F610, in the emoji block, so the middle mark came from
a different font at a different weight and the row read uneven.
U+2191/U+2192/U+2193 are one family and solve it outright.

**A hero mark is derived, not tokenized** — the Horoscope step's sign glyph is
`controls.md * 2` (DEX-128), the same move `subtaskGeometry` makes, and still
scales with the density tier.

## Density tiers

Two explicit tiers, written out in full rather than derived from a multiplier —
spacing tightens harder than type does, and literals keep every value an
integer.

| | `space` xs/sm/md/lg | `fonts` subtitle/body/control/title/heading/display | `radii` md/full | `controls` md/sm | `icons` sm/md |
| --- | --- | --- | --- | --- | --- |
| comfortable | 4 / 8 / 16 / 24 | 14 / 14 / 16 / 16 / 24 / 40 | 12 / 999 | 40 / 32 | 14 / 24 |
| compact | 3 / 6 / 12 / 18 | 12 / 12 / 14 / 14 / 20 / 32 | 12 / 999 | 32 / 26 | 12 / 22 |

**`compact` is web-only**, at and above `LARGE_DEVICE_MIN_WIDTH` (768). It is a
*pointer* tier, not a width tier: a cursor hits a 26dp target as easily as a
40dp one, but `controls.sm` at 26dp is well under the 44pt iOS minimum tap
target, so a tablet — the width without the input — stays `comfortable`. Reach
for a new tier before widening this one to touch.

Because `StyleSheet.create` values are static, anything that varies by tier
goes in the inline style array; a `StyleSheet` entry ends up holding only
layout. Density keys off `useIsLargeDevice()` plus `Platform.OS`, so a test
asserting the compact tier has to say it is on web — jest-expo runs as iOS.

## Iconography

Every icon names **both** an SF Symbol and an Ionicon through
`components/Icon.tsx`; `TIconName` requires both. This exists because
`expo-symbols` silently falls back to **Google's Material Symbols** off iOS,
which is how the app once rendered two different icon sets by platform.

Two documented exceptions: `NativeTabs.Trigger.Icon` accepts only `sf` + `md`
names, so the four tab icons keep Material names; and
`NoteEditor.native.tsx`'s four formatting toggles have no Ionicons equivalent
(the file is `.native.tsx`, so only Android draws a Material Symbol).

## Scrims and shadows

Neither is a token. A scrim is derived with `withOpacity` from a theme color; a
shadow is a literal Tailwind value.

- **Popovers and context menus get no scrim at all** (DEX-125) — an OS context
  menu floats over untouched content, and a wash reads as a modal dialog. The
  invisible full-viewport layer stays (it catches the dismissing click).
  Separation comes from the popover's own `colors.border` hairline plus shadow,
  because a `surfaceSunken` menu on `surfaceSunken` rows has no edge otherwise.
- **Shadows are black on every theme** — a shadow is the absence of light, the
  same rule that keeps dividers dark; deriving one from `text` painted a pale
  halo on dark themes. Exactly three exist: `SHADOW_MD`, `SHADOW_LG`,
  `SHADOW_2XL` in `utils/theme.ts` (Tailwind's values, ported). Pick the rung by
  the **size of the shape**, not the lift wanted: the first two are two-layer
  and tuned for menu-sized shapes; across a screen-sized surface they disappear
  (what `SHADOW_LG` did on the Horoscope card) — `SHADOW_2XL` scales blur and
  alpha with the shape. A shadow only reads on light themes; a surface that must
  separate itself on every theme needs an edge, not a lift.
- **Full-screen backdrops** derive from `colors.background` at high opacity — a
  black wash disappears over a dark theme; the app's own background pushes the
  page back a step on either scheme.

`withOpacity` is right for dimming content, wrong for a tinted surface — use a
pre-blended token, or the fill takes on whatever is behind it.

## Documented exceptions to "no literals"

Everything below is a deliberate literal. Adding to this list should be
uncomfortable.

- **`SENTIMENT_COLORS` and `SENTIMENT_FRAME`** (`utils/theme.ts`, DEX-128) —
  the panel's six hexes plus its white frame, the only colors in the app that
  are not theme tokens. See **Sentiment** above.
- **`CalendarView`'s coordinate system** — `GUTTER_WIDTH`, `HOUR_HEIGHT`, etc.
  position labels, lines, and events against each other and misalign the moment
  one moves independently; the system stays fixed in named constants.
- **`CalendarView`'s decorative marks** — the now line and event accent bar are
  strokes, not shapes with corners; `radii` has nothing to say about them.
- **The subtask checklist's 2px row gap** (`subtaskGeometry`) — the rows read
  as one stacked block; anything on the spacing scale separates them into cards.
- **Component dimensions that answer a content question** — the settings
  sidebar's 280pt, the web menu's 220pt minimum, a three-digit field's 56pt.
  "How wide must this be to hold its content" is not on any scale.
- **The nav rail's geometry** — `NAV_RAIL_WIDTH` / `NAV_TILE_SIZE` /
  `NAV_ICON_SIZE` (76 / 48 / 26, `utils/breakpoints.ts`), ported one-for-one
  from the legacy desktop nav; derived from the compact tier the tile read as a
  toolbar button. The rail renders on every tablet (DEX-104), and the 48pt tile
  clears the 44pt iOS tap minimum, which is what makes it touch-legal there.
- **`0`.** A reset is not a spacing step.

## Where the palettes came from

Each theme is a daisyUI theme ported oklch → hex: `background = base-100`,
`surfaceSunken = base-200`, `text = base-content`, priority arrays =
`[warning, error, info, base-100, base-content]` with their `-content` pairs.
`base-300` is not ported. `UNPRIORITIZED` taking `base-content` rather than
`neutral` is the deviation (DEX-114); `border` is the other — daisyUI has no
border token, so each theme supplies one tuned to its own surfaces. `dexter` is
Dexter's own brand theme; the rest are faithful ports of the daisyUI themes of
the same name.

**`src/utils/theme.ts` is canonical.** The marketing site carries its own
daisyUI variables that do not agree with the app's —
`dexterplanner.com/brand` renders the app's values from inline hexes for
exactly that reason (see `docs/website.md`). Reconciling the two is not done.
