import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { makeSubtaskId, SUBTASK_TITLE_MAX_LENGTH } from "@/utils/subtasks";
import { useTheme } from "@/utils/theme";

import { EditableText } from "./EditableText";
import { FormRow } from "./FormRow";

/**
 * The minimum a row needs to be edited here. Generic over the rest so this
 * serves both a task's `TSubtask` (which carries a status) and a template's
 * `TTemplateSubtask` (which doesn't) without either widening to the other.
 */
type TEditableRow = { id: string; title: string };

/**
 * Drops rows with no title, for the moment a form is saved. Still needed even
 * though keystrokes are mirrored live: "Add subtask" can be tapped and the form
 * saved without a single character being typed. Exported so both form screens
 * apply one rule rather than each carrying its own copy.
 */
export const withTitledRows = <S extends TEditableRow>(rows: S[]): S[] =>
  rows.filter(({ title }) => title.trim().length > 0);

type TSubtaskFieldsProps<S extends TEditableRow> = {
  value: S[];
  onChange: (subtasks: S[]) => void;
  /** Builds a new empty row; supplies whatever fields the caller's shape adds. */
  makeRow: (id: string) => S;
  testIDPrefix: string;
};

/**
 * The "Add subtask" affordance plus the checklist rows, for the two *form*
 * surfaces — creating a task and editing a repeat template. Both previously
 * carried an identical copy of this and had already drifted apart.
 *
 * Distinct from `SubtaskRow`, which is the in-card presentation: rows here have
 * no status to toggle, because a form row is a value being composed rather than
 * stored state. They do have an explicit ×, since the template form seeds this
 * from saved rows and emptying a title reverts rather than deletes.
 */
export function SubtaskFields<S extends TEditableRow>({
  value,
  onChange,
  makeRow,
  testIDPrefix,
}: TSubtaskFieldsProps<S>) {
  const theme = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  // The title a row had when its edit began. Keystrokes are mirrored into form
  // state live (so Save never loses them), which overwrites the stored title —
  // this is what an emptied row reverts to.
  const [titleBeforeEdit, setTitleBeforeEdit] = useState("");

  // Return-to-chain commits a title and appends the next row in the *same*
  // event, so the second change would otherwise read the pre-commit `value`
  // prop and drop the title just typed. This tracks the latest array across
  // both writes.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  const apply = (next: S[]) => {
    latest.current = next;
    onChange(next);
  };

  const setTitle = (id: string, title: string) =>
    apply(
      latest.current.map((row) => (row.id === id ? { ...row, title } : row)),
    );

  const startEditing = (id: string, currentTitle: string) => {
    setTitleBeforeEdit(currentTitle);
    setEditingId(id);
  };

  const addRow = () => {
    const row = makeRow(makeSubtaskId());
    apply([...latest.current, row]);
    startEditing(row.id, "");
  };

  const removeRow = (id: string) => {
    setEditingId((current) => (current === id ? null : current));
    apply(latest.current.filter((row) => row.id !== id));
  };

  const commitTitle = (id: string, title: string) => {
    // Guarded, not unconditional: React runs the outgoing row's unmount cleanup
    // *after* `editingId` has already moved to the row the user just tapped, so
    // clearing blindly would cancel the edit they are starting.
    setEditingId((current) => (current === id ? null : current));

    if (title !== "") {
      setTitle(id, title);
      return;
    }

    // A row that never had a title is discarded; one that did reverts to it.
    // Clearing the text to retype must not silently delete a template's
    // checklist item — the × is the deliberate way to do that.
    if (titleBeforeEdit === "") removeRow(id);
    else setTitle(id, titleBeforeEdit);
  };

  return (
    <>
      <FormRow label="Subtasks" minHeight={32}>
        <TouchableOpacity
          accessibilityRole="button"
          testID={`${testIDPrefix}-add-subtask`}
          onPress={addRow}
        >
          <Text style={[styles.action, { color: theme.colors.primary }]}>
            Add subtask
          </Text>
        </TouchableOpacity>
      </FormRow>

      {value.length > 0 && (
        <View style={styles.rows}>
          {value.map((row) => (
            <View key={row.id} style={styles.row}>
              <Text
                style={[styles.bullet, { color: theme.colors.textSecondary }]}
              >
                ○
              </Text>
              <EditableText
                value={row.title}
                editing={editingId === row.id}
                onStartEdit={() => startEditing(row.id, row.title)}
                onCommit={(title) => commitTitle(row.id, title)}
                // Mirror keystrokes into form state: on native, tapping Save
                // does not blur the focused input first, so without this the
                // row being typed would be dropped from the payload.
                onChangeDraft={(text) => setTitle(row.id, text)}
                // Return chains the next row; an empty commit ends the chain.
                onSubmit={(title) => {
                  if (title) addRow();
                }}
                maxLength={SUBTASK_TITLE_MAX_LENGTH}
                placeholder="Subtask"
                testID={`${testIDPrefix}-subtask-${row.id}`}
                style={[styles.title, { color: theme.colors.text }]}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove subtask ${row.title}`}
                testID={`${testIDPrefix}-remove-subtask-${row.id}`}
                onPress={() => removeRow(row.id)}
              >
                <Text
                  style={[styles.remove, { color: theme.colors.textSecondary }]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  action: {
    fontSize: 14,
  },
  rows: {
    gap: 4,
    // Indent under the "Subtasks" row so the checklist reads as belonging to it.
    paddingLeft: 16,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 28,
  },
  bullet: {
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontSize: 14,
  },
  remove: {
    fontSize: 14,
    paddingHorizontal: 4,
  },
});
