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

Two steps, and the direction is the point: **content is the lightest plane in
the app, and everything that frames content recedes from it.**

| Token | daisyUI | Used for |
| --- | --- | --- |
| `background` | `base-100` | Screen bodies, panes, the sheet behind cards, the nav rail's tiles |
| `surfaceSunken` | `base-200` | Cards, inputs, rows, menus, stack chrome, the nav rail and dock |

This is the inverse of a "cards float above the page" ramp, and it is deliberate
(DEX-61). The legacy web app anchors its content on `base-100` and paints every
input, card, and nav surface with `base-200`; anchoring content a rung lower
made every screen in this app read a step darker than the app it replaces, which
is what the two surfaces are tuned against. In a dark theme the difference is
large — `base-100` is ~30% brighter than `base-200` in relative luminance, where
in a light theme the same pair is white against near-white.

Ask "is this content, or is it holding content?" A pane, a screen body, a stack
header and a nav tile are content and get `background`. A task card, a text
input, a settings row, a menu, and the rail those tiles sit on hold content and
get `surfaceSunken`. Nothing else is a surface — do not invent a third by
alpha-filling one of these.

The nav rail is the one place both tokens meet head-on: the rail is
`surfaceSunken` and its tiles are `background`, so each tile reads as a piece of
the content sheet floating on the chrome — the legacy nav exactly.

Sinking a surface marks the app's *outermost* chrome, not every list that
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

`priority[NEITHER]` is the theme's `base-100` — the same value as `background` —
so blending it would resolve to the pane itself and a `NEITHER` card would have
no edge at all. `priorityMuted[NEITHER]` is therefore **`surfaceSunken`
outright, not a blend** (DEX-114), and `theme.test.ts` pins that. It is not a
fourth surface: a `NEITHER` card holds content, so it takes the same token every
other content-holding surface does.

`priority[UNPRIORITIZED]` is **always the theme's `text`** — the app's ink —
rather than daisyUI's `neutral`, and `priorityContent[UNPRIORITIZED]` is its
`background`. An unprioritized card and the active nav tile are meant to read as
the same mark: a block of ink with the surface showing through the type on it.
The tile is `withOpacity(text, 0.8)` and the card fill blends the same ink at
`CARD_FILL_ALPHA` (0.8), so anchoring the accent on `text` makes them land
together by construction. `neutral` is a *dark* swatch in every daisyUI theme,
which held on the light themes by luck and inverted the pair on the dark ones —
a light nav tile beside a near-black card (DEX-114). `theme.test.ts` pins it
across all five themes.

**Task cards have no outline** (DEX-114). The fill is the whole shape. A
hairline around a block of priority color read as a second edge, and the
unprioritized card it did earn its keep on now separates itself from the pane by
sitting a rung lower.

The one deliberate alpha left on a card is the completed state — a 3% tint of
the raw `priority[i]`. It is meant to read as the *absence* of a card rather
than as a fourth surface color, so it does not get a token.

## Border

`colors.border` is the app's one hairline. It is opaque and tuned per theme
rather than derived as an alpha of `text`: a single alpha that reads correctly
on a light surface is invisible on a dark one.

**A divider is always darker than the surfaces it divides**, on a dark theme as
much as a light one — a line is drawn by taking light away, never by adding it
back. It is the bottom of the same ramp `background` and `surfaceSunken` sit on:
the dark themes take daisyUI's `base-300` (the step below chrome, and what
dexter-app draws its own borders with), the light themes one step beyond theirs,
since a light theme's `base-300` is nearly its `base-200`. `theme.test.ts` pins
the ordering.

Use it for every divider and every hairline outline. The places that correctly
do something else derive their line from what it is drawn *on* rather than from
a surface: `StatusButton`'s circle and `ListButton`'s take the fill's own
content color, where a neutral hairline would wash out against the priority
color behind it, and `CalendarView`'s hour lines take `text` at 25% so they read
as the faintest member of the same family as the hour labels they tie to, rather
than as the app's structural hairline.

`TaskDropTarget`'s drag highlight is the one border that is **not** a hairline: a
2px line in `colors.primary`, the same active-state color the drawer's Filter and
Group controls take. Both halves are deliberate. `primary` because this is a
transient active state rather than structure; 2px because the width is *reserved*
— it is always present and transparent, and only its color changes on hover, so
highlighting a drop target costs no layout. Introducing the width on hover
instead would shrink the content box and reflow every card in the region for as
long as a finger hovers over it. A pane that already draws its own hairline (the
backlog) keeps it and just gets tinted.

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

The `lg`-between / `sm`-within pairing is deliberate: the two had been the same
step, so nothing read as grouped. The inner step is `sm` rather than `xs`
because a section title labels a whole group rather than a single control — at
`xs` it sat close enough to its first row to read as part of it.

**The group step lives in `SettingsSectionTitle`, not in the screens.** It
carries `lg` above itself and `sm` below, and every screen supplies only the
in-group `gap` those margins add to. When the `lg` was a `gap` on the settings
screens instead, a title rendered anywhere else — Search's result list — got no
separation at all and its sections ran together. A component that owns the space
around itself is the exception here, not the rule, and this is the one that
earns it: the heading is not a member of the group it heads, so no uniform
parent `gap` can place it correctly.

## Who owns spacing

**A component never pads itself away from its container's edge. Whoever placed
it does.** (DEX-115)

The same components are laid out differently on a phone, an iPad, the web app
and a Mac window, and each of those wants a different gutter — or none. A
component that hard-codes one can only be placed one way, and every host that
wants something else has to opt out through a prop. That is how the Today view
ended up with the Tasks pane sitting `md + sm` from Notes while Notes sat `sm`
from Calendar: the pane row supplied a gutter and the task list supplied
another.

What a component *does* own:

- **Space between its own parts** — a list's `gap`, a card's internal padding,
  the inner padding of a pane that draws its own border.
- **Anything tied to its own scrolling.** `insets.bottom` added to a
  `contentContainerStyle` is the clearest case: it exists so content scrolls
  *under* the translucent tab bar, which only works from inside the scroller.
  Moving it to a parent shrinks the viewport and the last row can never clear
  the bar. `DayTaskList`, `JournalView` and `CalendarView` all keep their
  vertical padding for this reason.
- **Appearance variants.** `NotesView`'s `card` prop turns the note's border and
  fill on or off — that is chrome, not layout, and a prop is the right shape for
  it. The give-away is that it changes what the component *is*, not where it
  sits.

Where the gutters actually live now: `SwipeablePage` supplies the phone's side
gutter once for whichever page is on screen — a day's Tasks/Notes/Journal/
Calendar on the Today tab, a step's `RitualStepView` on the Ritual tab;
`LargeScreenToday` and `WeekView` supply theirs on the pane row; the Week
columns and the Today panes deliberately supply none, so the row's own `gap` is
the whole space between them.

On the Ritual tab the same job falls to `LargeScreenRitual`, whose body pads its
step the way Today and Week pad their pane rows — `RitualStepView` carries
nothing of its own, so the two layouts can space it differently without it
knowing.

Reach for a `padding`/`inset` prop only after checking whether the caller can
just wrap the thing in a padded view — it almost always can.

## Type scale

Six roles. Each is a `{ fontSize, fontWeight }` pair, so applying a role sets
both — spread it into a style rather than reading `.fontSize` off it.

| Role | Weight | Answers | Used for |
| --- | --- | --- | --- |
| `subtitle` | 400 | what else should I know about this thing | The second line under a `title` — a row's detail, a section's explanation |
| `body` | 400 | — | Running prose, empty states, row labels, calendar event names, what a text input holds |
| `control` | 600 | — | Buttons and the web date/time pickers |
| `title` | 600 | what is this thing | A component's primary line — a row's name, a field's label, a section heading |
| `heading` | 700 | what screen am I on | Screen and detail-pane headings |
| `display` | 900 | — | The login splash only |

`title` and `subtitle` are a **pair**: seven components render one directly
above the other (`ListRow`, `HabitRow`, `SettingsRow`, `TemplateRow`,
`SearchResultCard`, `WeekDayColumn`, `SettingsSectionTitle`). If you are
reaching for `subtitle`, there should be a `title` above it — or, in the one
case that isn't a pair, something else it annotates: `CalendarView`'s hour
labels and event times take `subtitle` because they label the *grid*, and it is
the lightest role there is.

**`subtitle` and `body` are the same size** — 14/400 on `comfortable`, 12/400 on
`compact` — so, with `control` and `title` already sharing 16/600, six roles
resolve to four distinct renderings. This is
deliberate, not a leftover: a row's second line is content the user is meant to
read, and at 12 it read as fine print next to its 16pt title. The two roles stay
separate because they answer different questions (`subtitle` annotates the
`title` above it; `body` stands alone), and because only one of them is pinned
to the other — if `title` ever moves, `subtitle` follows it and `body` does not.
Pick by role, and don't collapse the two just because they currently resolve to
the same numbers.

`heading` is not "a bigger `title`" — it is a different axis. `title` names a
*component*; `heading` names the *screen or pane*, and there is one per view.

**A field's text is `body`; a button's label is `control`.** What a text input
holds is the user's own content — a calendar URL, a journal prompt, a note
template — so it is set like content, at `body`'s 400. `control` stays 600 for
the things you press: `Button`, `NewTaskButton`, `WeekdayPicker`,
`ConfirmationModal.web`, the settings action links, and the web date/time
fields, which read as pickers rather than as places to type.

**Known cost: iOS Safari zooms the page whenever a focused input's font-size is
under 16px.** `components/TextInput.tsx` has no `.web` variant, so it renders on
mobile web where `comfortable` applies, and `body` is 14 there. `control`'s
16-on-`comfortable` floor was what prevented that, and fields no longer sit
behind it. The fix, if the zoom shows up in practice, is a 16px floor on web in
`TextInput` rather than pushing the whole role back up.

**Pick the role, not the nearest size.** The roles carry weight as well as size,
so a 15pt semibold label is a `title` even though 15 is closer to `body`'s size.
Asking "what is this text *for*" gives the right answer; measuring it does not.

## Controls

`controls.md` is the diameter of a round icon button or a tile;
`controls.sm` is an inline control inside a row (the status circle, the list
button, the due-date badge). Sizes that sit *between* the two are derived from
them rather than added to the scale — a subtask's circle is three quarters of
`controls.sm` (see `subtaskGeometry` in `components/SubtaskConnector.tsx`, which
derives the whole checklist layout from one place so the connector rail can't
drift away from the rows it joins).

## Icons

`icons.sm` is an inline affordance (a chevron, a menu glyph); `icons.md` is a
row's or nav item's leading icon. Kept separate from `fonts` because an icon's
optical size doesn't track the type beside it — a 24pt icon reads as the peer of
a 16pt label. `md` is deliberately half again the type it sits next to: at 20 the
glyph read as subordinate to its own row's title rather than as its equal, which
is what set Dexter's rows apart from the sibling app they are tuned against.

**One exception: a disclosure chevron that terminates a row with an `icons.md`
leading glyph takes `icons.md` too**, not `icons.sm`. It isn't an inline
affordance sitting *within* a line of text — it is the counterweight to the
leading glyph at the far end of the same row, and the pair reads as lopsided
when the two differ. `SettingsRow` is the case; `icons.sm` stays correct for a
chevron with no leading glyph opposite it.

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
| comfortable | 4 / 8 / 16 / 24 | 14 / 14 / 16 / 16 / 24 / 40 | 12 / 999 | 40 / 32 | 14 / 24 |
| compact | 3 / 6 / 12 / 18 | 12 / 12 / 14 / 14 / 20 / 32 | 12 / 999 | 32 / 26 | 12 / 22 |

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

Neither is a token. A scrim is derived with `withOpacity` from a theme color and
a shadow is a literal Tailwind value; which one a surface gets depends on the
job:

- **Popovers and context menus get no scrim at all** (DEX-125). An OS context
  menu floats over untouched content; washing the page behind one makes it read
  as a modal dialog, which is what the web `IconMenu` did until this was
  corrected. The full-viewport layer stays — it is what catches the click that
  dismisses the menu — but it is invisible, which is how `DateField.web.tsx`'s
  calendar popover has always worked. Separation comes from the popover's own
  edge instead: a `colors.border` hairline, because a `surfaceSunken` menu sits
  on cards and rows that are also `surfaceSunken` and the fill alone cannot mark
  where it ends, plus the shadow below.
- **Shadows are black**, on every theme, and there are exactly two of them:
  `SHADOW_MD` and `SHADOW_LG` in `utils/theme.ts`, Tailwind's `shadow-md` and
  `shadow-lg` ported literally from dexter-app. A shadow is the absence of light
  — the same rule that makes a divider always darker than the surfaces it
  divides. Deriving one from `text` inverts it on the dark themes, where the ink
  is light, painting a pale halo rather than a lift. Both are two layers, a wide
  soft drop with a negative spread over a tighter layer that keeps the shape's
  own edge defined; a single-layer shadow reads as a smudged hairline instead.

  They are exported constants rather than theme tokens because a shadow has
  nothing to vary with — it is the same on every theme. They live in
  `theme.ts` rather than in a component because four surfaces draw them: the
  nav rail's tiles (`SHADOW_MD`, `SHADOW_LG` on hover), the web menu, the web
  date popover, and the web confirmation card. The last three had each grown
  their own hand-rolled value derived from `text`, two of them carrying
  comments asserting the opposite of this rule (DEX-125).
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
- **The nav rail's geometry** — `NAV_RAIL_WIDTH`, `NAV_TILE_SIZE`, and
  `NAV_ICON_SIZE` in `utils/breakpoints.ts` (76 / 48 / 26). The rail is ported
  one-for-one from the legacy desktop nav and proportioned against that app
  rather than against a control size derived from the density tier: from the
  compact tier the tile came out at 38 with a 19pt glyph, which read as a
  toolbar button rather than a destination. It is no longer web-only — the rail
  renders on every tablet (DEX-104) — and the 48pt tile happens to clear the
  44pt iOS minimum tap target, which is what makes it touch-legal there even
  though compact density is not. The three live together because they only make
  sense together.
- **`0`.** A reset (`padding: 0` to undo an inherited inset) is not a spacing
  step.

## Where the palettes came from

Each theme is a daisyUI theme ported oklch → hex, mapping
`background = base-100`, `surfaceSunken = base-200`, `text = base-content`, and
the priority arrays = `[warning, error, info, base-100, base-content]` with
their `-content` pairs. `base-300` is not ported: the two surfaces above are
where dexter-app anchors content and chrome, and a third step went unused once
the ramp was anchored there.

`UNPRIORITIZED` taking `base-content` rather than daisyUI's `neutral` is the
deviation (DEX-114) — see the priority section above for why.

`border` is the other exception: daisyUI has no border token, and `base-300`
would be *darker* than the surface in a dark theme, so each theme supplies one
tuned to sit against its own surface.

`dexter` is Dexter's own brand theme (green primary on a warm base); the rest are
faithful ports of the daisyUI themes of the same name.

**`src/utils/theme.ts` is canonical.** The marketing site (`/www`) carries its
own daisyUI variables in `src/index.css` and they do not currently agree with the
app's — `dexterplanner.com/brand` renders the app's values directly from inline
hexes for exactly that reason. Reconciling the two is not done.
