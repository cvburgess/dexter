import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import {
  TaskScheduleButton,
  type TScheduleMode,
} from "@/components/TaskScheduleButton";

const DATE = Temporal.PlainDate.from("2026-08-09");

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: DATE.toString(),
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

const onChangeSchedule = jest.fn();

const renderButton = (mode: TScheduleMode, date = DATE) =>
  render(
    <TaskScheduleButton
      date={date}
      mode={mode}
      onChangeSchedule={onChangeSchedule}
      task={task()}
    />,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TaskScheduleButton", () => {
  // The three surfaces that draw one all wrote these strings themselves before
  // DEX-148; the point of the component is that they cannot drift apart.
  describe("the label", () => {
    it.each([
      ["schedule", 'Schedule "Write report" for Sunday, Aug 9'],
      ["defer", 'Move "Write report" to Monday, Aug 10'],
      ["unschedule", 'Unschedule "Write report"'],
    ] as const)("reads %s as its intent", (mode, label) => {
      renderButton(mode);

      expect(screen.getByLabelText(label)).toBeTruthy();
    });

    // The drawer sits beside seven days on Week and DayNav pages the ritual
    // anywhere, so "tomorrow" would lie about where a task went.
    it("names the day rather than saying today or tomorrow", () => {
      renderButton("defer", Temporal.PlainDate.from("2026-01-02"));

      expect(
        screen.getByLabelText('Move "Write report" to Saturday, Jan 3'),
      ).toBeTruthy();
      expect(screen.queryByLabelText(/tomorrow/i)).toBeNull();
    });
  });

  describe("the write", () => {
    it("schedules onto the day the surface is showing", () => {
      renderButton("schedule");

      fireEvent.press(
        screen.getByLabelText('Schedule "Write report" for Sunday, Aug 9'),
      );

      expect(onChangeSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: "task-1" }),
        "2026-08-09",
      );
    });

    // The day after the one on screen, not after *today* — anchoring to
    // `Temporal.Now` would still pass every label assertion above.
    it("defers to the day after the one on screen", () => {
      renderButton("defer");

      fireEvent.press(
        screen.getByLabelText('Move "Write report" to Monday, Aug 10'),
      );

      expect(onChangeSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: "task-1" }),
        "2026-08-10",
      );
    });

    it("clears the date rather than writing one", () => {
      renderButton("unschedule");

      fireEvent.press(screen.getByLabelText('Unschedule "Write report"'));

      expect(onChangeSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: "task-1" }),
        null,
      );
    });
  });
});
