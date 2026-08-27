import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { makeSubtaskId, SUBTASK_TITLE_MAX_LENGTH } from "@/utils/subtasks";
import { useTheme } from "@/utils/theme";

import { EditableText } from "./EditableText";
import { FormRow } from "./FormRow";
import { SubtaskCheck } from "./SubtaskCheck";
import { subtaskGeometry, SubtaskConnectors } from "./SubtaskConnector";

// Generic over the rest so this serves both TSubtask (has `done`) and
// TTemplateSubtask (doesn't) without either widening to the other.
type TEditableRow = { id: string; title: string };

// Still needed despite live mirroring — "Add subtask" then Save with no
// keystrokes needs this drop. Exported so both form screens share one rule.
export const withTitledRows = <S extends TEditableRow>(rows: S[]): S[] =>
  rows.filter(({ title }) => title.trim().length > 0);

type TSubtaskFieldsProps<S extends TEditableRow> = {
  value: S[];
  onChange: (subtasks: S[]) => void;
  /** Builds a new empty row; supplies whatever fields the caller's shape adds. */
  makeRow: (id: string) => S;
  /** Fired on append, before autofocus — for forms that must scroll it into view. */
  onAddRow?: () => void;
  testIDPrefix: string;
};

// Shared by the two form surfaces that had already drifted apart. Unlike
// SubtaskRow, the checkbox here is inert — a value being composed, not stored state.
export function SubtaskFields<S extends TEditableRow>({
  value,
  onChange,
  makeRow,
  onAddRow,
  testIDPrefix,
}: TSubtaskFieldsProps<S>) {
  const theme = useTheme();
  const checklist = subtaskGeometry(theme);
  const [editingId, setEditingId] = useState<string | null>(null);
  // What the row's title was before this edit — what an emptied row reverts to.
  const [titleBeforeEdit, setTitleBeforeEdit] = useState("");

  // Return-to-chain commits a title and appends a row in the same event, so
  // the second write would read the stale pre-commit `value` prop without this.
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
    onAddRow?.();
  };

  const removeRow = (id: string) => {
    setEditingId((current) => (current === id ? null : current));
    apply(latest.current.filter((row) => row.id !== id));
  };

  const commitTitle = (id: string, title: string) => {
    // Guarded — unmount cleanup fires after editingId already moved to the
    // next row the user tapped, so an unconditional clear would cancel that edit.
    setEditingId((current) => (current === id ? null : current));

    if (title !== "") {
      setTitle(id, title);
      return;
    }

    // Never-titled rows discard; titled ones revert — clearing text to retype
    // must not silently delete a saved checklist item.
    if (titleBeforeEdit === "") removeRow(id);
    else setTitle(id, titleBeforeEdit);
  };

  return (
    <>
      <FormRow label="Subtasks" minHeight={theme.controls.sm}>
        <TouchableOpacity
          accessibilityRole="button"
          testID={`${testIDPrefix}-add-subtask`}
          onPress={addRow}
        >
          <Text style={[theme.fonts.body, { color: theme.colors.primary }]}>
            Add subtask
          </Text>
        </TouchableOpacity>
      </FormRow>

      {value.length > 0 && (
        <View style={{ gap: checklist.gap }}>
          {/* The rail links the rows to each other only: the row above them is
              a section heading, not a parent task. */}
          <SubtaskConnectors
            count={value.length}
            color={theme.colors.textSecondary}
            leading={false}
            offset={0}
            inset={0}
          />
          {value.map((row) => (
            <View
              key={row.id}
              style={[
                styles.row,
                // Matching `SubtaskRow`, so titles line up with a saved checklist's.
                { gap: theme.space.md, height: checklist.rowHeight },
              ]}
            >
              {/* Inert — no `onToggle`: a form row is a value being composed,
                  and has nothing to check off yet. */}
              <SubtaskCheck
                done={false}
                borderColor={theme.colors.textSecondary}
                contentColor={theme.colors.text}
              />
              <EditableText
                value={row.title}
                editing={editingId === row.id}
                onStartEdit={() => startEditing(row.id, row.title)}
                onCommit={(title) => commitTitle(row.id, title)}
                // On native, Save doesn't blur first, so without this the
                // row being typed drops from the payload.
                onChangeDraft={(text) => setTitle(row.id, text)}
                // Return chains the next row; an empty commit ends the chain.
                onSubmit={(title) => {
                  if (title) addRow();
                }}
                maxLength={SUBTASK_TITLE_MAX_LENGTH}
                placeholder="Subtask"
                testID={`${testIDPrefix}-subtask-${row.id}`}
                style={[theme.fonts.body, { color: theme.colors.text }]}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove subtask ${row.title}`}
                testID={`${testIDPrefix}-remove-subtask-${row.id}`}
                onPress={() => removeRow(row.id)}
              >
                <Text
                  style={[
                    theme.fonts.body,
                    {
                      color: theme.colors.textSecondary,
                      paddingHorizontal: theme.space.xs,
                    },
                  ]}
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

// Not indented — a form row should look like the subtask it will become,
// not a sub-field of the row above it.
const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
