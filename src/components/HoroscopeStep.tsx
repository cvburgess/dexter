import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
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
import { useSunSignPreference } from "@/hooks/usePreferences";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { bySentence, HOROSCOPE_FACETS, SUN_SIGNS } from "@/utils/horoscope";
import {
  SENTIMENT_FRAME,
  sentimentInk,
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
 * Not a token — see `heroGlyphSize` above for why deriving beats adding one.
 */
const contentGutter = (theme: Theme) => theme.space.lg * 2;

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
 * The arrival: sign, then summary, then the chevron and the six facets
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
 * The morning ritual's first step (DEX-128): the user's sign, the day's
 * one-line summary, and — a scroll further down — the six facets behind it.
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
  // facets start just below the fold — which is what makes the scroll a
  // reveal rather than a list that happens to be long.
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setViewportHeight(event.nativeEvent.layout.height);

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

  const facetsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reveal.value,
      [REVEAL_STARTS[2], REVEAL_STARTS[2] + REVEAL_FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

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

  // Read straight off the scroller rather than through an `onScroll` handler,
  // so the chevron's fade never touches the JS thread — the same reason the
  // breath animates a compositor property.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  // Not `theme.colors.text`: the panel is a night sky whatever scheme the user
  // is on, so a light theme's dark ink would be invisible on it.
  const ink = sentimentInk(theme);

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
            field holds still while the facets scroll over it. */}
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
          contentContainerStyle={{ paddingHorizontal: contentGutter(theme) }}
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
          {/* The six arrive as one block rather than in sequence with each
              other: they are below the fold, so a reader who scrolls straight
              down would otherwise watch them appear under their thumb. */}
          <Animated.View
            style={[
              {
                gap: theme.space.lg,
                // The host `SafeAreaView` omits the bottom edge so content
                // scrolls under the tab bar; the inset belongs to the scroll
                // content, which is what lets the last facet clear it (DEX-91).
                // Well past that here: Luck is the end of the reading, and
                // landing its last line hard against the tab bar reads as the
                // text being cut off rather than as having finished.
                paddingBottom: theme.space.lg * 2 + insets.bottom,
              },
              facetsStyle,
            ]}
          >
            {HOROSCOPE_FACETS.map((facet) => (
              // `sm` rather than `xs` between the heading and its prose. The
              // outer `lg` still separates one facet from the next, so the
              // grouping holds — this is the smallest step that lets the
              // heading read as a label *on* the text rather than the first
              // line of it.
              <View key={facet.key} style={{ gap: theme.space.sm }}>
                <View style={[styles.facetHeader, { gap: theme.space.sm }]}>
                  <Icon {...facet.icon} color={ink.text} />
                  <Text style={[theme.fonts.title, { color: ink.text }]}>
                    {facet.label}
                  </Text>
                </View>
                <Text style={[theme.fonts.body, { color: ink.textSecondary }]}>
                  {horoscope[facet.key]}
                </Text>
              </View>
            ))}
          </Animated.View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

/**
 * The screenful above the fold: the sign's glyph over the day's summary, with a
 * chevron at the very bottom marking that there is more below.
 *
 * **The sign's name is deliberately not here.** The glyph already says which
 * sign this is, to anyone who would care, and the name is a label on a thing
 * the reader picked themselves — it pushed the summary down the screen to
 * restate what the settings row already told them.
 *
 * With the name gone the **summary takes `heading`**: it is what this screen is
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
 * collapsing the summary out of view.
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
  // facets and then leaves as the reader scrolls, and a reader who scrolls
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
          style={[
            styles.summary,
            theme.fonts.heading,
            { color: ink.text },
            summaryStyle,
          ]}
        >
          {bySentence(horoscope.summary)}
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
  facetHeader: {
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
});
