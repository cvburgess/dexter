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

const mockMoreMenu = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("../MoreMenu", () => ({
  MoreMenu: (props: Parameters<typeof mockMoreMenu>[0]) => mockMoreMenu(props),
}));

const baseTask: TTask = {
  id: "task-1",
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
