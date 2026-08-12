import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { THoroscope } from "@/api/horoscopes";
import { Button } from "@/components/Button";
import { EmptyScreen } from "@/components/EmptyScreen";
import { Icon } from "@/components/Icon";
import { StarField } from "@/components/StarField";
import { useHoroscope } from "@/hooks/useHoroscope";
import { useHoroscopeAudio } from "@/hooks/useHoroscopeAudio";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { useSunSignPreference } from "@/hooks/usePreferences";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import {
  bySentence,
  lifeAreasInBucket,
  RATING_BUCKETS,
  SUN_SIGNS,
} from "@/utils/horoscope";
import {
  SENTIMENT_FRAME,
  sentimentInk,
  SERIF,
  SHADOW_2XL,
  sentimentTints,
  Theme,
  useTheme,
  withOpacity,
} from "@/utils/theme";

/**
 * One *leg* of the breath — in, or out — not a full cycle.
 *
 * `withRepeat(anim, -1, true)` reverses rather than restarting, so `duration`
 * buys one direction and the round trip is twice this. Naming it per-leg is
 * the point: the first cut called it the full cycle and set 5000, which made
 * the real period ten seconds. Across an amplitude this small that worked out
 * to a couple of RGB units per second — the panel was animating the whole
 * time and simply could not be seen to.
 *
 * **Read this together with the amplitude in `SENTIMENT_COLORS`.** The panel
 * can only show as many colors as there are integers between the two ends, so
 * this duration divided by that count is how long each one is held — the
 * quantity the eye actually judges. Around 150ms it reads as continuous; near a
 * second it reads as a slideshow. Changing either constant alone moves it.
 */
const BREATHE_LEG_MS = 6000;

const SCROLL_HINT_ICON = {
  sf: "chevron.down",
  ionicon: "chevron-down",
} as const;

/**
 * How bright the drawn stars are against the panel.
 *
 * The panel's own ink at a fraction of full: `sentimentInk` at full strength
 * reads as hard white specks rather than as a sky, and taking the ink rather
 * than a literal white means the stars are the same color as the type they sit
 * behind.
 */
const STAR_OPACITY = 0.55;

/**
 * How strongly a band's ring is drawn — the arrow inside it takes the panel's
 * full ink.
 *
 * **Deliberately almost nothing.** Both were at half, which drew three rings as
 * hard as the arrows they contained and made the ring the thing the eye found
 * first. At 5% the edge is a seam rather than a border: enough to keep the
 * disc's near-black fill from bleeding into the panel's near-black on the two
 * bands whose hue is closest to it, and not enough to be read as a shape in its
 * own right. The arrow at full strength is then the only mark, which is the
 * right answer to "what is this row" — the ring is a container, not a symbol.
 *
 * The disc still relies on `SHADOW_2XL` for most of its separation, which is
 * why dropping this far does not lose it entirely.
 */
const RATING_EDGE_OPACITY = 0.05;

/**
 * The hero glyph's size, derived rather than tokenized.
 *
 * `icons.md` (24) is a row's leading glyph and far too small to carry a screen,
 * and `fonts.display` is documented as the login splash's alone. Deriving from
 * `controls.md` — the app's round tap target — keeps the mark scaling with the
 * density tier without adding a token that only one component would ever read.
 * The same move `subtaskGeometry` makes for the checklist's in-between sizes.
 */
const heroGlyphSize = (theme: Theme) => theme.controls.md * 2;

/**
 * The gutter the step's own text keeps, inside the one `SwipeablePage` gives it.
 *
 * Double the usual `space.lg`. It began as clearance for the edge fade that
 * used to soften these borders, and it earns its keep now that the edge is a
 * drawn frame: text has to sit off a border rather than against it, and a line
 * of `heading` set edge to edge on a phone is too long to scan anyway.
 *
 * **Six times on a large screen** (DEX-138). Doubling it there corrected an
 * inversion: `space.lg` is a density token, and `compact` — which applies on
 * web at exactly the widths where the panel is now a centered card — shrinks it
 * from 24 to 18, so the doubled gutter put *36* between the text and the card
 * edge on a desktop window against the phone's 48. The least air on the screen
 * with the most room to give, and the more obvious for the panel having stopped
 * running to the window's edges.
 *
 * Six lands 108 on desktop web and 144 on a tablet, where the tier stays
 * `comfortable`. Deliberately far past the point where it merely clears the
 * border: against a 768dp cap it narrows the hero's measure to roughly 530 and
 * 450dp, which is the width the centered `heading` actually wants — this is the
 * card's margin, not its padding.
 *
 * Not a token — see `heroGlyphSize` above for why deriving beats adding one.
 */
const contentGutter = (theme: Theme, largeScreen: boolean) =>
  theme.space.lg * (largeScreen ? 6 : 2);

/**
 * The hero summary's leading.
 *
 * `heading` is sized to name a screen in one short line, and its default line
 * box is tuned for exactly that — set as a centered block of two or three
 * sentences it packs them together, and `bySentence` puts each on its own line,
 * so the tight leading closes the gap *between sentences* as well as between
 * wrapped lines. 1.4 opens both: enough air for the eye to find the next line
 * in centered text, which has no left edge to return to.
 *
 * Rounded because a fractional line height lands text on half-pixels, and
 * derived from the token rather than fixed so it follows the density tier —
 * see `heroGlyphSize` above for why deriving beats adding a token here.
 */
const summaryLineHeight = (theme: Theme) =>
  Math.round(theme.fonts.heading.fontSize * 1.4);

/**
 * The breath between the day's tips and the rated columns.
 *
 * **Measured from the viewport, not the spacing scale**, so it holds its
 * proportion on every device rather than matching on one and drifting on the
 * rest. A quarter of a screenful: half the hero's own air, which was the first
 * cut and read as a dead zone rather than a breath — the columns had gone far
 * enough below the fold that nothing suggested they were there.
 *
 * This is the step's rhythm rather than a one-off: a screenful for the tip, the
 * remaining tips, a breath of the same measure, then the columns. It is the same
 * argument `heroGlyphSize` and `contentGutter` make — derive from something the
 * component already knows rather than adding a token only this file would read —
 * except that the thing known here is the measurement, not a density tier.
 *
 * The floor matters for one frame only: `viewportHeight` is 0 until the
 * scroller reports its layout, and without it the columns would start out
 * tucked under the tips before snapping down.
 */
const tipsToColumnsGap = (theme: Theme, viewportHeight: number) =>
  Math.max(theme.space.lg * 2, Math.round(viewportHeight / 4));

/**
 * The nearest thing to `text-wrap: balance` that React Native has.
 *
 * Applied to the tips, which are short centred lines — exactly the case where a
 * last line holding one orphaned word is most obvious, and the case CSS's
 * `balance` exists for.
 *
 * **It does not do the same thing on both platforms, and cannot.** There is no
 * cross-platform API for this and no library either — see
 * react-native-community/discussions-and-proposals#890, where the ask is open
 * and the author's own answer is "I have to balance by hand".
 * `textBreakStrategy` genuinely balances on Android. `lineBreakStrategyIOS` has
 * no balance option at all — `none | standard | hangul-word | push-out` — so
 * `standard` is a nudge rather than the Android result.
 *
 * **Web gets nothing here.** CSS `text-wrap: balance` is exactly what this
 * wants, but it is not a React Native style key and whether RNW forwards an
 * unknown one is unverified, so it is left for a `.web` variant rather than
 * claimed on a guess.
 *
 * Kept as one object rather than spelled out at each call site so the tips stay
 * in step, and so there is one place to delete from if React Native ever ships
 * a real API.
 */
const BALANCED_WRAP = {
  textBreakStrategy: "balanced",
  lineBreakStrategyIOS: "standard",
} as const;

/**
 * The leading for the step's two runs of body prose — the tips and each band's
 * areas.
 *
 * `body`'s default line box is tuned for a row's label, where lines are short
 * and rarely wrap. Both of these are the opposite: the tips are centred, which
 * leaves no left edge to return to, and a band's areas are a comma-joined
 * string long enough to wrap two or three times. 1.5 gives the eye somewhere to
 * land in both.
 *
 * Deliberately looser than `summaryLineHeight`'s 1.4 despite being the smaller
 * type: that one sets `heading`, where the size itself already separates the
 * lines. Rounded and derived for the same reasons given there.
 */
const proseLineHeight = (theme: Theme) =>
  Math.round(theme.fonts.body.fontSize * 1.5);

/**
 * How far the reader has to scroll before the chevron is fully gone.
 *
 * Four tap targets' worth of travel — roughly a quarter of a phone's hero. Long
 * enough that the chevron dims *with* the scroll rather than blinking out on
 * the first flick, which is what a shorter distance gave: a fade that resolves
 * inside one gesture is indistinguishable from a toggle.
 */
const scrollHintFade = (theme: Theme) => theme.controls.md * 4;

/**
 * Where a block sits on screen when its fade starts and finishes, as fractions
 * of the viewport measured from the top.
 *
 * **This is the whole point of measuring.** Two earlier cuts keyed the fade to
 * an absolute scroll offset — first one shared window, then a per-block stagger
 * — and both had the same flaw: scroll offset is not visibility. The detail
 * starts at the fold, so "scroll 0" is already the moment the first tip begins
 * sliding into view, and no amount of delay applied to a number that starts at
 * the wrong place fixes that. Read against the block's own top, 0.95 means "just
 * clear of the bottom edge" and 0.55 means "a little above the middle" on every
 * block, whatever it is and however far apart they are spaced.
 *
 * The gap between them is the fade's length — 40% of a screenful, roughly 280pt
 * on a phone, and deliberately long: this replaces two versions that were read
 * as too quick, and a fade tied to a scroll position can afford to be slow
 * because the reader controls the rate.
 *
 * `ENTER` is under 1 on purpose. At exactly 1 a block would start fading the
 * instant its top crossed the bottom edge of the screen, which is the behavior
 * being fixed; the margin holds it blank until it is properly on screen.
 */
const REVEAL_ENTER = 0.95;
const REVEAL_EXIT = 0.55;

/**
 * How far the painted panel hangs below its own box.
 *
 * **Native only.** The phone's `NativeTabs` bar is translucent and floats over
 * the screen, so the color has to carry on underneath it to tint it rather than
 * stopping at the scroller's last pixel. Two tap targets clears the bar and its
 * `BottomAccessory` together; overshooting costs nothing, since anything past
 * the screen edge is simply not drawn.
 *
 * Web gets none: its dock is a laid-out element rather than something floating
 * over the page, so the panel already meets the bottom edge and a bleed would
 * only paint behind a solid surface.
 */
const panelBleed = (theme: Theme) =>
  Platform.OS === "web" ? 0 : theme.controls.md * 2;

/**
 * The card's frame — a tarot card's border, not the app's hairline.
 *
 * `radii.md` is deliberately a brand constant rather than a density one, so
 * doubling it keeps the corner on the app's own scale while reading as the
 * pronounced curve a card has. The width comes off `space.md` — the app's
 * standard screen inset — for the same reason `heroGlyphSize` comes off
 * `controls.md`: it tracks the density tier without earning a token only this
 * component would ever read. The radius is four times `radii.md` rather than
 * one, and the two are tied: a heavy border on a tight corner bunches up on the
 * curve instead of turning it, so raising `panelBorder` means raising this too.
 *
 * The color is `SENTIMENT_FRAME` — see there for why a card's border is white
 * on every theme rather than `colors.border`.
 */
const panelRadius = (theme: Theme) => theme.radii.md * 4;
const panelBorder = (theme: Theme) => theme.space.md;

/**
 * The arrival: sign, then the reading, then the chevron and the detail below
 * together.
 *
 * A reading should not simply be *there* when the screen is. Fading it in in
 * the order it is meant to be read makes the panel feel like it is producing
 * the day rather than displaying a record of it, which is the whole conceit of
 * the step.
 *
 * Expressed as windows onto one shared value rather than three animations:
 * `REVEAL_STARTS[n]` is where stage `n` begins and `REVEAL_FADE` is how long
 * each takes, both as fractions of `REVEAL_MS`. They deliberately overlap — a
 * stage begins before its predecessor has finished, so the sequence reads as
 * one gathering movement instead of three separate events. Keep
 * `last start + REVEAL_FADE` at 1, or the tail of the sequence is dead time.
 *
 * At the values below that is a **1440ms fade per stage, starting 1080ms
 * apart**. Both are worth reading off rather than eyeballing from `REVEAL_MS`:
 * because the windows overlap, no stage lasts anything like the whole sequence,
 * and the fraction that decides how slow each element *feels* is `REVEAL_FADE`,
 * not the total.
 */
const REVEAL_MS = 3600;
const REVEAL_FADE = 0.4;
const REVEAL_STARTS = [0, 0.3, 0.6] as const;

type THoroscopeStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning ritual's first step (DEX-128, re-shaped in DEX-145): the user's
 * sign, the day's reading, and — a scroll further down — the day's tips and its
 * twelve life areas sorted into three rated columns.
 *
 * The panel breathes between two shades of the day's sentiment (see
 * `sentimentTints`), and is **a night sky on every theme** — so everything
 * drawn on it takes `sentimentInk` rather than `colors.text`, which on a light
 * theme would be invisible. It sits inside the step's gutter rather than being
 * a full-bleed background because `SwipeablePage` owns that gutter at every
 * width on this tab, and escaping it would take negative margins (see
 * docs/design.md, "Who owns spacing"). Its bottom is the exception: the painted
 * layers hang below the box so the color runs off the end of the screen.
 */
export function HoroscopeStep({ date }: THoroscopeStepProps) {
  const theme = useTheme();
  // Only for `contentGutter` — the panel is capped at a fixed width above this
  // breakpoint (`SwipeablePage`), so the gutter is the one thing left that
  // decides how the card breathes. Nothing else here reads the window.
  const largeScreen = useIsLargeDevice();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The narrowed hook, not `usePreferences`, because `null` means something
  // here: it renders the prompt below. `usePreferences` would hand back the
  // placeholder row's `null` first, flashing that prompt at a user who already
  // has a sign on every cold open.
  const { sunSign, isLoading: isLoadingSign } = useSunSignPreference();
  const [horoscope, { isLoading: isLoadingHoroscope }] = useHoroscope(
    sunSign,
    date.toString(),
  );
  const isLoading = isLoadingSign || isLoadingHoroscope;

  // The scroller's own height, so the hero fills exactly one screenful and the
  // detail starts just below the fold — which is what makes the scroll a
  // reveal rather than a list that happens to be long.
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setViewportHeight(event.nativeEvent.layout.height);

  // The other half of the scroll range, so the reveal below can be spread across
  // exactly the travel this day's reading has. The cheapest possible read of the
  // layout — one number for the whole scroller, rather than a measurement per
  // block — and safe to take while the blocks are fading because opacity does
  // not change what anything measures.
  const [contentHeight, setContentHeight] = useState(0);

  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      // Assigned rather than merely skipped: a plain write cancels whatever
      // animation is on the value, which is what stops the loop when the
      // setting is turned on *while* the step is on screen. Returning early
      // would leave the panel breathing until it unmounted. 0 resolves to
      // `base` below, so the panel holds the calmer of the two tints.
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(
      // **Linear, deliberately** — the one easing choice that looks wrong on
      // paper and right on screen. An ease-in-out spends most of a leg parked
      // near the two ends and crosses the middle at roughly twice the average
      // rate. For something that *moves*, that is the whole point; for a color,
      // it means the panel holds one shade for the better part of a second,
      // rips through several, and parks again — which is read as choppiness,
      // and which raising the amplitude only makes more obvious rather than
      // less. A color has no momentum to sell, so there is nothing for the
      // curve to buy, and even spacing is what reads as smooth.
      withTiming(1, { duration: BREATHE_LEG_MS, easing: Easing.linear }),
      -1,
      true,
    );
  }, [breathe, reduceMotion]);

  // One driver for the whole arrival, not one animation per element: the
  // stagger is then a set of overlapping windows onto a single 0→1, which
  // cannot drift out of order however the timings are retuned.
  const reveal = useSharedValue(0);
  // Keyed on the day rather than on the object, so walking `DayNav` to another
  // date reveals that day's reading, while a refetch of the same one does not
  // replay it under the reader.
  const revealDate = horoscope?.date ?? null;

  useEffect(() => {
    if (!revealDate) {
      reveal.value = 0;
      return;
    }
    if (reduceMotion) {
      reveal.value = 1;
      return;
    }
    // The plain write cancels any run still in flight — a fast walk through
    // several days would otherwise leave the previous day's reveal finishing
    // on top of this one.
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: REVEAL_MS,
      easing: Easing.linear,
    });
  }, [reduceMotion, reveal, revealDate]);

  // Read straight off the scroller rather than through an `onScroll` handler,
  // so neither of the scroll-driven fades below ever touches the JS thread —
  // the same reason the breath animates a compositor property.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  // With no sentiment to show (no sign, still loading, or a day with no row)
  // both ends collapse onto the plain surface, so the panel sits still.
  // Branching the hook itself would break the rules of hooks.
  const { base, peak } = useMemo(() => {
    if (!horoscope) {
      return {
        base: theme.colors.surfaceSunken,
        peak: theme.colors.surfaceSunken,
      };
    }
    return sentimentTints(horoscope.sentiment);
  }, [horoscope, theme.colors.surfaceSunken]);

  const tintStyle = useAnimatedStyle(() => ({ opacity: breathe.value }));

  // Not `theme.colors.text`: the panel is a night sky whatever scheme the user
  // is on, so a light theme's dark ink would be invisible on it.
  const ink = sentimentInk(theme);

  // The first tip is the hero's, so these are the rest.
  const remainingTips = horoscope?.tips.slice(1) ?? [];

  // How far this day's reading can actually be scrolled — the one thing a block
  // cannot work out from its own position, and what stops the last band being
  // asked to finish its fade past the end of the scroll (see `RevealOnScroll`).
  const maxScroll = Math.max(0, contentHeight - viewportHeight);

  // Starts with the reveal and stops with the step. Gated on the horoscope
  // rather than on mounting, so an empty day or a still-loading read is silent
  // — the track belongs to the reading, not to the screen.
  useHoroscopeAudio(!!horoscope);

  return (
    <View style={styles.panel} testID="horoscope-panel">
      {/* **Every painted layer lives in here; the content is its sibling.** The
          group hangs `panelBleed` below the panel's own box, so the color
          carries on past the end of the scroller and under the translucent tab
          bar — which is what tints it — while the content box stays where it
          was. Extending the panel itself would drag the scroller's measured
          height with it, and the hero's centering with that.

          Framed and rounded at the top only: the bottom is meant to read as
          cut off rather than finished, so the card runs off the end of the
          screen instead of closing.

          The lift is `SHADOW_2XL` — a shared rung of the same Tailwind scale,
          added rather than hand-rolled here. Four surfaces already draw these
          and three had drifted into separate one-off shadows, which is what
          moving them into `theme.ts` fixed; a fifth is not the place to start
          that over. `SHADOW_LG` was the first try and vanished: it is tuned for
          a menu or a tile, and across a screen-sized card 15px of blur at 10%
          black is a rumour. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: base,
            borderColor: SENTIMENT_FRAME,
            boxShadow: SHADOW_2XL,
            borderLeftWidth: panelBorder(theme),
            borderRightWidth: panelBorder(theme),
            borderTopLeftRadius: panelRadius(theme),
            borderTopRightRadius: panelRadius(theme),
            borderTopWidth: panelBorder(theme),
            bottom: -panelBleed(theme),
          },
        ]}
      >
        {/* **The breath is `peak` fading in over `base`, not one color
            interpolating into the other.** The two are the same picture — an
            alpha blend of two colors *is* their linear interpolation — but not
            the same work. `backgroundColor` is a paint property: every frame
            re-fills a screen-sized layer, and reanimated hands it across as a
            fresh `rgba(...)` string to parse. `opacity` is a compositor
            property: the layer is painted once and the GPU varies how much of
            it lands. That is the difference between a slideshow and a smooth
            fade here.

            It is also a leaf view. Repainting a leaf is contained; repainting a
            view that parents five SVG canvases can pull that subtree into the
            frame's work. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: peak,
              // The frame's *inner* curve, which is its radius less its own
              // width. The parent does not clip — `overflow: hidden` on a
              // rounded view makes it offscreen-rendered, re-composited every
              // frame this opacity changes — so a square child would push its
              // corners out through the rounded ones the moment the breath
              // came up.
              borderTopLeftRadius: panelRadius(theme) - panelBorder(theme),
              borderTopRightRadius: panelRadius(theme) - panelBorder(theme),
            },
            tintStyle,
          ]}
        />
        {/* Drawn into the panel itself rather than wrapping the content, so the
            field holds still while the detail scrolls over it. */}
        {horoscope ? (
          <View style={StyleSheet.absoluteFill} testID="horoscope-sky">
            <StarField color={withOpacity(ink.text, STAR_OPACITY)} />
          </View>
        ) : null}
      </View>
      {/* Loading is checked *first*, and the order is load-bearing: an unread
          sign is `null`, which is indistinguishable from a user who has never
          picked one — so testing `sunSign` ahead of this would render the
          prompt, and its button, for a beat on every cold open.

          It renders nothing rather than a spinner: the panel is already on
          screen and this is one small read, so a spinner would flash for a
          frame and read as the step failing to load. */}
      {isLoading ? null : !sunSign ? (
        <EmptyScreen message="Pick your sun sign to read the day's horoscope.">
          <Button
            onPress={() => router.push("/settings/ritual")}
            variant="primary"
          >
            Choose your sign
          </Button>
        </EmptyScreen>
      ) : !horoscope ? (
        <EmptyScreen
          message={`No horoscope for ${formatMonthDayYear(date)} yet.`}
        />
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{
            paddingHorizontal: contentGutter(theme, largeScreen),
            // The host `SafeAreaView` omits the bottom edge so content scrolls
            // under the tab bar; the inset belongs to the scroll content, which
            // is what lets the last row clear it (DEX-91). Well past that here:
            // the columns are the end of the reading, and landing them hard
            // against the tab bar reads as the block being cut off rather than
            // as having finished.
            //
            // **Overscroll, not clearance, on a large screen** (DEX-138). The
            // hero above is a full viewport whose content is centered in it, so
            // its lower half is empty sky — and with only enough padding to
            // clear the bar, the scroll runs out while that band is still on
            // screen and the reading ends pinned to the bottom edge under it.
            // The extra travel lets the last rows climb into that space
            // instead. Matches the side gutter's multiple, so the card's air
            // reads as one measure on three sides.
            //
            // It sits on the scroller rather than on a wrapper around the
            // detail because there is no longer a wrapper — see the blocks
            // below for why they are flat.
            paddingBottom:
              theme.space.lg * (largeScreen ? 6 : 2) + insets.bottom,
          }}
          onContentSizeChange={(_width, height) => setContentHeight(height)}
          onLayout={onLayout}
          ref={scrollRef}
          // The chevron already says there is more below, and it fades out as
          // the reader takes it up. A bar drawing itself over the panel every
          // time they move says the same thing louder and in the app's ink.
          showsVerticalScrollIndicator={false}
          testID="horoscope-scroll"
        >
          <Hero
            bottomInset={insets.bottom}
            horoscope={horoscope}
            reveal={reveal}
            scrollOffset={scrollOffset}
            viewportHeight={viewportHeight}
          />
          {/* **Every block below is a direct child of the scroller, and that is
              load-bearing rather than tidy.** Each one reveals off its own
              position (see `RevealOnScroll`), which it reads with `onLayout` —
              and `onLayout` reports a `y` relative to the immediate parent. Flat
              against the content container, that `y` *is* the scroll offset the
              block sits at, with nothing to convert. Grouped inside wrappers, as
              the tips and the columns used to be, every block would report a `y`
              measured from its own group and reveal at a plausible-but-wrong
              place — which looks like a tuning problem and is not one.

              The price is that the spacing between them is `marginTop` per block
              instead of `gap` on two wrappers. That is the whole cost, and it
              buys the wrappers' removal as well. */}
          {/* Keyed by position, not by the string: the list is fixed for a
              given day and never reorders, and two tips coming back identical
              is a thing a generator does — which on a string key is a React
              collision rather than two lines. */}
          {remainingTips.map((tip, index) => (
            <RevealOnScroll
              key={`tip-${index}`}
              maxScroll={maxScroll}
              reveal={reveal}
              scrollOffset={scrollOffset}
              // One measure for the whole run, the first one included. It used
              // to be nothing above the first tip — the hero is a full viewport
              // and the tip simply started at the fold — which left it landing
              // directly under the chevron, and the chevron sits only
              // `space.lg` off the hero's own bottom edge. A mark pointing at
              // something needs room between it and the thing it points at,
              // or it reads as a bullet for that line.
              style={{ marginTop: theme.space.lg * 4 }}
              viewportHeight={viewportHeight}
            >
              <Text
                {...BALANCED_WRAP}
                style={[
                  styles.tip,
                  theme.fonts.heading,
                  {
                    color: ink.text,
                    fontFamily: SERIF.displayItalic,
                    fontStyle: "normal",
                    fontWeight: "normal",
                    lineHeight: summaryLineHeight(theme),
                  },
                ]}
              >
                {tip}
              </Text>
            </RevealOnScroll>
          ))}

          {/* Stacked rather than three parallel columns. The columns gave
              every band the same third of the card regardless of how many
              areas fell in it, so a day with one bad area and eleven good
              ones drew two near-empty columns beside a crowded one. Stacked,
              each band takes exactly the height its own list needs. */}
          {RATING_BUCKETS.map((bucket, bucketIndex) => {
            const areas = lifeAreasInBucket(horoscope, bucket.id);

            return (
              <RevealOnScroll
                key={bucket.id}
                maxScroll={maxScroll}
                reveal={reveal}
                scrollOffset={scrollOffset}
                style={[
                  styles.bucketRow,
                  {
                    gap: theme.space.md,
                    // The boundary between the two kinds of thing on this
                    // screen — prose to read, then a chart to scan — so the
                    // first band takes the wide measure and the rest take the
                    // ordinary row gap.
                    marginTop:
                      bucketIndex === 0
                        ? tipsToColumnsGap(theme, viewportHeight)
                        : theme.space.lg,
                  },
                ]}
                viewportHeight={viewportHeight}
              >
                <View
                  style={[
                    styles.bucketCircle,
                    {
                      // The card's own sentiment colors, so a band and a day
                      // of the same mood are literally the same hue. The
                      // `peak` end rather than `base`: both are near-black by
                      // design, and against a near-black panel the lighter of
                      // the two is what keeps the disc from disappearing into
                      // its own background.
                      backgroundColor: sentimentTints(bucket.id).peak,
                      // A seam, not a border — see `RATING_EDGE_OPACITY`.
                      // At this lightness the fill alone does not quite
                      // separate from the panel, and this is the least that
                      // fixes it without competing with the arrow.
                      borderColor: withOpacity(ink.text, RATING_EDGE_OPACITY),
                      // The card's own lift, the same rung it draws
                      // (`SHADOW_2XL`). Note what it can and cannot do here:
                      // shadows are black on every theme by design, so on a
                      // near-black panel this reads as depth under the disc
                      // rather than as the separation a lighter surface would
                      // get from it. The edge still describes the shape.
                      boxShadow: SHADOW_2XL,
                      borderRadius: theme.radii.full,
                      height: theme.controls.md,
                      width: theme.controls.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.fonts.title,
                      {
                        // Full ink, the same the tips and the areas take.
                        // The arrow is the row's only mark now that the ring
                        // has stepped back, and a dimmed one read as a
                        // disabled control rather than as a legend.
                        color: ink.text,
                        lineHeight: theme.controls.md,
                      },
                    ]}
                  >
                    {bucket.glyph}
                  </Text>
                </View>
                {/* One string rather than a list of nodes: these are a
                        band's contents, not twelve separate things to look at,
                        and joined they wrap as prose beside the mark instead of
                        forcing a column of one-word lines.

                        An em dash when the band is empty. The row is drawn
                        either way — a day with nothing negative is a good day,
                        and dropping the row would change the legend's shape from
                        one morning to the next — but a mark with nothing beside
                        it reads as a bug rather than as an absence. */}
                <Text
                  style={[
                    styles.bucketAreas,
                    theme.fonts.body,
                    // The panel's full ink, the same the tips take. These
                    // already shared `body`'s weight — `textSecondary` was
                    // the whole difference, and against a near-black card it
                    // dropped them closer to the background than to the prose
                    // they belong with.
                    { color: ink.text, lineHeight: proseLineHeight(theme) },
                  ]}
                >
                  {areas.length > 0
                    ? areas.map((area) => area.label).join(", ")
                    : "—"}
                </Text>
              </RevealOnScroll>
            );
          })}
        </Animated.ScrollView>
      )}
    </View>
  );
}

/**
 * One block below the fold, fading in as it comes into view — **from its own
 * measured position, not from a scroll offset guessed for it**.
 *
 * It reads that position with `onLayout` and keeps it in state, which is why the
 * blocks are flat children of the scroller: see the step's own comment at the
 * call sites for what nesting them would cost. The `y` reported there is the
 * scroll offset the block sits at, so the window below is arithmetic on one
 * number rather than a walk up a tree.
 *
 * A component, rather than an animated style per block back in the step, because
 * these are rendered from `.map()` and a hook cannot be called there — that
 * constraint is what makes this a file-level function and not an inline style.
 *
 * **The window is clamped to the end of the scroll**, and this is the part that
 * is easy to leave out and hard to notice: the last band sits close to the
 * bottom of the content, so its ideal `exit` — its top a little above the middle
 * of the screen — is a scroll position that does not exist. Unclamped it would
 * hold at partial opacity forever with no way for the reader to force it. The
 * clamp slides the whole window earlier rather than shortening it, so a block
 * pushed against the end still fades over the same distance.
 *
 * The reveal factor is multiplied in, so the arrival still gates every block — a
 * reader who scrolls during those first seconds gets the dimmer of the two,
 * exactly as the chevron does. Both factors are 0–1, so the product is whichever
 * is dimmer.
 *
 * Zero opacity before the block is measured, and zero while it is below the
 * fold. Both are safe only because opacity does not touch layout: the content
 * keeps its full height, so there is always something to scroll and no block can
 * be stranded out of reach. The measurement gate leans on `onLayout` firing,
 * which this step already stakes the hero's entire sizing on.
 */
function RevealOnScroll({
  children,
  maxScroll,
  reveal,
  scrollOffset,
  style,
  viewportHeight,
}: {
  children: React.ReactNode;
  maxScroll: number;
  reveal: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  viewportHeight: number;
}) {
  const [top, setTop] = useState<number | null>(null);

  // The block's own offset within the scroll content — see the note above on why
  // this is `y` and nothing more.
  const onLayout = (event: LayoutChangeEvent) =>
    setTop(event.nativeEvent.layout.y);

  // Both resolved out here rather than in the worklet, which runs on the UI
  // runtime and can only capture plain values.
  const measured = top !== null && viewportHeight > 0;
  const exit = measured
    ? Math.min(top - viewportHeight * REVEAL_EXIT, maxScroll)
    : 0;
  const enter = exit - viewportHeight * (REVEAL_ENTER - REVEAL_EXIT);

  const revealStyle = useAnimatedStyle(() => {
    if (!measured) return { opacity: 0 };

    return {
      opacity:
        interpolate(
          reveal.value,
          [REVEAL_STARTS[2], REVEAL_STARTS[2] + REVEAL_FADE],
          [0, 1],
          Extrapolation.CLAMP,
        ) *
        interpolate(
          scrollOffset.value,
          [enter, exit],
          [0, 1],
          Extrapolation.CLAMP,
        ),
    };
  });

  return (
    <Animated.View onLayout={onLayout} style={[style, revealStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * The screenful above the fold: the sign's glyph over the day's first tip, with
 * a chevron at the very bottom marking that there is more below.
 *
 * **The upstream's `text` is deliberately not shown anywhere.** It is still
 * fetched and stored — it is the horoscope proper, and dropping the column would
 * throw away the only prose the reading has — but as a hero it was three
 * sentences of astrological mechanism ("Mars strains against the Sun's natal
 * position") where the tips are the part written *to* the reader. The first tip
 * is one line, it is advice, and it is what someone opening a planner at 7am
 * came for.
 *
 * **The sign's name is deliberately not here.** The glyph already says which
 * sign this is, to anyone who would care, and the name is a label on a thing
 * the reader picked themselves — it pushed the summary down the screen to
 * restate what the settings row already told them.
 *
 * With the name gone the **tip takes `heading`**: it is what this screen is
 * about, which is exactly the question that role answers, and one line of prose
 * is not a caption to a glyph. The whole role is spread rather than its
 * `fontSize` lifted off it (see docs/design.md, "Type scale").
 *
 * **The bottom inset comes out of the hero's height**, and both symptoms it
 * fixes are the same bug: the host `SafeAreaView` omits the bottom edge so
 * content scrolls under the translucent tab bar, which means the scroller's
 * measured height runs *behind* that bar. Centering in the full box put the
 * content visibly low, and the chevron pinned to the bottom of it landed
 * underneath the nav entirely. `EmptyScreen` reserves the same inset for the
 * same reason.
 *
 * `minHeight` rather than `height` because the first render has no measurement
 * yet — at 0 the hero is merely its natural size for one frame instead of
 * collapsing the tip out of view.
 */
function Hero({
  bottomInset,
  horoscope,
  reveal,
  scrollOffset,
  viewportHeight,
}: {
  bottomInset: number;
  horoscope: THoroscope;
  reveal: SharedValue<number>;
  scrollOffset: SharedValue<number>;
  viewportHeight: number;
}) {
  const theme = useTheme();

  const ink = sentimentInk(theme);

  // Resolved out here, not inside the worklet. A `useAnimatedStyle` body runs
  // on the UI runtime, where a function from this module is not a function but
  // a reference back across the bridge — calling one throws "Tried to
  // synchronously call a Remote Function". Only the resulting number is
  // captured.
  const fadeDistance = scrollHintFade(theme);

  const glyphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reveal.value,
      [REVEAL_STARTS[0], REVEAL_STARTS[0] + REVEAL_FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const summaryStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reveal.value,
      [REVEAL_STARTS[1], REVEAL_STARTS[1] + REVEAL_FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Two fades multiplied rather than one winning: the chevron arrives with the
  // detail and then leaves as the reader scrolls, and a reader who scrolls
  // during the arrival should see it do both at once rather than pop to full
  // strength. Both factors are 0–1, so the product is whichever is dimmer.
  const hintStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(
        reveal.value,
        [REVEAL_STARTS[2], REVEAL_STARTS[2] + REVEAL_FADE],
        [0, 1],
        Extrapolation.CLAMP,
      ) *
      interpolate(
        scrollOffset.value,
        [0, fadeDistance],
        [1, 0],
        Extrapolation.CLAMP,
      ),
  }));

  return (
    <View
      style={[
        styles.hero,
        { minHeight: Math.max(0, viewportHeight - bottomInset) },
      ]}
    >
      {/* Dead center of the hero, which `minHeight` has already shortened by
          the bottom inset — so this centers in the screenful the reader can
          actually see, not in a box running behind the tab bar. */}
      <View
        style={[
          styles.heroContent,
          {
            // Double `space.lg`. The glyph is a mark, not a heading, and the
            // summary is not its caption — at the usual section gap the two
            // read as one block, where the point is a symbol resting above a
            // sentence with air between them.
            gap: theme.space.lg * 2,
          },
        ]}
      >
        {/* The opacity rides on the `Text` itself rather than a wrapper: both
            are already laid out by the centering box above, and a wrapper would
            add a node to the tree for a property the text can carry. */}
        <Animated.Text
          style={[
            {
              color: ink.text,
              fontSize: heroGlyphSize(theme),
              // The glyph's own line box, which at this size otherwise reserves
              // the font's full ascent and descent and reads as a gap above it.
              lineHeight: heroGlyphSize(theme),
            },
            glyphStyle,
          ]}
        >
          {SUN_SIGNS[horoscope.sunSign].glyph}
        </Animated.Text>
        <Animated.Text
          {...BALANCED_WRAP}
          style={[
            styles.summary,
            theme.fonts.heading,
            {
              color: ink.text,
              fontFamily: SERIF.displayItalic,
              // Both reset on purpose. `fonts.heading` carries a 700 that the
              // loaded file already has, and the file is already italic — see
              // `SERIF`, where leaving either in place gets a *synthetic* weight
              // or slant stacked on top of a real one.
              fontStyle: "normal",
              fontWeight: "normal",
              lineHeight: summaryLineHeight(theme),
            },
            summaryStyle,
          ]}
        >
          {bySentence(horoscope.tips[0] ?? "")}
        </Animated.Text>
      </View>
      {/* Pinned to the fold rather than trailing the summary: it points at
          what is below the screen, so it belongs at the edge the reader is
          about to cross, not tucked under the text. Absolute, so it cannot
          shift the centered content as the summary's length changes. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.scrollHint, { bottom: theme.space.lg }, hintStyle]}
      >
        <Icon {...SCROLL_HINT_ICON} color={ink.textSecondary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bucketCircle: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  bucketAreas: {
    // Takes the rest of the row so the string wraps against the card's edge
    // rather than against its own content, which is what keeps the left edge of
    // every band's text in the same place.
    flex: 1,
    textAlign: "left",
  },
  bucketRow: {
    // Centred against the mark rather than top-aligned: most bands are one line,
    // where hanging the text from the top of a 40pt disc reads as misaligned.
    // A band long enough to wrap still centres acceptably.
    alignItems: "center",
    flexDirection: "row",
  },
  hero: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    alignItems: "center",
  },
  // No `overflow: hidden`, deliberately. Clipping to the radius makes this an
  // offscreen-rendered layer on iOS, and every frame a child of it changes, the
  // mask is composited again — a per-frame cost paid by a full-screen surface
  // for a 12pt corner that the edge fade dissolves away anyway. Nothing here
  // needs the clip: the starfield is laid out in percentages of these bounds
  // and the ScrollView clips its own content.
  panel: {
    flex: 1,
  },
  // Spans the hero's width so the chevron centers in it, rather than being
  // pinned to one side by a `left`/`right` of its own.
  scrollHint: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  summary: {
    textAlign: "center",
  },
  tip: {
    textAlign: "center",
  },
});
