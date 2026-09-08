import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import {
  type ContextMenuItem,
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
} from "react-native-enriched-markdown";

import { isListActive, nextHeadingLevel } from "@/utils/markdownMenu";
import { markdownInputStyle } from "@/utils/markdownStyle";
import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

// Uncontrolled (defaultValue + onChangeMarkdown) so React never fights the
// caret. The input routes keyboard dismissal through the enclosing ScrollView.

// Block commands ride the native selection menu, which the library only builds
// once text is selected — so an empty line can't be formatted: type, then select.

export function NoteEditor({
  initialValue,
  onChangeMarkdown,
  placeholder,
  autoFocus,
  onFocusChange,
  testID,
}: TNoteEditorProps) {
  const theme = useTheme();
  const inputRef = useRef<EnrichedMarkdownTextInputInstance>(null);
  const [state, setState] = useState<StyleState | null>(null);
  const inputStyle = useMemo(() => markdownInputStyle(theme), [theme]);

  // React fires no blur on unmount, which would otherwise leave the host's
  // swipe gesture disabled on the next day.
  useEffect(() => () => onFocusChange?.(false), [onFocusChange]);

  // `icon` is an SF Symbol the library draws itself; Android shows text only.
  const inList = isListActive(state);
  const menuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        text: "Heading",
        icon: "textformat.size",
        onPress: ({ styleState }) =>
          inputRef.current?.toggleHeading(nextHeadingLevel(styleState)),
      },
      {
        text: "Bullet list",
        icon: "list.bullet",
        onPress: () => inputRef.current?.toggleUnorderedList(),
      },
      {
        text: "Numbered list",
        icon: "list.number",
        onPress: () => inputRef.current?.toggleOrderedList(),
      },
      {
        text: "Outdent",
        icon: "decrease.indent",
        visible: inList,
        onPress: () => inputRef.current?.outdentList(),
      },
      {
        text: "Indent",
        icon: "increase.indent",
        visible: inList,
        onPress: () => inputRef.current?.indentList(),
      },
    ],
    [inList],
  );

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.fill}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      style={styles.fill}
    >
      <EnrichedMarkdownTextInput
        ref={inputRef}
        autoFocus={autoFocus}
        contextMenuItems={menuItems}
        cursorColor={theme.colors.primary}
        defaultValue={initialValue}
        markdownStyle={inputStyle}
        multiline
        onBlur={() => {
          // Stale list state would otherwise gate the menu on the next focus.
          setState(null);
          onFocusChange?.(false);
        }}
        onChangeMarkdown={onChangeMarkdown}
        onChangeState={setState}
        onFocus={() => onFocusChange?.(true)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        selectionColor={theme.colors.primary}
        style={StyleSheet.flatten([
          styles.fill,
          // Body copy, not a heading: the writing surface takes the same role
          // token as the rest of the app's prose.
          theme.fonts.body,
          { color: theme.colors.text, padding: theme.space.md },
        ])}
        testID={testID}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
