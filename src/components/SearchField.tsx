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
 * **A screen that renders this has to frame itself differently** (DEX-107).
 * Attaching a search bar makes expo-router force the header *translucent*, and
 * react-native-screens answers that by laying the screen body out underneath the
 * navigation bar. `react-native-safe-area-context` can't see that bar — its
 * provider is mounted per tab screen, above the Stack — so the host has to take
 * its top inset from `react-native-screens/experimental`'s `SafeAreaView`, which
 * resolves against the stack screen's own view. `app/(app)/(tabs)/search/index.tsx`
 * is the worked example; the safe-area section of `docs/frontend.md` has the
 * mechanism. The same applies to `headerLargeTitle`, which forces it too.
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
      // Focus on mount, so opening the tab lands with the keyboard up rather
      // than needing a second tap on the field.
      //
      // Mount, not tab press: native tabs keep this screen mounted once it has
      // been visited, so this fires on the first visit of a session and not on
      // later switches back. Focusing on every visit would need the ref's
      // `SearchBarCommands.focus()` driven from `useFocusEffect` (or a
      // `tabPress` listener); deliberately not doing that, since re-focusing
      // every time would put the keyboard over results the user came back to read.
      autoFocus
      autoCapitalize="none"
      // The native field is uncontrolled, so this event *is* the query. Note
      // it's a `NativeSyntheticEvent`, not a string — the text is on
      // `nativeEvent`, unlike React Native's own `TextInput.onChangeText`.
      onChangeText={(event) => onChangeText(event.nativeEvent.text)}
      barTintColor={theme.colors.surfaceSunken}
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
