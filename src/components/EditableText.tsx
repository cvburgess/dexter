import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
} from "react-native";

import { NO_FOCUS_RING } from "@/utils/inputStyles";

type TEditableTextProps = {
  value: string;
  /** Whether this row is the one currently being edited (the parent owns which). */
  editing: boolean;
  /** Tapped while not editing — the parent should make this row the editing one. */
  onStartEdit: () => void;
  /** Committed, trimmed title on blur/return/unmount. **Empty is a real
   * commit** — the caller decides what it means. */
  onCommit: (title: string) => void;
  /** Return key, after `onCommit` with the same title — lets the caller end
   * a chain on an empty row rather than appending forever. */
  onSubmit?: (title: string) => void;
  /** Every keystroke's raw text — without it, saving a form mid-focus loses
   * text, since a native header press doesn't blur first. */
  onChangeDraft?: (text: string) => void;
  editable?: boolean;
  /** Replaces tap-to-edit with a plain label calling this instead — Search
   * results open on tap rather than renaming (DEX-47). Wins over `editable`. */
  onPress?: () => void;
  /** Caps input length. Subtask titles use 100 to match the MCP server's schema. */
  maxLength?: number;
  placeholder?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/** A title that swaps to an inline input when tapped (DEX-70) — shared by
 * task titles and subtask rows as one editing vocabulary. */
export function EditableText({
  value,
  editing,
  onStartEdit,
  onCommit,
  onSubmit,
  onChangeDraft,
  editable = true,
  onPress,
  maxLength,
  placeholder,
  numberOfLines = 1,
  style,
  testID,
}: TEditableTextProps) {
  if (editing && editable && !onPress) {
    return (
      <InlineInput
        // Not keyed on `value` — a remount mid-edit would commit the
        // half-typed draft via unmount cleanup; it re-seeds instead.
        initialValue={value}
        onCommit={onCommit}
        onChangeDraft={onChangeDraft}
        onSubmit={onSubmit}
        maxLength={maxLength}
        placeholder={placeholder}
        style={style}
        testID={testID}
      />
    );
  }

  return (
    <Pressable
      onPress={onPress ?? (editable ? onStartEdit : undefined)}
      disabled={!onPress && !editable}
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
  onChangeDraft?: (text: string) => void;
  onSubmit?: (title: string) => void;
  editable?: boolean;
  maxLength?: number;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/** Mounted only while editing — its unmount *is* the end of the edit. Ends
 * via `blur()`, never `Keyboard.dismiss()`, which leaves the field focused. */
function InlineInput({
  initialValue,
  onCommit,
  onChangeDraft,
  onSubmit,
  editable = true,
  maxLength,
  placeholder,
  style,
  testID,
}: TInlineInputProps) {
  const [draft, setDraft] = useState(initialValue);
  // Whether the user has typed. Until they have, a value arriving from
  // elsewhere is safe to adopt; after, it must not stomp their keystrokes.
  const [dirty, setDirty] = useState(false);
  const [seeded, setSeeded] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);

  // Re-seed from a value changed elsewhere while untouched (another device,
  // a realtime refetch) — render-phase state adjustment, React's own pattern.
  if (!dirty && initialValue !== seeded) {
    setSeeded(initialValue);
    setDraft(initialValue);
  }

  // Read by the unmount cleanup, which must not re-run per keystroke; synced in
  // an effect rather than during render so no ref is written mid-render.
  const draftRef = useRef(initialValue);
  const committedRef = useRef(false);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    draftRef.current = draft;
    onCommitRef.current = onCommit;
  });

  useEffect(
    () => () => {
      // Unmounted mid-edit (navigation, a parent re-render that ends editing):
      // treat it as a blur so a half-typed title is not silently lost.
      if (!committedRef.current) onCommitRef.current(draftRef.current.trim());
    },
    [],
  );

  const commit = () => {
    // `draft` (state), not `draftRef`: in an event handler the state is current,
    // while the ref only catches up after the next effect flush.
    const title = draft.trim();
    if (committedRef.current) return title;
    committedRef.current = true;
    onCommit(title);
    return title;
  };

  return (
    <TextInput
      ref={inputRef}
      autoFocus
      editable={editable}
      maxLength={maxLength}
      value={draft}
      onChangeText={(text) => {
        setDirty(true);
        setDraft(text);
        // Lets a caller mirror keystrokes into its own state, so a form that is
        // saved while this input still has focus does not lose the text.
        onChangeDraft?.(text);
      }}
      onBlur={commit}
      onSubmitEditing={() => {
        const title = commit();
        // Always blur here, not via `blurOnSubmit` — keeps the order
        // explicit: commit, then blur, then the caller chains.
        inputRef.current?.blur();
        onSubmit?.(title);
      }}
      blurOnSubmit={false}
      placeholder={placeholder}
      returnKeyType={onSubmit ? "next" : "done"}
      style={[styles.input, style]}
      testID={testID ? `${testID}-input` : undefined}
    />
  );
}

const styles = StyleSheet.create({
  // Owns the row's `flex: 1` — repeating it in `style` lands on the inner
  // Text/TextInput as a vertical grow and renders it off-center.
  pressable: {
    flex: 1,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    // Strip input chrome so editing feels like typing over the title, not a
    // form field appearing inside the card.
    margin: 0,
    padding: 0,
    ...NO_FOCUS_RING,
  },
});
