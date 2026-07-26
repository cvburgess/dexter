import { useState } from "react";

import { defaultAlarmTime } from "@/utils/alarms";
import { useTheme } from "@/utils/theme";

import { PickerSheet } from "./PickerSheet";
import { TimeField } from "./TimeField";

type TSetAlarmModalProps = {
  visible: boolean;
  /** The task's current alarm time (`"HH:MM"`/`"HH:MM:SS"`), or null if unset. */
  initialTime: string | null;
  /** Earliest selectable time (`"HH:MM"`) — set to now on the current day so a
   * same-day alarm can't be picked in the past. Omitted when the task's day is
   * in the future (any time is valid then). */
  minTime?: string;
  onCancel: () => void;
  onConfirm: (time: string) => void;
};

/**
 * A themed sheet for picking a task's alarm time. Native menus can't host a
 * live picker, so "Set alarm" opens this with the shared `TimeField`. Purely
 * presentational — it hands the chosen `"HH:MM"` back to the caller, which owns
 * authorization and persistence (DEX-48).
 */
export function SetAlarmModal({
  visible,
  initialTime,
  minTime,
  onCancel,
  onConfirm,
}: TSetAlarmModalProps) {
  const theme = useTheme();
  const [time, setTime] = useState(initialTime ?? defaultAlarmTime());

  // The sheet stays mounted while `visible` toggles, so re-seed the picker from
  // the task's current alarm (or a fresh "now"-based default) each time it opens
  // rather than keeping stale state. Resetting during render off a "was it
  // visible last render" flag is React's recommended alternative to a
  // setState-in-effect (which lint forbids).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setTime(initialTime ?? defaultAlarmTime());
  }

  return (
    <PickerSheet
      visible={visible}
      title="Set alarm"
      label="Time"
      onCancel={onCancel}
      onConfirm={() => onConfirm(time)}
    >
      <TimeField
        accentColor={theme.colors.primary}
        testID="alarm-time-field"
        min={minTime}
        value={time}
        onChange={setTime}
      />
    </PickerSheet>
  );
}
