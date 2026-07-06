import { DatePicker, Host } from "@expo/ui/swift-ui";
import {
  datePickerStyle,
  tint,
  type ModifierConfig,
} from "@expo/ui/swift-ui/modifiers";

import { TDateFieldProps } from "./DateField.types";

/**
 * A compact date chip. Hosts the SwiftUI date picker directly with
 * `matchContents` on both axes so the chip reports its real size and rows can
 * align it like any other view — the community `DateTimePicker`'s host only
 * matches vertically, leaving the chip floating in an unbounded width.
 */
export function DateField({
  accentColor,
  onChange,
  testID,
  value,
}: TDateFieldProps) {
  const modifiers: ModifierConfig[] = [datePickerStyle("compact")];
  if (accentColor) {
    modifiers.push(tint(accentColor));
  }

  return (
    <Host matchContents>
      <DatePicker
        displayedComponents={["date"]}
        modifiers={modifiers}
        selection={value}
        testID={testID}
        onDateChange={onChange}
      />
    </Host>
  );
}
