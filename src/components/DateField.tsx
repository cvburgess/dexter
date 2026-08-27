import { DateTimePicker } from "@expo/ui/community/datetime-picker";

import { TDateFieldProps } from "./DateField.types";

/** Android/web date field — the community `DateTimePicker` sizes fine there;
 * also what `tsc` resolves (Metro picks `.ios.tsx` on iOS). */
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
