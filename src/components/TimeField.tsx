import { DateTimePicker } from "@expo/ui/community/datetime-picker";

import { useUses24HourClock } from "@/hooks/useUses24HourClock";

import { dateToTimeString, timeStringToDate } from "./TimeField.shared";
import { TTimeFieldProps } from "./TimeField.types";

// Android/web implementation (also what tsc resolves — Metro picks the
// platform file). The community DateTimePicker sizes itself fine on Android.
export function TimeField({
  accentColor,
  onChange,
  testID,
  value,
}: TTimeFieldProps) {
  const uses24HourClock = useUses24HourClock();
  return (
    <DateTimePicker
      accentColor={accentColor}
      // Android-only prop; the native side defaults to 24h regardless.
      is24Hour={uses24HourClock}
      mode="time"
      testID={testID}
      value={timeStringToDate(value)}
      onValueChange={(_event, date) => onChange(dateToTimeString(date))}
    />
  );
}
