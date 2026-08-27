import { Stack } from "expo-router";

import { useTheme } from "@/utils/theme";

export type TSearchFieldProps = {
  /** Ignored here — the native search bar owns its own text (no `value` in
   * SearchBarProps). Kept in the shared contract so both platforms match. */
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
};

// Search tab's input, as the platform's own search bar (DEX-47), forcing the
// DEX-107 SafeAreaView framing in search/index.tsx. .web.tsx is the fallback.
export function SearchField({ onChangeText, placeholder }: TSearchFieldProps) {
  const theme = useTheme();

  return (
    <Stack.SearchBar
      placeholder={placeholder}
      // `automatic` lets the OS choose — iOS 26+ integrates with the tab bar
      // for a role="search" tab, below it falls back to the header.
      placement="automatic"
      // The whole screen is the search results, so the field should stay put
      // rather than hiding as the list scrolls.
      hideWhenScrolling={false}
      // Mount, not tab press — native tabs keep this mounted after first
      // visit, so re-focusing on every switch back would cover read results.
      autoFocus
      autoCapitalize="none"
      // Uncontrolled — a NativeSyntheticEvent, not a string like RN's own
      // TextInput.onChangeText.
      onChangeText={(event) => onChangeText(event.nativeEvent.text)}
      barTintColor={theme.colors.surfaceSunken}
      textColor={theme.colors.text}
      tintColor={theme.colors.primary}
      // Android-only, harmless on iOS — without these the bar ignores the theme.
      hintTextColor={theme.colors.textSecondary}
      headerIconColor={theme.colors.textSecondary}
    />
  );
}
