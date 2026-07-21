import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
} from "react-native";

type TEditableTextProps = {
  value: string;
  /** Whether this row is the one currently being edited (the parent owns which). */
  editing: boolean;
  /** Tapped while not editing — the parent should make this row the editing one. */
  onStartEdit: () => void;
  /**
   * The committed, trimmed title. Fires on blur, on return, and on unmount
   * while focused. An **empty string is a real commit** — the caller decides
   * what it means (revert an existing title, delete a just-added row).
   */
  onCommit: (title: string) => void;
  /**
   * Return key pressed, called after `onCommit` with the same committed title.
   * Receiving the title is what lets the caller end a chain on an empty row
   * rather than appending another empty one forever.
   */
  onSubmit?: (title: string) => void;
  editable?: boolean;
  placeholder?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * A title that swaps to an inline input when tapped (DEX-70). Used for task
 * titles — which had no rename affordance at all before this — and for subtask
 * rows, so both share one editing vocabulary.
 */
export function EditableText({
  value,
  editing,
  onStartEdit,
  onCommit,
  onSubmit,
  editable = true,
  placeholder,
  numberOfLines = 1,
  style,
  testID,
}: TEditableTextProps) {
  if (editing && editable) {
    return (
      <InlineInput
        // Remounting per edited value keeps the draft seeded from the latest
        // title, so a rename landing from elsewhere is never typed over.
        key={value}
        initialValue={value}
        onCommit={onCommit}
        onSubmit={onSubmit}
        placeholder={placeholder}
        style={style}
        testID={testID}
      />
    );
  }

  return (
    <Pressable
      onPress={editable ? onStartEdit : undefined}
      disabled={!editable}
      style={styles.pressable}
      testID={testID}
    >
      <Text numberOfLines={numberOfLines} style={style}>
        {value}
      </Text>
    </Pressable>
  );
}

type TInlineInputProps = {
  initialValue: string;
  onCommit: (title: string) => void;
  onSubmit?: (title: string) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * The input half, mounted only while editing. Living in its own component is
 * what makes the draft correct without a sync effect: it is seeded once at
 * mount, and its unmount *is* the end of the edit.
 *
 * Commit rules live here so every caller gets them — the draft is committed on
 * blur, on return, and on unmount-while-editing. That last case is not
 * hypothetical: FlashList recycles rows as they scroll out, and without it a
 * half-typed title would vanish silently.
 *
 * Editing always ends via `blur()`, never `Keyboard.dismiss()` — dismissing the
 * keyboard leaves the input focused, so the next tap elsewhere never fires the
 * blur that commits.
 */
function InlineInput({
  initialValue,
  onCommit,
  onSubmit,
  placeholder,
  style,
  testID,
}: TInlineInputProps) {
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);

  // Read by the unmount cleanup, which must not re-run per keystroke. Updated
  // from the change handler rather than during render.
  const draftRef = useRef(initialValue);
  const committedRef = useRef(false);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  useEffect(
    () => () => {
      // Unmounted mid-edit (FlashList recycle, navigation): treat it as a blur.
      if (!committedRef.current) onCommitRef.current(draftRef.current.trim());
    },
    [],
  );

  const commit = () => {
    const title = draftRef.current.trim();
    if (committedRef.current) return title;
    committedRef.current = true;
    onCommit(title);
    return title;
  };

  return (
    <TextInput
      ref={inputRef}
      autoFocus
      value={draft}
      onChangeText={(text) => {
        draftRef.current = text;
        setDraft(text);
      }}
      onBlur={commit}
      onSubmitEditing={() => {
        const title = commit();
        inputRef.current?.blur();
        onSubmit?.(title);
      }}
      blurOnSubmit={!onSubmit}
      placeholder={placeholder}
      returnKeyType={onSubmit ? "next" : "done"}
      style={[styles.input, style]}
      testID={testID ? `${testID}-input` : undefined}
    />
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  input: {
    flex: 1,
    // Strip the platform input chrome so the field sits exactly where the Text
    // did — an inline edit should feel like typing over the title, not like a
    // form field appearing inside the card.
    margin: 0,
    padding: 0,
  },
});
