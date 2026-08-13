import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TLargeScreenHeaderProps = {
  /** The centered slot — the tab's `PeriodNav`. */
  children: ReactNode;
  /** A single left-aligned control, or nothing. */
  leading?: ReactNode;
  /** Right-aligned controls, laid out in a row at the theme gap. */
  actions: ReactNode;
};

/**
 * The bordered header row shared by the large-screen Today, Week, and Ritual
 * layouts (DEX-97): the period nav centered, controls at either edge, a
 * hairline separating the row from whatever the tab puts below it.
 *
 * Shared so the nav sits in the same place on every tab — switching tabs moves
 * neither its baseline nor its horizontal position. It centers the way the
 * phone's `DayNavHeader` does (DEX-152), which is what makes the two form
 * factors read as one app rather than two: Today used to wedge `DayNav` into a
 * slot capped to the Tasks pane so it labelled that column, and Week and Ritual
 * started flush at the gutter, so the nav landed somewhere different on each of
 * the three.
 *
 * The centering is flex rather than `DayNavHeader`'s absolute overlay, and the
 * zero flex-basis on the side slots is what buys it: the free space splits
 * evenly between them whatever they hold, so the middle is exactly centered
 * with one control beside it or none. Both slots render even when empty —
 * an empty box is still the spacer that balances the other side.
 *
 * A side slot claims half the space left over by the nav, which at the
 * narrowest large screen (768pt window, so 736 of content, less `DayNav`'s
 * ~248) is ~244pt. Ritual's five-segment `RitualStepSegments` is the widest
 * thing any tab puts here, at ~224 — it clears the nav, but only just, so a
 * sixth ritual step is the point at which this stops fitting.
 *
 * The horizontal gutter is `space.md`, the same token the pane rows below use.
 * `PeriodNav` already carries its own vertical padding, so the row adds only
 * `xs` rather than stacking a full gutter on top of it.
 */
export function LargeScreenHeader({
  children,
  leading,
  actions,
}: TLargeScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: theme.colors.border,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.xs,
        },
      ]}
    >
      <View
        style={[styles.side, styles.leading, { gap: theme.space.sm }]}
        testID="large-screen-header-leading"
      >
        {leading}
      </View>
      {children}
      <View
        style={[styles.side, styles.actions, { gap: theme.space.sm }]}
        testID="large-screen-header-actions"
      >
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  // `flexBasis: 0` (not the default `auto`) is what centers the nav: with a
  // basis of zero, the row's leftover width splits evenly between the two
  // sides, so the middle lands dead center however wide their contents are.
  // Sizing them to their contents instead would offset the nav by half the
  // difference between the two.
  side: {
    alignItems: "center",
    flexBasis: 0,
    flexDirection: "row",
    flexGrow: 1,
  },
  leading: {
    justifyContent: "flex-start",
  },
  actions: {
    justifyContent: "flex-end",
  },
});
