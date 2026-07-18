import { DatePicker, Host } from "@expo/ui/swift-ui";
import {
  datePickerStyle,
  tint,
  type ModifierConfig,
} from "@expo/ui/swift-ui/modifiers";

import { dateToTimeString, timeStringToDate } from "./TimeField.shared";
import { TTimeFieldProps } from "./TimeField.types";

/**
 * A compact time chip. Hosts the SwiftUI time picker directly with
 * `matchContents` so it reports its real size and aligns in a settings row —
 * mirrors `DateField.ios` but shows hour + minute instead of a date.
 */
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
