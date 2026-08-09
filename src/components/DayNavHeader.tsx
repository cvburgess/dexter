import { Temporal } from "@js-temporal/polyfill";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { DayNav } from "@/components/DayNav";
import { useTheme } from "@/utils/theme";

type TDayNavHeaderProps = {
  date: Temporal.PlainDate;
  onChangeDate: (date: Temporal.PlainDate) => void;
  /** Control at the row's leading edge, or nothing. */
  leading?: ReactNode;
  /** Control at the row's trailing edge, or nothing. */
  trailing?: ReactNode;
  /**
   * How the controls sit relative to the nav. Defaults to `"overlay"`.
   *
   * `"overlay"` keeps `DayNav` centered on the screen and floats the controls
   * over the space either side of it — right for a control roughly as wide as
   * the gap, which is every case but one. `"row"` lays all three out in flow
   * instead, wrapping when they don't fit; use it when a control is too wide to
   * overlay without landing on the nav's arrows (the Ritual flow's web step
   * icons, which are a whole row of buttons).
   */
  layout?: "overlay" | "row";
};

/**
 * The small-screen header row shared by the Today tab and the Ritual flow:
 * `DayNav` with up to one control at each edge.
 *
 * In the default `"overlay"` layout the controls are **absolutely positioned
 * rather than flex siblings**, which is the whole reason this is a component.
 * `DayNav` spans the full width so its arrows and date stay screen-centered; a
 * control taking row space would push it off-center by its own width, so Today
 * (one control) and Ritual (two) would center their navs in different places
 * and the row would visibly shift as you moved between the tabs. Overlaying
 * keeps the nav put whatever sits beside it — the horizontal counterpart of
 * what `LargeScreenHeader` does for the large-screen tabs (DEX-127).
 *
 * Overlaying only works while the control fits the space beside the nav,
 * though, and one doesn't: the Ritual flow's web switcher is a button per step.
 * That case takes `layout="row"` and gives up the centering, because the
 * alternative — a row of buttons painted across `DayNav`'s next-day arrow — is
 * worse than a nav that sits left of center.
 */
export function DayNavHeader({
  date,
  onChangeDate,
  leading,
  trailing,
  layout = "overlay",
}: TDayNavHeaderProps) {
  const theme = useTheme();

  if (layout === "row") {
    return (
      <View
        style={[
          styles.flowHeader,
          { gap: theme.space.sm, paddingHorizontal: theme.space.md },
        ]}
      >
        {leading}
        <DayNav date={date} onChangeDate={onChangeDate} />
        {trailing}
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <DayNav date={date} onChangeDate={onChangeDate} />
      {leading ? (
        <View style={[styles.slot, styles.leading]} testID="day-nav-leading">
          {leading}
        </View>
      ) : null}
      {trailing ? (
        <View style={[styles.slot, styles.trailing]} testID="day-nav-trailing">
          {trailing}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    justifyContent: "center",
  },
  // `wrap` is what keeps the row honest on a narrow browser window, where six
  // step buttons and the date nav genuinely cannot share a line: the switcher
  // drops below rather than squeezing the nav. `space-between` pins the two
  // ends while there is room to spare.
  flowHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  // Full-height so the overlaid control centers against the nav row whatever
  // its own height is. The inset is the value the Today tab has always used for
  // its switcher; it is deliberately a little tighter than the theme gutter so
  // the control clears `PeriodNav`'s chevron hit area.
  slot: {
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    position: "absolute",
    top: 0,
  },
  leading: {
    left: 20,
  },
  trailing: {
    right: 20,
  },
});
