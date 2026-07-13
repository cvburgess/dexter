import { DateTimePicker } from "@expo/ui/community/datetime-picker";

import { dateToTimeString, timeStringToDate } from "./TimeField.shared";
import { TTimeFieldProps } from "./TimeField.types";

/**
 * Android/web implementation of the time field (also what `tsc` resolves —
 * Metro picks `TimeField.ios.tsx` on iOS and `TimeField.web.tsx` on web). The
 * community `DateTimePicker` in `time` mode sizes itself fine on Android.
 */
export function TimeField({
  accentColor,
  onChange,
  testID,
  value,
}: TTimeFieldProps) {
  return (
    <DateTimePicker
      accentColor={accentColor}
      mode="time"
      testID={testID}
      value={timeStringToDate(value)}
      onValueChange={(_event, date) => onChange(dateToTimeString(date))}
    />
  );
}
