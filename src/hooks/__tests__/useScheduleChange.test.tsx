import { act, renderHook } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import { useScheduleChange } from "../useScheduleChange";

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: "2026-07-16",
  status: ETaskStatus.TODO,
  templateId: null,
  title: "Write report",
  ...overrides,
});

/** Renders the hook with a spy updater, mirroring how TaskCard and the large-screen drop target wire it up. */
const setup = () => {
  const onUpdate = jest.fn();
  const { result } = renderHook(() => useScheduleChange(onUpdate));
  return { onUpdate, result };
};

/** Presses a button in the currently-open confirmation by its label. */
const press = (
  result: { current: ReturnType<typeof useScheduleChange> },
  label: string,
) => {
  const action = result.current.confirmationProps.actions?.find(
    (candidate) => candidate.label === label,
  );
  if (!action) throw new Error(`No confirmation action labelled "${label}"`);
  return act(async () => {
    await action.onPress?.();
  });
};

describe("useScheduleChange", () => {
  it("reschedules directly when the task has no alarm", async () => {
    const { onUpdate, result } = setup();

    await act(async () => {
      await result.current.changeSchedule(task(), "2026-07-20");
    });

    expect(onUpdate).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: "2026-07-20",
    });
    expect(result.current.confirmationProps.visible).toBe(false);
  });

  // A task whose `alarmTime` is absent rather than null (e.g. a DB missing the
  // column) must still count as "no alarm" — the hook uses `== null` for this.
  it("reschedules directly when alarmTime is undefined rather than null", async () => {
    const { onUpdate, result } = setup();
    const withoutColumn = task();
    delete (withoutColumn as Partial<TTask>).alarmTime;

    await act(async () => {
      await result.current.changeSchedule(withoutColumn, "2026-07-20");
    });

    expect(onUpdate).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: "2026-07-20",
    });
  });

  it("does not prompt when the schedule is unchanged, even with an alarm set", async () => {
    const { onUpdate, result } = setup();

    await act(async () => {
      await result.current.changeSchedule(
        task({ alarmTime: "09:00:00", scheduledFor: "2026-07-16" }),
        "2026-07-16",
      );
    });

    expect(onUpdate).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: "2026-07-16",
    });
    expect(result.current.confirmationProps.visible).toBe(false);
  });

  describe("unscheduling a task with an alarm", () => {
    it("clears the alarm alongside the date once confirmed", async () => {
      const { onUpdate, result } = setup();

      act(() => {
        void result.current.changeSchedule(
          task({ alarmTime: "09:00:00" }),
          null,
        );
      });
      expect(result.current.confirmationProps.visible).toBe(true);
      expect(result.current.confirmationProps.title).toBe("Unschedule task?");

      await press(result, "Unschedule");

      expect(onUpdate).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: null,
        alarmTime: null,
      });
    });

    it("leaves the task alone when cancelled", async () => {
      const { onUpdate, result } = setup();

      act(() => {
        void result.current.changeSchedule(
          task({ alarmTime: "09:00:00" }),
          null,
        );
      });
      await press(result, "Cancel");

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("moving a task with an alarm to another day", () => {
    const move = () => {
      const { onUpdate, result } = setup();
      act(() => {
        void result.current.changeSchedule(
          task({ alarmTime: "09:00:00" }),
          "2026-07-20",
        );
      });
      return { onUpdate, result };
    };

    it("carries the alarm to the new day", async () => {
      const { onUpdate, result } = move();
      expect(result.current.confirmationProps.title).toBe("Reschedule task?");

      await press(result, "Keep alarm");

      expect(onUpdate).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: "2026-07-20",
      });
    });

    it("drops the alarm when asked to", async () => {
      const { onUpdate, result } = move();

      await press(result, "Unset alarm");

      expect(onUpdate).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: "2026-07-20",
        alarmTime: null,
      });
    });

    it("leaves the task alone when cancelled", async () => {
      const { onUpdate, result } = move();

      await press(result, "Cancel");

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });
});
