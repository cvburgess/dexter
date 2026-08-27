import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TLargeScreenHeaderProps = {
  /** The leading slot — the tab's PeriodNav, or a wrapper sizing it to a
   * pane below (see LargeScreenToday's task header slot). */
  children: ReactNode;
  /** Right-aligned controls, laid out in a row at the theme gap. */
  actions: ReactNode;
};

/** Bordered header shared by large-screen Today and Week (DEX-97): a
 * two-slot shell keeps both tabs on the same height/baseline. */
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
