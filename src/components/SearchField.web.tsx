import { TextInput } from "@/components/TextInput";

import type { TSearchFieldProps } from "./SearchField";

// react-native-screens has no web counterpart for the native search bar, so
// this is the themed in-body TextInput the screen used before it landed —
// unlike native, this side is controlled and honors `value`.
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: TSearchFieldProps) {
  return (
    <TextInput
      accessibilityLabel="Search"
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      returnKeyType="search"
    />
  );
}
