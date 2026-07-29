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
  /**
   * The center slot's contents, between the two chevrons — a `PeriodNavLabel`
   * for the "jump back to now" shortcut both tabs have, or any other control.
   * The slot sizes it; the caller doesn't restate the width.
   */
  children: ReactNode;
};

/**
 * The prev/center/next row shared by `DayNav` (Today) and `WeekNav` (Week).
 *
 * Owning the arrow hit area, the 24pt chevrons, and the center slot's width
 * here is what keeps the two tabs' header rows on the same baseline: the
 * metrics live in one place, so they can't drift the way they could when each
 * nav carried its own copy guarded by a comment (DEX-97). The slot's width is
 * fixed rather than intrinsic so the chevrons also stay put as the label's text
 * changes ("Friday, Jul 3" → "Wednesday, Sep 10").
 *
 * Purely presentational — the period arithmetic and what the center does stay
 * with the caller, which is the only part the two navs genuinely disagree on.
 */
export function PeriodNav({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  children,
}: TPeriodNavProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityLabel={prevLabel}
        onPress={onPrev}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: theme.colors.text }]}>‹</Text>
      </TouchableOpacity>
      <View style={styles.center} testID="period-nav-center">
        {children}
      </View>
      <TouchableOpacity
        accessibilityLabel={nextLabel}
        onPress={onNext}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: theme.colors.text }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

/** The center slot's text, at the shared metrics. */
export function PeriodNavLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <Text style={[styles.label, { color: theme.colors.text }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  arrow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  arrowText: {
    fontSize: 24,
    fontWeight: "600",
  },
  // The default `alignItems: "stretch"` is load-bearing: it hands the full slot
  // width to whatever the caller puts here, so a tappable label's hit area is
  // the whole 160 rather than just its text.
  center: {
    minWidth: 160,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
