import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  ImageSourcePropType,
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
import { useSunSignPreference } from "@/hooks/usePreferences";
import { formatMonthDayYear } from "@/utils/formatPlainDate";
import { HOROSCOPE_FACETS, SUN_SIGNS } from "@/utils/horoscope";
import { sentimentTints, Theme, useTheme } from "@/utils/theme";

/**
 * One *leg* of the breath — in, or out — not a full cycle.
 *
 * `withRepeat(anim, -1, true)` reverses rather than restarting, so `duration`
 * buys one direction and the round trip is twice this. Naming it per-leg is
 * the point: the first cut called it the full cycle and set 5000, which made
 * the real period ten seconds. Across an amplitude this small that worked out
 * to a couple of RGB units per second — the panel was animating the whole
 * time and simply could not be seen to.
 */
const BREATHE_LEG_MS = 2600;

const SCROLL_HINT_ICON = {
  sf: "chevron.down",
  ionicon: "chevron-down",
} as const;

/**
 * The photograph behind the panel.
 *
 * `require` with an explicit type parameter rather than an ES import, and the
 * reason is `tsconfig`'s `paths`: it maps `@/*` onto real files, so
 * `import sky from "@/assets/images/sky.jpg"` resolves to the `.jpg` itself and
 * fails to parse, and a `declare module "*.jpg"` wildcard cannot rescue it —
 * TypeScript only consults those for specifiers it could not resolve at all.
 * Expo's `metro-require.d.ts` types `require` generically, so this form carries
 * a real type instead of the bare `any` an untyped `require` would.
 */
const SKY = require<ImageSourcePropType>("@/assets/images/sky.jpg");

/**
 * How much of the sky survives under the sentiment wash.
 *
 * This is the one place an alpha fill is the *right* tool rather than the
 * wrong one. `docs/design.md` warns that a translucent fill takes on whatever
 * is behind it — here that is the entire point: the wash has to read as the
 * day's color *and* let the photograph through, which a pre-blended opaque
 * token could not do. Don't "fix" this into a solid fill.
 */
const SKY_WASH_OPACITY = 0.5;

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
 * How far above true center the hero's content sits.
 *
 * A screenful holding one glyph and one line reads better high than dead
 * center — centered, it drifts toward the fold and looks like it is falling
 * out of the screen. Derived from `controls.md` rather than written as a
 * literal, so it tracks the density tier: 120 comfortable, 96 compact. Applied
 * as bottom padding on the centering box, so the content rises by half of it
 * and the chevron below is unaffected.
 */
const heroLift = (theme: Theme) => theme.controls.md * 3;

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
      withTiming(1, {
        duration: BREATHE_LEG_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [breathe, reduceMotion]);

  // With no sentiment to show (no sign, still loading, or a day with no row)
  // both ends collapse onto the plain surface. The wash isn't rendered in those
  // states anyway, but the hook has to be called unconditionally, so it needs
  // *some* pair — branching the hook itself would break the rules of hooks.
  const { base, peak } = useMemo(() => {
    if (!horoscope) {
      return {
        base: theme.colors.surfaceSunken,
        peak: theme.colors.surfaceSunken,
      };
    }
    return sentimentTints(theme.mode, horoscope.sentiment);
  }, [horoscope, theme.mode, theme.colors.surfaceSunken]);

  const tintStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(breathe.value, [0, 1], [base, peak]),
  }));

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radii.md,
        },
      ]}
      testID="horoscope-panel"
    >
      {/* The sky and the day's color over it, both only once there is a
          horoscope: an empty or still-loading panel is a plain surface, not a
          photograph with nothing on it. Absolutely positioned rather than
          wrapping the content, so the sky stays put while the facets scroll
          over it, and `panel`'s `overflow: hidden` clips both to the radius. */}
      {horoscope ? (
        <>
          <Image
            source={SKY}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            testID="horoscope-sky"
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.wash, tintStyle]}
          />
        </>
      ) : null}
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
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: theme.space.lg }}
          onLayout={onLayout}
          testID="horoscope-scroll"
        >
          <Hero
            bottomInset={insets.bottom}
            horoscope={horoscope}
            viewportHeight={viewportHeight}
          />
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
  viewportHeight,
}: {
  bottomInset: number;
  horoscope: THoroscope;
  viewportHeight: number;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.hero,
        { minHeight: Math.max(0, viewportHeight - bottomInset) },
      ]}
    >
      {/* The lift rides on the inner box, not on `hero`: padding on the
          centering container would also move what `scrollHint` measures its
          `bottom` against. Padding a centered child raises its content by half
          the padding and leaves the chevron where it is. */}
      <View
        style={[
          styles.heroContent,
          { gap: theme.space.lg, paddingBottom: heroLift(theme) },
        ]}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: heroGlyphSize(theme),
            // The glyph's own line box, which at this size otherwise reserves
            // the font's full ascent and descent and reads as a gap above it.
            lineHeight: heroGlyphSize(theme),
          }}
        >
          {SUN_SIGNS[horoscope.sunSign].glyph}
        </Text>
        <Text
          style={[
            styles.summary,
            theme.fonts.heading,
            { color: theme.colors.text },
          ]}
        >
          {horoscope.summary}
        </Text>
      </View>
      {/* Pinned to the fold rather than trailing the summary: it points at
          what is below the screen, so it belongs at the edge the reader is
          about to cross, not tucked under the text. Absolute, so it cannot
          shift the centered content as the summary's length changes. */}
      <View style={[styles.scrollHint, { bottom: theme.space.lg }]}>
        <Icon {...SCROLL_HINT_ICON} color={theme.colors.textSecondary} />
      </View>
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
  panel: {
    flex: 1,
    overflow: "hidden",
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
  wash: {
    opacity: SKY_WASH_OPACITY,
  },
});
