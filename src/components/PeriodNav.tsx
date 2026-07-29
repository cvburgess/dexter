import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";

/**
 * Width (in dp) of the nav's center slot. Fixed rather than intrinsic so the
 * chevrons stay put as the label's text width changes ("Friday, Jul 3" →
 * "Wednesday, Sep 10"), and so the Today and Week tabs' arrows land on the same
 * x — see `PeriodNav`. Exported for the one center control that isn't a
 * `PeriodNavLabel`: `DayNav`'s calendar picker.
 */
export const PERIOD_NAV_CENTER_MIN_WIDTH = 160;

type TPeriodNavProps = {
  onPrev: () => void;
  onNext: () => void;
  /** Accessibility label for the ‹ chevron, e.g. "Previous day". */
  prevLabel: string;
  /** Accessibility label for the › chevron, e.g. "Next week". */
  nextLabel: string;
  /**
   * The center slot, between the two chevrons — a `PeriodNavLabel` for the
   * plain "jump back to now" shortcut both tabs have, or any control sized to
   * `PERIOD_NAV_CENTER_MIN_WIDTH`.
   */
  children: ReactNode;
};

/**
 * The prev/center/next row shared by `DayNav` (Today) and `WeekNav` (Week).
 *
 * Owning the arrow hit area, the 24pt chevrons, and the center slot's width
 * here is what keeps the two tabs' header rows on the same baseline: the
 * metrics live in one place, so they can't drift the way they could when each
 * nav carried its own copy guarded by a comment (DEX-97).
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
      {children}
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
  label: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: PERIOD_NAV_CENTER_MIN_WIDTH,
    textAlign: "center",
  },
});
