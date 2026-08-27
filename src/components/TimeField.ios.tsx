import { DatePicker, Host } from "@expo/ui/swift-ui";
import {
  datePickerStyle,
  tint,
  type ModifierConfig,
} from "@expo/ui/swift-ui/modifiers";

import { dateToTimeString, timeStringToDate } from "./TimeField.shared";
import { TTimeFieldProps } from "./TimeField.types";

// A compact time chip, hosting the SwiftUI picker directly with matchContents
// so it reports its real size — mirrors DateField.ios but for hour + minute.
export function TimeField({
  accentColor,
  min,
  onChange,
  testID,
  value,
}: TTimeFieldProps) {
  const modifiers: ModifierConfig[] = [datePickerStyle("compact")];
  if (accentColor) {
    modifiers.push(tint(accentColor));
  }

  return (
    <Host matchContents>
      <DatePicker
        displayedComponents={["hourAndMinute"]}
        modifiers={modifiers}
        // A lower bound disables earlier times (e.g. now, so a same-day alarm
        // can't be set in the past). `min` is a time-of-day, anchored to today.
        range={min ? { start: timeStringToDate(min) } : undefined}
        selection={timeStringToDate(value)}
        testID={testID}
        onDateChange={(date) => onChange(dateToTimeString(date))}
      />
    </Host>
  );
}
