import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { dateToPlainDateISO, plainDateISOToDate } from "@/utils/plainDate";
import { useTheme } from "@/utils/theme";

import { DateField } from "./DateField";

/** The two dates a task carries: the day it's planned for, and the day it's due. */
export type TTaskDateField = "schedule" | "deadline";

type TSetDateModalProps = {
  /** Names the date being picked: drives the copy and the testID. */
  field: TTaskDateField;
  visible: boolean;
  /** The task's current value for that field (`"YYYY-MM-DD"`), or null if unset. */
  initialDate: string | null;
  onCancel: () => void;
  onConfirm: (date: string) => void;
};

/**
 * A themed modal for picking one of a task's dates. Native menus can't host a
 * live picker — and no `DateField` variant can be opened imperatively from a
 * button either — so the menu's "Pick a date…" opens this sheet with the shared
 * `DateField` rendered inline. The same arrangement `SetAlarmModal` uses for
 * `TimeField`.
 *
 * Purely presentational: it hands the chosen `"YYYY-MM-DD"` back to the caller,
 * which owns persistence (and, for the schedule, the alarm rules that go with
 * it). Clearing is the menu's job, so there is no Clear button here (DEX-87).
 *
 * On **web** the calendar still paints above this sheet: `DateField.web`
 * portals its popover to `document.body` at `zIndex: 9999`, while
 * react-native-web's `Modal` is a `position: fixed` sibling with no z-index, so
 * the popover wins the stacking order. Picking a day works, but because that
 * popover is outside the modal's subtree, RNW's focus trap pulls focus back on
 * every `focus` event — so the calendar can't be driven by keyboard here (a
 * click still lands, since click doesn't follow focus).
 */
export function SetDateModal({
  field,
  visible,
  initialDate,
  onCancel,
  onConfirm,
}: TSetDateModalProps) {
  const theme = useTheme();
  // An unset field starts on today, matching the create form's "Add …" button.
  const seed = () => initialDate ?? Temporal.Now.plainDateISO().toString();
  const [date, setDate] = useState(seed);

  // The modal stays mounted while `visible` toggles, so re-seed the picker from
  // the task's current date each time it opens rather than keeping stale state.
  // Resetting during render off a "was it visible last render" flag is React's
  // recommended alternative to a setState-in-effect (which lint forbids).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDate(seed());
  }

  const title = `Set ${field}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.borderRadius,
              gap: theme.spacing,
            },
          ]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {title}
          </Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Date
            </Text>
            <DateField
              accentColor={theme.colors.primary}
              testID={`${field}-date-field`}
              value={plainDateISOToDate(date)}
              onChange={(next) => setDate(dateToPlainDateISO(next))}
            />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, { marginRight: theme.spacing }]}
              onPress={onCancel}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.button}
              onPress={() => onConfirm(date)}
            >
              <Text
                style={[
                  styles.buttonText,
                  styles.confirmText,
                  { color: theme.colors.primary },
                ]}
              >
                {title}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    padding: 20,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.25)",
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 40,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  buttonText: {
    fontSize: 16,
  },
  confirmText: {
    fontWeight: "600",
  },
});
