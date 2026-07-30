import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TLargeScreenHeaderProps = {
  /**
   * The leading slot — the tab's `PeriodNav`, or a wrapper sizing it to a pane
   * below (see `LargeScreenToday`'s task header slot).
   */
  children: ReactNode;
  /** Right-aligned controls, laid out in a row at the theme gap. */
  actions: ReactNode;
};

/**
 * The bordered header row shared by the large-screen Today and Week layouts
 * (DEX-97): period nav at the leading edge, controls at the trailing one, a
 * hairline separating the row from the panes below — matching the legacy
 * desktop app.
 *
 * Shared so the row keeps the same height and the nav sits on the same
 * baseline on both tabs — switching tabs doesn't shift it *vertically*. The
 * two navs' horizontal positions still differ, and deliberately: Today centers
 * `DayNav` inside a slot capped to the Tasks pane's width so it sits over that
 * pane (see `LargeScreenToday`'s `taskHeaderSlot`), while Week's `WeekNav`
 * starts flush at the gutter. The two tabs' header *contents* diverge too
 * (Today has pane toggles and an attention indicator; Week has only a drawer
 * toggle), which is why this is a two-slot shell rather than a component that
 * knows what goes in it.
 *
 * The horizontal gutter is `space.md`, the same token the pane rows below use,
 * so the nav stays lined up over the pane it labels. `PeriodNav` already carries
 * its own vertical padding, so the row adds only `xs` rather than stacking a
 * full gutter on top of it.
 */
export function LargeScreenHeader({
  children,
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
      {children}
      <View style={[styles.actions, { gap: theme.space.sm }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
  },
});
