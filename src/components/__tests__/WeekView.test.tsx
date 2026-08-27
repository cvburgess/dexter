import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { Text } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import type { WeekDayColumn } from "@/components/WeekDayColumn";
import { useTasks } from "@/hooks/useTasks";

import { WeekView } from "../WeekView";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));

// The column's own rendering has its own test; typed off the real component
// so a prop rename fails here rather than drifting silently.
const mockWeekDayColumn = ({ date }: ComponentProps<typeof WeekDayColumn>) => (
  <Text>{`column:${date.toString()}`}</Text>
);
jest.mock("@/components/WeekDayColumn", () => ({
  WeekDayColumn: (props: ComponentProps<typeof WeekDayColumn>) =>
    mockWeekDayColumn(props),
}));

jest.mock("@/components/TaskDrawer", () => {
  const { Text: RNText } = require("react-native");
  return { TaskDrawer: () => <RNText>backlog</RNText> };
});

const mockUpdateTask = jest.fn();

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;

const monday = Temporal.PlainDate.from("2026-07-13");
const thursday = "2026-07-16";

const renderWeek = () =>
  render(
    <WeekView
      monday={monday}
      onChangeWeek={jest.fn()}
      targetDate={Temporal.PlainDate.from(thursday)}
      enableHabits={false}
      today={Temporal.PlainDate.from(thursday)}
    />,
  );

/** The drop handlers the drax stub passed to a target. */
const targetProps = (screen: ReturnType<typeof render>, testID: string) =>
  screen.getByTestId(testID).props as {
    acceptsDrag: (payload: unknown) => boolean;
    onReceiveDragDrop: (event: { dragged: { payload?: unknown } }) => void;
  };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTasks.mockReturnValue([
    [task({ scheduledFor: "2026-07-13" })],
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
      updateTask: mockUpdateTask,
      updateTasks: jest.fn(),
    },
  ]);
});

describe("WeekView drag-to-schedule", () => {
  it("makes every day of the week a drop target", () => {
    const screen = renderWeek();

    for (let offset = 0; offset < 7; offset += 1) {
      const day = monday.add({ days: offset }).toString();
      expect(screen.getByTestId(`week-drop-${day}`)).toBeTruthy();
    }
  });

  it("schedules a task dropped on a column for that column's day", () => {
    const screen = renderWeek();

    targetProps(screen, `week-drop-${thursday}`).onReceiveDragDrop({
      dragged: { payload: { taskId: "task-1" } },
    });

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: thursday,
    });
  });

  it("refuses a task dropped back on the day it is already scheduled for", () => {
    const screen = renderWeek();

    expect(
      targetProps(screen, "week-drop-2026-07-13").acceptsDrag({
        taskId: "task-1",
      }),
    ).toBe(false);
  });

  // The drawer is docked outside the horizontal scroller, so it stays put and
  // reachable while the week scrolls under it.
  it("unschedules a task dropped on the docked backlog", () => {
    const screen = renderWeek();
    fireEvent.press(screen.getByLabelText("Toggle task drawer pane"));

    targetProps(screen, "backlog-drop-target").onReceiveDragDrop({
      dragged: { payload: { taskId: "task-1" } },
    });

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: null,
    });
  });

  it("has no backlog drop target until the drawer is open", () => {
    const screen = renderWeek();

    expect(screen.queryByTestId("backlog-drop-target")).toBeNull();
  });
});
