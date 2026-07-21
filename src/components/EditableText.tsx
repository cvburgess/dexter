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
  /**
   * Fires on every keystroke with the raw text. For callers whose "commit" is
   * just local form state: without it, saving a form while an input still has
   * focus loses the text, because on native a header button press does not
   * blur the field first.
   */
  onChangeDraft?: (text: string) => void;
  editable?: boolean;
  /** Caps input length. Subtask titles use 100 to match the MCP server's schema. */
  maxLength?: number;
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
  onChangeDraft,
  editable = true,
  maxLength,
  placeholder,
  numberOfLines = 1,
  style,
  testID,
}: TEditableTextProps) {
  if (editing && editable) {
    return (
      <InlineInput
        // Deliberately not keyed on `value`: the input already mounts fresh
        // each time editing begins, so a key would only remount mid-edit — and
        // the unmount cleanup would commit the half-typed draft, discarding the
        // very keystrokes the remount was meant to preserve. `InlineInput`
        // re-seeds itself from a changed `value` while untouched instead.
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
  onChangeDraft?: (text: string) => void;
  onSubmit?: (title: string) => void;
  editable?: boolean;
  maxLength?: number;
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

  // Re-seed from a value that changed while this input was open but untouched —
  // a rename landing from another device, or a realtime refetch. Adjusting
  // state during render is React's own recommendation for deriving from props.
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
        // Always blur here rather than letting `blurOnSubmit` do it — one
        // mechanism, and it keeps the ordering explicit: commit, then blur,
        // then let the caller chain.
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
