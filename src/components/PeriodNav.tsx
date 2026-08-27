import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TPeriodNavProps = {
  onPrev: () => void;
  onNext: () => void;
  /** Accessibility label for the ‹ chevron, e.g. "Previous day". */
  prevLabel: string;
  /** Accessibility label for the › chevron, e.g. "Next week". */
  nextLabel: string;
  /** Center slot content — a PeriodNavLabel, or any other control; the slot
   * sizes it, so the caller never restates the width. */
  children: ReactNode;
};

// Shared by DayNav and WeekNav so their header rows share one baseline
// (DEX-97) — the slot's width is fixed, not intrinsic, so the chevrons stay
// put as the label's text length changes.
export function PeriodNav({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  children,
}: TPeriodNavProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { paddingVertical: theme.space.sm },
        { paddingVertical: theme.space.sm },
      ]}
    >
      <TouchableOpacity
        accessibilityLabel={prevLabel}
        onPress={onPrev}
        style={{
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
        }}
      >
        <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
          ‹
        </Text>
      </TouchableOpacity>
      <View style={styles.center} testID="period-nav-center">
        {children}
      </View>
      <TouchableOpacity
        accessibilityLabel={nextLabel}
        onPress={onNext}
        style={{
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
        }}
      >
        <Text style={[theme.fonts.heading, { color: theme.colors.text }]}>
          ›
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** The center slot's text, at the shared metrics. */
export function PeriodNavLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <Text
      style={[theme.fonts.title, styles.label, { color: theme.colors.text }]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // Default alignItems: "stretch" is load-bearing — hands the full slot width
  // to the label, so its hit area is the whole 160, not just its text.
  center: {
    minWidth: 160,
  },
  label: {
    textAlign: "center",
  },
});
