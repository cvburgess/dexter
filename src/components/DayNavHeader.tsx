import { Temporal } from "@js-temporal/polyfill";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { DayNav } from "@/components/DayNav";

type TDayNavHeaderProps = {
  date: Temporal.PlainDate;
  onChangeDate: (date: Temporal.PlainDate) => void;
  /** Control overlaid at the row's left edge, or nothing. */
  leading?: ReactNode;
  /** Control overlaid at the row's right edge, or nothing. */
  trailing?: ReactNode;
};

/**
 * The small-screen header row shared by the Today tab and the Ritual flow:
 * `DayNav` centered on the screen with up to one control overlaid at each edge.
 *
 * The controls are **absolutely positioned rather than flex siblings**, which is
 * the whole reason this is a component. `DayNav` spans the full width so its
 * arrows and date stay screen-centered; a control taking row space would push it
 * off-center, and two controls of different widths (Ritual has a round button on
 * one side and a text button on the other) would push it off-center by different
 * amounts on each side. Overlaying keeps the nav in the same place on both
 * screens whatever sits beside it — the horizontal counterpart of what
 * `LargeScreenHeader` does for the large-screen tabs (DEX-127).
 */
export function DayNavHeader({
  date,
  onChangeDate,
  leading,
  trailing,
}: TDayNavHeaderProps) {
  return (
    <View style={styles.header}>
      <DayNav date={date} onChangeDate={onChangeDate} />
      {leading ? (
        <View style={[styles.slot, styles.leading]}>{leading}</View>
      ) : null}
      {trailing ? (
        <View style={[styles.slot, styles.trailing]}>{trailing}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    justifyContent: "center",
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
