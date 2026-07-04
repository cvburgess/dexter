import { DateTimePicker } from "@expo/ui/community/datetime-picker";

import { TDateFieldProps } from "./DateField.types";

/**
 * Android/web implementation of the date field (also what `tsc` resolves —
 * Metro picks `DateField.ios.tsx` on iOS). The community `DateTimePicker`
 * sizes itself fine on these platforms.
 */
export function DateField({
  accentColor,
  onChange,
  testID,
  value,
}: TDateFieldProps) {
  return (
    <DateTimePicker
      accentColor={accentColor}
      mode="date"
      testID={testID}
      value={value}
      onValueChange={(_event, date) => onChange(date)}
    />
  );
}
