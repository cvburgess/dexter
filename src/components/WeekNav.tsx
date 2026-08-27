import { Temporal } from "@js-temporal/polyfill";
import { TouchableOpacity } from "react-native";

import { PeriodNav, PeriodNavLabel } from "@/components/PeriodNav";
import { weekOf } from "@/utils/weekStartEnd";

type TWeekNavProps = {
  /** The Monday of the week on screen. */
  monday: Temporal.PlainDate;
  onChangeWeek: (monday: Temporal.PlainDate) => void;
};

// Week-at-a-time nav (DEX-96), the sibling of DayNav sharing PeriodNav. No
// calendar-picker branch — the center label is always "back to this week".
export function WeekNav({ monday, onChangeWeek }: TWeekNavProps) {
  // `yearOfWeek`, not `year` — an ISO week can belong to the neighbouring
  // calendar year, which the legacy app got wrong.
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
