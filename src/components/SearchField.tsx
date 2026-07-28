import { Stack } from "expo-router";

import { useTheme } from "@/utils/theme";

export type TSearchFieldProps = {
  /**
   * The current query.
   *
   * Rendered by the web implementation, which owns a controlled `TextInput`.
   * **Ignored here:** the native search bar is a UIKit/Android view that owns
   * its own text — `SearchBarProps` has no `value`, only a `ref` exposing
   * imperative `SearchBarCommands`. Kept in the shared contract so the two
   * implementations take the same props; nothing in the app needs to set the
   * query programmatically.
   */
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
};

/**
 * The Search tab's input, as the platform's own search bar (DEX-47).
 *
 * Renders into the navigation header rather than the screen body — `Stack.
 * SearchBar` returns `null` and appends itself to the screen's navigation
 * options, which is also why it forces `headerShown: true` (the Search tab's
 * Stack already shows a themed header, so nothing changes there). On iOS 26+
 * this is what lets the `role="search"` tab collapse into a search field in the
 * tab bar itself.
 *
 * `components/SearchField.web.tsx` is the web half: `react-native-screens` has
 * no web implementation of the header search bar, so the web build keeps an
 * in-body themed `TextInput`. Without that split, web would have no way to type
 * a query at all.
 */
export function SearchField({ onChangeText, placeholder }: TSearchFieldProps) {
  const theme = useTheme();

  return (
    <Stack.SearchBar
      placeholder={placeholder}
      // `automatic` lets the OS choose: on iOS 26+ that includes integrating
      // with the tab bar for a `role="search"` tab, and below it falls back to
      // the standard header placement.
      placement="automatic"
      // The whole screen is the search results, so the field should stay put
      // rather than hiding as the list scrolls.
      hideWhenScrolling={false}
      autoCapitalize="none"
      // The native field is uncontrolled, so this event *is* the query. Note
      // it's a `NativeSyntheticEvent`, not a string — the text is on
      // `nativeEvent`, unlike React Native's own `TextInput.onChangeText`.
      onChangeText={(event) => onChangeText(event.nativeEvent.text)}
      barTintColor={theme.colors.card}
      textColor={theme.colors.text}
      tintColor={theme.colors.primary}
      // Android-only knobs; harmless on iOS, and without them the Android bar
      // renders its hint and icon in the platform default rather than the
      // active theme.
      hintTextColor={theme.colors.textSecondary}
      headerIconColor={theme.colors.textSecondary}
    />
  );
}
