import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { Button } from "@/components/Button";
import { useHeroReveal, useStageOpacity } from "@/components/HeroLines";
import { todayRoute } from "@/utils/todayRoute";
import { useTheme } from "@/utils/theme";

type TCongratsStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The ritual's closing step: one line of encouragement, and the door out to the
 * day's real task list.
 *
 * **This is where the morning's task-list step went (DEX-144).** Rendering the
 * Today list inside the ritual worked, but it copied a surface it could not
 * replace: the ritual is a sequence you walk once and leave, while the day's
 * list is what you return to all day. A second copy meant deciding, every time,
 * which one you were looking at. Handing the reader over to the real one closes
 * the ritual on the same information without owning it — and the button carries
 * the ritual's date, so someone who walked yesterday's ritual lands on
 * yesterday.
 *
 * No figures, so no `HeroLines`: that component is a measured two-column
 * layout built around a figure, and there is nothing here to align against.
 * This takes the reveal's first stages directly, the way `CalendarStep`'s
 * clear-day block does.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function CongratsStep({ date }: TCongratsStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Nothing to wait for — this step reads no data, so the reveal starts as soon
  // as the step mounts. Keyed on the day like every other step's, so paging the
  // date replays it rather than leaving the line already faded in.
  const reveal = useHeroReveal(date.toString());
  const headingStyle = useStageOpacity(reveal, 0);
  // Stage 1, not `BODY_STAGE`: that constant is "after all three hero lines",
  // and there is only one here — waiting for it would leave the button missing
  // for most of a 3.6s sequence on a step whose whole point is that button.
  const buttonStyle = useStageOpacity(reveal, 1);

  // Cross-tab navigation reuses the mounted Today screen and only swaps its
  // params, so two visits carrying the same date would be identical and the
  // second would switch tabs and do nothing else. Same counter-not-timestamp
  // reasoning as the Search tab's (see `TTodayRouteParams["n"]`) — deterministic
  // in tests.
  const navigationCount = useRef(0);
  const openDay = () => {
    navigationCount.current += 1;
    router.push(
      todayRoute({
        date: date.toString(),
        mode: "tasks",
        n: String(navigationCount.current),
      }),
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          gap: theme.space.lg,
          padding: theme.space.lg,
          // The host SafeAreaView omits the bottom edge (the tab bar owns it),
          // so centering in the full box would sit this visibly low — the same
          // reservation `EmptyScreen` and the calendar step's clear-day block
          // make.
          paddingBottom: theme.space.lg + insets.bottom,
        },
      ]}
      testID="congrats-step"
    >
      <Animated.Text
        style={[
          styles.heading,
          theme.fonts.heading,
          { color: theme.colors.text },
          headingStyle,
        ]}
      >
        You got this
      </Animated.Text>
      {/* Sized to its label rather than stretched: a full-width button under a
          short centered line reads as a form's submit, and this is an invitation
          to leave, not the end of a task. */}
      <Animated.View style={buttonStyle}>
        <Button onPress={openDay} variant="primary">
          Open your day
        </Button>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  heading: { textAlign: "center" },
});
