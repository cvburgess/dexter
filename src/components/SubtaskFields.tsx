import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";
import { makeSubtaskId } from "@/utils/subtasks";

import { EditableText } from "./EditableText";
import { FormRow } from "./FormRow";

/**
 * The minimum a row needs to be edited here. Generic over the rest so this
 * serves both a task's `TSubtask` (which carries a status) and a template's
 * `TTemplateSubtask` (which doesn't) without either widening to the other.
 */
type TEditableRow = { id: string; title: string };

type TSubtaskFieldsProps<S extends TEditableRow> = {
  value: S[];
  onChange: (subtasks: S[]) => void;
  /** Builds a new empty row; supplies whatever fields the caller's shape adds. */
  makeRow: (id: string) => S;
  testIDPrefix: string;
};

/**
 * The "Add subtask" affordance plus the checklist rows, for the two *form*
 * surfaces — creating a task and editing a repeat template. Both were
 * previously carrying an identical copy of this and had already drifted apart.
 *
 * Distinct from `SubtaskRow`, which is the in-card presentation: rows here have
 * no status to toggle and no per-row menu, because nothing has been saved yet —
 * a row is removed by emptying its title, not by a delete action.
 */
export function SubtaskFields<S extends TEditableRow>({
  value,
  onChange,
  makeRow,
  testIDPrefix,
}: TSubtaskFieldsProps<S>) {
  const theme = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const addRow = () => {
    const row = makeRow(makeSubtaskId());
    apply([...latest.current, row]);
    setEditingId(row.id);
  };

  const commitTitle = (id: string, title: string) => {
    setEditingId(null);
    apply(
      title === ""
        ? // Nothing here has been saved yet, so an emptied row is discarded —
          // there is no stored title to revert to. (In-card rows revert
          // instead; see `TaskCard`.)
          latest.current.filter((row) => row.id !== id)
        : latest.current.map((row) =>
            row.id === id ? { ...row, title } : row,
          ),
    );
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
                onStartEdit={() => setEditingId(row.id)}
                onCommit={(title) => commitTitle(row.id, title)}
                // Return chains the next row; an empty commit ends the chain.
                onSubmit={(title) => {
                  if (title) addRow();
                }}
                placeholder="Subtask"
                testID={`${testIDPrefix}-subtask-${row.id}`}
                style={[styles.title, { color: theme.colors.text }]}
              />
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
});
