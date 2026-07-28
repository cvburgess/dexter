import { TextInput } from "@/components/TextInput";

import type { TSearchFieldProps } from "./SearchField";

/**
 * The web half of `components/SearchField.tsx`.
 *
 * `react-native-screens` implements the header search bar natively on iOS and
 * Android only — there is no web counterpart, so `Stack.SearchBar` would render
 * nothing and the web build would have no way to type a query. This keeps the
 * themed in-body `TextInput` the screen used before the native bar landed.
 *
 * Unlike the native side this is a controlled input, so `value` is honored here.
 */
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
