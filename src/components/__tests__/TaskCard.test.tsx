import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import { TaskCard } from "../TaskCard";

jest.mock("@/hooks/useLists", () => ({
  useLists: () => [
    [],
    {
      createList: jest.fn(),
      deleteList: jest.fn(),
      updateList: jest.fn(),
      getListById: (id: string | null) =>
        id === "list-1"
          ? {
              id: "list-1",
              title: "Home",
              emoji: "🏠",
              isArchived: false,
              createdAt: "2026-01-01T00:00:00Z",
            }
          : undefined,
    },
  ],
}));

type MoreMenuMockProps = {
  children: ReactNode;
  // TaskCard passes an async handler here (it may await a confirmation).
  onChangeSchedule: (scheduledFor: string | null) => Promise<void>;
};
const mockMoreMenu = jest.fn((props: MoreMenuMockProps) => props.children);
jest.mock("../MoreMenu", () => ({
  MoreMenu: (props: Parameters<typeof mockMoreMenu>[0]) => mockMoreMenu(props),
}));

// A subset of ConfirmOptions the schedule handler passes; enough to simulate
// which button the user taps in the multi-action reschedule prompt.
type ConfirmArg = {
  actions?: { label: string; role?: string; onPress?: () => void }[];
};
const mockConfirm = jest.fn<Promise<boolean>, [ConfirmArg]>();

/** Make the mocked confirm resolve `false` (Cancel / dismiss). */
const cancelPrompt = () => mockConfirm.mockResolvedValue(false);
/** Make the mocked confirm accept a plain confirm (no custom actions). */
const acceptPrompt = () => mockConfirm.mockResolvedValue(true);
/** Make the mocked confirm "tap" the action with the given label. */
const tapAction = (label: string) =>
  mockConfirm.mockImplementation((options) => {
    const action = options.actions?.find((a) => a.label === label);
    action?.onPress?.();
    return Promise.resolve(!!action && action.role !== "cancel");
  });

jest.mock("@/hooks/useConfirmation", () => ({
  useConfirmation: () => ({
    confirm: mockConfirm,
    confirmationProps: {
      visible: false,
      title: "",
      message: "",
      actions: [],
      onClose: jest.fn(),
    },
  }),
}));

const baseTask: TTask = {
  id: "task-1",
  alarmTime: null,
  title: "Write the report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: "2026-07-03",
  status: ETaskStatus.TODO,
  templateId: null,
};

describe("TaskCard", () => {
  beforeEach(() => {
    mockMoreMenu.mockClear();
    mockConfirm.mockReset();
  });

  const scheduleVia = (task: TTask, onUpdate: jest.Mock) => {
    render(
      <TaskCard
        task={task}
        onUpdate={onUpdate}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    return mockMoreMenu.mock.calls[0][0].onChangeSchedule;
  };

  const alarmTask = {
    ...baseTask,
    alarmTime: "17:30",
    scheduledFor: "2026-07-03",
  };

  it("reschedules directly, without confirming, when the task has no alarm", async () => {
    const onUpdate = jest.fn();
    const onChangeSchedule = scheduleVia(baseTask, onUpdate);

    await onChangeSchedule("2026-07-20");

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith({ scheduledFor: "2026-07-20" });
  });

  it("offers to keep the alarm on a reschedule, moving it to the new day", async () => {
    tapAction("Keep alarm");
    const onUpdate = jest.fn();
    const onChangeSchedule = scheduleVia(alarmTask, onUpdate);

    await onChangeSchedule("2026-07-20");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    // Alarm time is untouched; only the date moves, so the reconcile re-fires it.
    expect(onUpdate).toHaveBeenCalledWith({ scheduledFor: "2026-07-20" });
  });

  it("offers to unset the alarm on a reschedule, clearing it alongside the date", async () => {
    tapAction("Unset alarm");
    const onUpdate = jest.fn();
    const onChangeSchedule = scheduleVia(alarmTask, onUpdate);

    await onChangeSchedule("2026-07-20");

    expect(onUpdate).toHaveBeenCalledWith({
      scheduledFor: "2026-07-20",
      alarmTime: null,
    });
  });

  it("leaves the task untouched when the reschedule prompt is cancelled", async () => {
    tapAction("Cancel");
    const onUpdate = jest.fn();
    const onChangeSchedule = scheduleVia(alarmTask, onUpdate);

    await onChangeSchedule("2026-07-20");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("unsets the alarm when unscheduling a task that has one (no keep option)", async () => {
    acceptPrompt();
    const onUpdate = jest.fn();
    const onChangeSchedule = scheduleVia(alarmTask, onUpdate);

    await onChangeSchedule(null);

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      scheduledFor: null,
      alarmTime: null,
    });
  });

  it("leaves the task untouched when the unschedule prompt is declined", async () => {
    cancelPrompt();
    const onUpdate = jest.fn();
    const onChangeSchedule = scheduleVia(alarmTask, onUpdate);

    await onChangeSchedule(null);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not prompt or clear the alarm when re-selecting the current day", async () => {
    const onUpdate = jest.fn();
    const onChangeSchedule = scheduleVia(alarmTask, onUpdate);

    await onChangeSchedule("2026-07-03");

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith({ scheduledFor: "2026-07-03" });
  });

  it("renders the title and due date, wrapped in the long-press menu, with no list button when no list is chosen", () => {
    const task = { ...baseTask, dueOn: "2026-07-05" };
    const screen = render(
      <TaskCard
        task={task}
        onUpdate={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText("Write the report")).toBeTruthy();
    expect(screen.queryByLabelText("List")).toBeNull();
    expect(mockMoreMenu).toHaveBeenCalled();
  });

  it("forwards duplicate and delete handlers to the more menu", () => {
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    render(
      <TaskCard
        task={baseTask}
        onUpdate={jest.fn()}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />,
    );

    expect(mockMoreMenu).toHaveBeenCalledWith(
      expect.objectContaining({ onDuplicate, onDelete }),
    );
  });

  it("shows the list button when the task has a list", () => {
    const task = { ...baseTask, listId: "list-1" };
    const screen = render(
      <TaskCard
        task={task}
        onUpdate={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText("🏠")).toBeTruthy();
  });

  it("hides the due date and list button, skips the more menu, and mutes the title for a done task", () => {
    const task = {
      ...baseTask,
      status: ETaskStatus.DONE,
      dueOn: "2026-07-05",
      listId: "list-1",
    };
    const screen = render(
      <TaskCard
        task={task}
        onUpdate={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.queryByText("🏠")).toBeNull();
    expect(mockMoreMenu).not.toHaveBeenCalled();

    const title = screen.getByText("Write the report");
    const flatStyle = StyleSheet.flatten(title.props.style as TextStyle[]);
    expect(flatStyle.textDecorationLine).toBe("line-through");
  });

  it("skips the more menu for a won't-do task too", () => {
    const task = { ...baseTask, status: ETaskStatus.WONT_DO };
    render(
      <TaskCard
        task={task}
        onUpdate={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(mockMoreMenu).not.toHaveBeenCalled();
  });

  it.each([
    ["completed", ETaskStatus.DONE],
    ["incomplete", ETaskStatus.TODO],
  ])(
    "stretches a %s card to full width with a height floor so async native sizing can't collapse or balloon it",
    (_label, status) => {
      // A completed card's only height-defining child is the StatusButton's
      // native menu host, which sizes asynchronously — without alignSelf +
      // minHeight the row can render blank or oversized and overlap others.
      const screen = render(
        <TaskCard
          task={{ ...baseTask, status }}
          onUpdate={jest.fn()}
          onDuplicate={jest.fn()}
          onDelete={jest.fn()}
        />,
      );

      const card = screen.getByTestId("task-card-task-1");
      const flatStyle = StyleSheet.flatten(card.props.style as ViewStyle[]);
      expect(flatStyle.alignSelf).toBe("stretch");
      expect(flatStyle.minHeight).toBe(64);
    },
  );

  it("colors the whole card background by priority", () => {
    const cardBackground = (priority: ETaskPriority) => {
      const screen = render(
        <TaskCard
          task={{ ...baseTask, priority }}
          onUpdate={jest.fn()}
          onDuplicate={jest.fn()}
          onDelete={jest.fn()}
        />,
      );
      const card = screen.getByTestId("task-card-task-1");
      return StyleSheet.flatten(card.props.style as ViewStyle[])
        .backgroundColor;
    };

    expect(cardBackground(ETaskPriority.URGENT)).not.toEqual(
      cardBackground(ETaskPriority.NEITHER),
    );
  });

  it("fades the card to a faint tint and mutes the text when done", () => {
    const incomplete = render(
      <TaskCard
        task={baseTask}
        onUpdate={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    const done = render(
      <TaskCard
        task={{ ...baseTask, status: ETaskStatus.DONE }}
        onUpdate={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    const backgroundAlpha = (screen: ReturnType<typeof render>) => {
      const card = screen.getByTestId("task-card-task-1");
      const background = StyleSheet.flatten(card.props.style as ViewStyle[])
        .backgroundColor as string;
      return Number(background.match(/[\d.]+(?=\)$)/)?.[0]);
    };

    expect(backgroundAlpha(done)).toBeLessThan(backgroundAlpha(incomplete));
  });
});
