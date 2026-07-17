import { Host, Picker } from "@expo/ui";

import { FormRow } from "@/components/FormRow";

type TPickerOption<V extends string> = {
  label: string;
  value: V;
};

type TPickerFieldProps<V extends string> = {
  label: string;
  options: readonly TPickerOption<V>[];
  selectedValue: V;
  onValueChange: (value: V) => void;
  testID?: string;
  /** Forwarded to FormRow; most forms use 40, new-task uses a tighter 32. */
  minHeight?: number;
};

/** A labeled row wrapping a menu-style @expo/ui Picker, shared by every form
 * that lets the user pick one option from a fixed list (list, goal, repeat
 * frequency, month, day of month, ...). */
export function PickerField<V extends string>({
  label,
  options,
  selectedValue,
  onValueChange,
  testID,
  minHeight,
}: TPickerFieldProps<V>) {
  return (
    <FormRow label={label} minHeight={minHeight}>
      <Host matchContents>
        <Picker
          appearance="menu"
          selectedValue={selectedValue}
          testID={testID}
          // The Picker callback's value comes back as a plain string, losing
          // the literal union type — every call site already round-trips it.
          onValueChange={(value) => onValueChange(String(value) as V)}
        >
          {options.map((option) => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
            />
          ))}
        </Picker>
      </Host>
    </FormRow>
  );
}
