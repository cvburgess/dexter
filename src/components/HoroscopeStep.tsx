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
import { RevealOnScroll, ScrollHint } from "@/components/ScrollReveal";
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

// Per-leg, not full cycle — withRepeat reverses rather than restarting, so a
// full cycle here doubled the intended period and animated too slowly to see.
const BREATHE_LEG_MS = 6000;

// The panel's own ink at a fraction of full — full strength reads as hard
// white specks; this keeps stars the same color as the type behind them.
const STAR_OPACITY = 0.55;

// Deliberately near-zero: at half it drew rings as hard as their arrows.
// SHADOW_2XL carries most of the disc's separation regardless.
const RATING_EDGE_OPACITY = 0.05;

// Derived from controls.md (not icons.md/fonts.display) so the hero glyph
// scales with density without earning a token only this file reads.
const heroGlyphSize = (theme: Theme) => theme.controls.md * 2;

// Double space.lg on phone; 6x on large screens (DEX-138) — compact density
// shrinks space.lg there, so doubling alone put less air on the roomier layout.
const contentGutter = (theme: Theme, largeScreen: boolean) =>
  theme.space.lg * (largeScreen ? 6 : 2);

// 1.4x heading's size: centered multi-sentence text has no left edge to
// return to, so the default tight leading needs opening.
const summaryLineHeight = (theme: Theme) =>
  Math.round(theme.fonts.heading.fontSize * 1.4);

// Measured from the viewport, not the spacing scale, so it holds proportion
// across devices; floored for the one frame before the scroller measures.
const tipsToColumnsGap = (theme: Theme, viewportHeight: number) =>
  Math.max(theme.space.lg * 2, Math.round(viewportHeight / 4));

// No cross-platform balanced-wrap API exists (RN-community #890 is still
// open) — Android balances for real, iOS gets a nudge, web gets nothing.
const BALANCED_WRAP = {
  textBreakStrategy: "balanced",
  lineBreakStrategyIOS: "standard",
} as const;

// 1.5x body's size — looser than summaryLineHeight's 1.4 despite being
// smaller type, since these lines (centered tips, wrapped area lists) need it.
const proseLineHeight = (theme: Theme) =>
  Math.round(theme.fonts.body.fontSize * 1.5);

// Native only: the translucent NativeTabs bar floats over content, so color
// must carry on underneath it. Web's dock is laid out, so no bleed needed.
const panelBleed = (theme: Theme) =>
  Platform.OS === "web" ? 0 : theme.controls.md * 2;

// A tarot card's border, not the app hairline — radii.md/space.md are tied
// 4:1 so a heavier border doesn't bunch up on too tight a corner.
const panelRadius = (theme: Theme) => theme.radii.md * 4;
const panelBorder = (theme: Theme) => theme.space.md;

// Overlapping windows onto one shared value, not three animations, so the
// stages can't drift out of order. Keep `last start + REVEAL_FADE` at 1.
const REVEAL_MS = 3600;
const REVEAL_FADE = 0.4;
const REVEAL_STARTS = [0, 0.3, 0.6] as const;

type THoroscopeStepProps = {
  /** The ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

// DEX-128/DEX-145: a night sky on every theme, so drawn content takes
// sentimentInk not colors.text. Only its bottom bleeds past SwipeablePage's gutter.
export function HoroscopeStep({ date }: THoroscopeStepProps) {
  const theme = useTheme();
  // Only for contentGutter; the panel itself is capped at a fixed width above
  // this breakpoint (SwipeablePage).
  const largeScreen = useIsLargeDevice();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Narrowed hook, not usePreferences — its placeholder-row null would flash
  // the "pick a sign" prompt at a user who already has one.
  const { sunSign, isLoading: isLoadingSign } = useSunSignPreference();
  const [horoscope, { isLoading: isLoadingHoroscope }] = useHoroscope(
    sunSign,
    date.toString(),
  );
  const isLoading = isLoadingSign || isLoadingHoroscope;

  // The scroller's own height, so the hero fills exactly one screenful and
  // the reveal below starts just past the fold.
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setViewportHeight(event.nativeEvent.layout.height);

  // One number for the whole scroller rather than per-block; safe under
  // fading children since opacity doesn't change layout.
  const [contentHeight, setContentHeight] = useState(0);

  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      // Assigned, not skipped — a plain write cancels the running animation,
      // stopping the loop if motion is disabled mid-step.
      breathe.value = 0;
      return;
    }
    breathe.value = withRepeat(
      // Linear, deliberately: ease-in-out parks near both ends and crosses
      // the middle fast, which reads as choppy color rather than smooth motion.
      withTiming(1, { duration: BREATHE_LEG_MS, easing: Easing.linear }),
      -1,
      true,
    );
  }, [breathe, reduceMotion]);

  // One driver for the whole arrival, not one animation per element, so the
  // stagger can't drift out of order.
  const reveal = useSharedValue(0);
  // Keyed on the day, not the object, so a refetch of the same day doesn't
  // replay the reveal under the reader.
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
    // Cancels any run still in flight — a fast walk through several days
    // would otherwise leave the previous reveal finishing on top of this one.
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: REVEAL_MS,
      easing: Easing.linear,
    });
  }, [reduceMotion, reveal, revealDate]);

  // Read straight off the scroller so the scroll-driven fades below never
  // touch the JS thread.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  // No sentiment (no sign, loading, or an empty day) collapses both ends onto
  // the plain surface; branching the hook itself would break rules of hooks.
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

  const ink = sentimentInk(theme);

  const remainingTips = horoscope?.tips.slice(1) ?? [];

  // What stops the last band's fade being asked to finish past the end of
  // the scroll (see RevealOnScroll).
  const maxScroll = Math.max(0, contentHeight - viewportHeight);

  // Gated on the horoscope, not on mounting, so a still-loading or empty day
  // stays silent.
  useHoroscopeAudio(!!horoscope);

  return (
    <View style={styles.panel} testID="horoscope-panel">
      {/* Every painted layer lives in here, content is its sibling — hangs
          panelBleed below the box so color carries under the translucent tab
          bar without dragging the scroller's measured height with it. */}
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
        {/* peak fading in over base via opacity, not backgroundColor
            interpolation — opacity is a compositor property, backgroundColor
            repaints the screen-sized layer every frame as a slideshow. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: peak,
              // The frame's inner curve (radius minus width) — the parent
              // doesn't clip, so a square child would show corners past the round ones.
              borderTopLeftRadius: panelRadius(theme) - panelBorder(theme),
              borderTopRightRadius: panelRadius(theme) - panelBorder(theme),
            },
            tintStyle,
          ]}
        />
        {/* In the panel itself, not wrapping content, so it holds still while
            detail scrolls over it. */}
        {horoscope ? (
          <View style={StyleSheet.absoluteFill} testID="horoscope-sky">
            <StarField color={withOpacity(ink.text, STAR_OPACITY)} />
          </View>
        ) : null}
      </View>
      {/* Loading checked first — an unread sign is null, indistinguishable
          from never-picked, so testing sunSign first flashes the prompt.
          Renders nothing (not a spinner) since the panel is already on screen. */}
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
            // Past DEX-91's floor: on a large screen (DEX-138) the centered
            // hero leaves empty sky, so extra room keeps rows off the edge.
            paddingBottom:
              theme.space.lg * (largeScreen ? 6 : 2) + insets.bottom,
          }}
          onContentSizeChange={(_width, height) => setContentHeight(height)}
          onLayout={onLayout}
          ref={scrollRef}
          // The chevron already says there's more below and fades as it's read.
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
          {/* Every block is a direct child of the scroller, load-bearing: onLayout's
              y is relative to the immediate parent, so a wrapper group would
              report a plausible-but-wrong reveal position. */}
          {/* Keyed by position — the list is fixed per day, and two identical
              tips from a generator would collide on a string key. */}
          {remainingTips.map((tip, index) => (
            <RevealOnScroll
              key={`tip-${index}`}
              maxScroll={maxScroll}
              reveal={reveal}
              revealFrom={REVEAL_STARTS[2]}
              revealTo={REVEAL_STARTS[2] + REVEAL_FADE}
              scrollOffset={scrollOffset}
              // Without this the first tip lands right under the chevron,
              // which sits only space.lg off the hero's bottom edge.
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

          {/* Stacked, not three parallel columns — columns gave every band an
              equal third regardless of area count, drawing near-empty ones. */}
          {RATING_BUCKETS.map((bucket, bucketIndex) => {
            const areas = lifeAreasInBucket(horoscope, bucket.id);

            return (
              <RevealOnScroll
                key={bucket.id}
                maxScroll={maxScroll}
                reveal={reveal}
                revealFrom={REVEAL_STARTS[2]}
                revealTo={REVEAL_STARTS[2] + REVEAL_FADE}
                scrollOffset={scrollOffset}
                style={[
                  styles.bucketRow,
                  {
                    gap: theme.space.md,
                    // First band gets the wide measure (prose-to-chart
                    // boundary); the rest take the ordinary row gap.
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
                      // peak, not base — both are near-black, but peak keeps
                      // the disc from disappearing into its own background.
                      backgroundColor: sentimentTints(bucket.id).peak,
                      // A seam, not a border — see RATING_EDGE_OPACITY.
                      borderColor: withOpacity(ink.text, RATING_EDGE_OPACITY),
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
                        // Full ink — a dimmed arrow read as a disabled
                        // control rather than a legend.
                        color: ink.text,
                        lineHeight: theme.controls.md,
                      },
                    ]}
                  >
                    {bucket.glyph}
                  </Text>
                </View>
                {/* One joined string, not a node list, so it wraps as prose
                    beside the mark. Em dash when empty — the row still draws
                    so the legend's shape stays constant morning to morning. */}
                <Text
                  style={[
                    styles.bucketAreas,
                    theme.fonts.body,
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

// Screenful above the fold: sign glyph over the first tip. bottomInset comes
// out of the height (matching EmptyScreen) since content scrolls under the tab bar.
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

  return (
    <View
      style={[
        styles.hero,
        { minHeight: Math.max(0, viewportHeight - bottomInset) },
      ]}
    >
      {/* minHeight already shortened by the bottom inset, so this centers in
          the visible screenful, not a box running behind the tab bar. */}
      <View
        style={[
          styles.heroContent,
          {
            // Double space.lg — the glyph is a mark, not a caption to the summary.
            gap: theme.space.lg * 2,
          },
        ]}
      >
        {/* Opacity on the Text itself, not a wrapper node. */}
        <Animated.Text
          style={[
            {
              color: ink.text,
              fontSize: heroGlyphSize(theme),
              // Otherwise reserves the font's full ascent/descent as a gap above.
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
              // Reset — the loaded file is already bold and italic; leaving
              // these would stack a synthetic weight/slant on a real one.
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
      {/* Pinned to the fold, not trailing the summary — absolute so it can't
          shift the centered content as the summary's length changes. */}
      <ScrollHint
        color={ink.textSecondary}
        reveal={reveal}
        revealFrom={REVEAL_STARTS[2]}
        revealTo={REVEAL_STARTS[2] + REVEAL_FADE}
        scrollOffset={scrollOffset}
      />
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
    // Rest-of-row flex keeps every band's left text edge aligned.
    flex: 1,
    textAlign: "left",
  },
  bucketRow: {
    // Centred, not top-aligned — most bands are one line, and hanging from
    // the top of a 40pt disc reads as misaligned.
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
  // No overflow: hidden — clipping to the radius makes this offscreen-rendered
  // and re-composited every frame a child changes, for a corner nothing needs.
  panel: {
    flex: 1,
  },
  summary: {
    textAlign: "center",
  },
  tip: {
    textAlign: "center",
  },
});
