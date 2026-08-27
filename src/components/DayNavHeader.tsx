import { Temporal } from "@js-temporal/polyfill";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { DayNav } from "@/components/DayNav";

type TDayNavHeaderProps = {
  date: Temporal.PlainDate;
  onChangeDate: (date: Temporal.PlainDate) => void;
  /** Control at the row's leading edge, or nothing. */
  leading?: ReactNode;
  /** Control at the row's trailing edge, or nothing. */
  trailing?: ReactNode;
};

/** `DayNav` with up to one control per edge, **absolutely positioned, not
 * flex siblings** — a flex control would push the centered arrows off. */
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
  // Full-height so the control centers against the nav row; inset is
  // Today's own switcher value, tighter than the gutter to clear PeriodNav.
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
