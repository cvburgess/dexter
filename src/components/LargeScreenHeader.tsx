import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

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
 * Shared so switching tabs doesn't shift the nav row. The two tabs' header
 * *contents* diverge (Today has pane toggles and an attention indicator; Week
 * has only a drawer toggle), which is why this is a two-slot shell rather than
 * a component that knows what goes in it.
 *
 * `PeriodNav` already carries 12pt of vertical padding, so 4pt here brings the
 * row to 16pt overall — matching the sides and the pane rows' `paddingTop` —
 * instead of stacking a full 16pt on top of it.
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
        { borderBottomColor: withOpacity(theme.colors.text, 0.1) },
      ]}
    >
      {children}
      <View style={[styles.actions, { gap: theme.gap }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
  },
});
