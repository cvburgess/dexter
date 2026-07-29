import { Temporal } from "@js-temporal/polyfill";
import { TouchableOpacity } from "react-native";

import { PeriodNav, PeriodNavLabel } from "@/components/PeriodNav";
import { weekOf } from "@/utils/weekStartEnd";

type TWeekNavProps = {
  /** The Monday of the week on screen. */
  monday: Temporal.PlainDate;
  onChangeWeek: (monday: Temporal.PlainDate) => void;
};

/**
 * Week-at-a-time navigation for the Week tab (DEX-96) — the sibling of
 * `DayNav`, and a port of the legacy dexter-app's `WeekNav`. Both render the
 * shared `PeriodNav`, which is what keeps the two tabs' header rows aligned.
 *
 * Deliberately simpler than `DayNav`: there is no calendar-picker branch, so
 * the center label is *always* the "back to this week" shortcut rather than
 * flipping roles on the current week. The legacy view worked the same way, and
 * a picker that jumps to a single date has little to say about which week to
 * show.
 */
export function WeekNav({ monday, onChangeWeek }: TWeekNavProps) {
  // `yearOfWeek`, not `year`: an ISO week can belong to the neighbouring
  // calendar year (Dec 30 2024 is week 1 of 2025; Jan 1 2027 is week 53 of
  // 2026), which the legacy app got wrong by labelling with `.year`.
  const label = `Week ${monday.weekOfYear}, ${monday.yearOfWeek}`;

  return (
    <PeriodNav
      nextLabel="Next week"
      onNext={() => onChangeWeek(monday.add({ weeks: 1 }))}
      onPrev={() => onChangeWeek(monday.subtract({ weeks: 1 }))}
      prevLabel="Previous week"
    >
      <TouchableOpacity
        accessibilityLabel="Go to this week"
        onPress={() => onChangeWeek(weekOf(Temporal.Now.plainDateISO()).monday)}
      >
        <PeriodNavLabel>{label}</PeriodNavLabel>
      </TouchableOpacity>
    </PeriodNav>
  );
}
