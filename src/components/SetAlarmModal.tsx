import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { DEFAULT_ALARM_TIME } from "@/utils/alarms";
import { useTheme } from "@/utils/theme";

import { TimeField } from "./TimeField";

type TSetAlarmModalProps = {
  visible: boolean;
  /** The task's current alarm time (`"HH:MM"`/`"HH:MM:SS"`), or null if unset. */
  initialTime: string | null;
  onCancel: () => void;
  onConfirm: (time: string) => void;
};

/**
 * A themed modal for picking a task's alarm time. Native menus can't host a live
 * picker, so "Set alarm" opens this sheet with the shared `TimeField`. Purely
 * presentational — it hands the chosen `"HH:MM"` back to the caller, which owns
 * authorization and persistence (DEX-48).
 */
export function SetAlarmModal({
  visible,
  initialTime,
  onCancel,
  onConfirm,
}: TSetAlarmModalProps) {
  const theme = useTheme();
  const [time, setTime] = useState(initialTime ?? DEFAULT_ALARM_TIME);

  // The modal stays mounted while `visible` toggles, so re-seed the picker from
  // the task's current alarm each time it opens rather than keeping stale state.
  // Resetting during render off a "was it visible last render" flag is React's
  // recommended alternative to a setState-in-effect (which lint forbids).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setTime(initialTime ?? DEFAULT_ALARM_TIME);
  }

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
            Set alarm
          </Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Time
            </Text>
            <TimeField
              accentColor={theme.colors.primary}
              testID="alarm-time-field"
              value={time}
              onChange={setTime}
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
              onPress={() => onConfirm(time)}
            >
              <Text
                style={[
                  styles.buttonText,
                  styles.confirmText,
                  { color: theme.colors.primary },
                ]}
              >
                Set alarm
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
