import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { THoroscope } from "@/api/horoscopes";
import { Button } from "@/components/Button";
import { EmptyScreen } from "@/components/EmptyScreen";
import { Icon } from "@/components/Icon";
import { useHoroscope } from "@/hooks/useHoroscope";
import { usePreferences } from "@/hooks/usePreferences";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { HOROSCOPE_FACETS, SUN_SIGNS } from "@/utils/horoscope";
import { sentimentTints, Theme, useTheme } from "@/utils/theme";

/**
 * One full in-and-out of the breathing tint. Long on purpose: the panel is
 * meant to feel like it is alive behind the text, not to draw the eye off it.
 */
const BREATHE_DURATION_MS = 5000;

const SCROLL_HINT_ICON = {
  sf: "chevron.down",
  ionicon: "chevron-down",
} as const;

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

type THoroscopeStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The morning ritual's first step (DEX-128): the user's sign, the day's
 * one-line summary, and — a scroll further down — the six facets behind it.
 *
 * The panel breathes between two pre-blended tints of the day's sentiment (see
 * `sentimentTints`). It is a `radii.md` panel inside the step's gutter rather
 * than a full-bleed background because `SwipeablePage` owns that gutter at
 * every width on this tab, and escaping it would take negative margins (see
 * docs/design.md, "Who owns spacing").
 */
export function HoroscopeStep({ date }: THoroscopeStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [{ sunSign }] = usePreferences();
  const [horoscope, { isLoading }] = useHoroscope(sunSign, date.toString());

  // The scroller's own height, so the hero fills exactly one screenful and the
  // facets start just below the fold — which is what makes the scroll a
  // reveal rather than a list that happens to be long.
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setViewportHeight(event.nativeEvent.layout.height);

  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);

  useEffect(() => {
    // Left at 0 under reduced motion, which resolves to `base` below — the
    // panel simply holds the calmer of the two tints.
    if (reduceMotion) return;
    breathe.value = withRepeat(
      withTiming(1, {
        duration: BREATHE_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [breathe, reduceMotion]);

  // No sentiment to show yet (no sign, still loading, or a day with no row)
  // collapses both ends onto the plain surface, so the interpolation is a
  // no-op and the panel sits still. Branching the hook instead would break the
  // rules of hooks.
  const { base, peak } = useMemo(() => {
    if (!horoscope) {
      return {
        base: theme.colors.surfaceSunken,
        peak: theme.colors.surfaceSunken,
      };
    }
    return sentimentTints(theme.colors, horoscope.sentiment);
  }, [horoscope, theme.colors]);

  const tintStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(breathe.value, [0, 1], [base, peak]),
  }));

  return (
    <Animated.View
      style={[styles.panel, { borderRadius: theme.radii.md }, tintStyle]}
      testID="horoscope-panel"
    >
      {!sunSign ? (
        <EmptyScreen message="Pick your sun sign to read the day's horoscope.">
          <Button
            onPress={() => router.push("/settings/ritual")}
            variant="primary"
          >
            Choose your sign
          </Button>
        </EmptyScreen>
      ) : isLoading ? (
        // Nothing, deliberately: the panel is already on screen and the row is
        // a single small read. A spinner here would flash for a frame and read
        // as the step failing to load.
        <View style={styles.panel} />
      ) : !horoscope ? (
        <EmptyScreen
          message={`No horoscope for ${formatMonthDayYear(date)} yet.`}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: theme.space.lg }}
          onLayout={onLayout}
          testID="horoscope-scroll"
        >
          <Hero horoscope={horoscope} viewportHeight={viewportHeight} />
          <View
            style={{
              gap: theme.space.lg,
              // The host `SafeAreaView` omits the bottom edge so content
              // scrolls under the tab bar; the inset belongs to the scroll
              // content, which is what lets the last facet clear it (DEX-91).
              paddingBottom: theme.space.lg + insets.bottom,
            }}
          >
            {HOROSCOPE_FACETS.map((facet) => (
              <View key={facet.key} style={{ gap: theme.space.xs }}>
                <View style={[styles.facetHeader, { gap: theme.space.sm }]}>
                  <Icon {...facet.icon} />
                  <Text
                    style={[theme.fonts.title, { color: theme.colors.text }]}
                  >
                    {facet.label}
                  </Text>
                </View>
                <Text
                  style={[
                    theme.fonts.body,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {horoscope[facet.key]}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

/**
 * The screenful above the fold: the sign's glyph and name over the day's
 * summary, with a chevron marking that there is more below.
 *
 * `minHeight` rather than `height` because the first render has no measurement
 * yet — at 0 the hero is merely its natural size for one frame instead of
 * collapsing the summary out of view.
 */
function Hero({
  horoscope,
  viewportHeight,
}: {
  horoscope: THoroscope;
  viewportHeight: number;
}) {
  const theme = useTheme();
  const sign = SUN_SIGNS[horoscope.sunSign];

  return (
    <View
      style={[styles.hero, { gap: theme.space.md, minHeight: viewportHeight }]}
    >
      <Text style={{ fontSize: heroGlyphSize(theme) }}>{sign.glyph}</Text>
      <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
        {sign.label}
      </Text>
      <Text
        style={[
          styles.summary,
          theme.fonts.body,
          { color: theme.colors.textSecondary },
        ]}
      >
        {horoscope.summary}
      </Text>
      <Icon {...SCROLL_HINT_ICON} color={theme.colors.textSecondary} />
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
  panel: {
    flex: 1,
    overflow: "hidden",
  },
  summary: {
    textAlign: "center",
  },
});
