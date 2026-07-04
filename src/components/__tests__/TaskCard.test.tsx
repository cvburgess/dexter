import { render } from "@testing-library/react-native";
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
      getListById: () => undefined,
    },
  ],
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
  it("renders the title and the due date, list, and more buttons for an incomplete task", () => {
    const task = { ...baseTask, dueOn: "2026-07-05" };
    const screen = render(<TaskCard task={task} onUpdate={jest.fn()} />);

    expect(screen.getByText("Write the report")).toBeTruthy();
    // DueDateButton, ListButton, MoreButton glyphs.
    expect(screen.getByText("🚫")).toBeTruthy();
    expect(screen.getByText("⋯")).toBeTruthy();
  });

  it("hides the due date, list, and more buttons and mutes the title for a done task", () => {
    const task = { ...baseTask, status: ETaskStatus.DONE, dueOn: "2026-07-05" };
    const screen = render(<TaskCard task={task} onUpdate={jest.fn()} />);

    expect(screen.queryByText("🚫")).toBeNull();
    expect(screen.queryByText("⋯")).toBeNull();

    const title = screen.getByText("Write the report");
    const flatStyle = StyleSheet.flatten(title.props.style as TextStyle[]);
    expect(flatStyle.textDecorationLine).toBe("line-through");
  });

  it("hides the buttons for a won't-do task too", () => {
    const task = { ...baseTask, status: ETaskStatus.WONT_DO };
    const screen = render(<TaskCard task={task} onUpdate={jest.fn()} />);

    expect(screen.queryByText("⋯")).toBeNull();
  });

  it("colors the whole card background by priority", () => {
    const cardBackground = (priority: ETaskPriority) => {
      const screen = render(
        <TaskCard task={{ ...baseTask, priority }} onUpdate={jest.fn()} />,
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
      <TaskCard task={baseTask} onUpdate={jest.fn()} />,
    );
    const done = render(
      <TaskCard
        task={{ ...baseTask, status: ETaskStatus.DONE }}
        onUpdate={jest.fn()}
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
