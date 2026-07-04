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
      getListById: () => undefined,
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

  it("renders the title, due date, and list button, wrapped in the long-press priority/schedule menu, for an incomplete task", () => {
    const task = { ...baseTask, dueOn: "2026-07-05" };
    const screen = render(<TaskCard task={task} onUpdate={jest.fn()} />);

    expect(screen.getByText("Write the report")).toBeTruthy();
    expect(screen.getByText("🚫")).toBeTruthy(); // ListButton placeholder.
    expect(mockMoreMenu).toHaveBeenCalled();
  });

  it("hides the due date and list button, skips the more menu, and mutes the title for a done task", () => {
    const task = { ...baseTask, status: ETaskStatus.DONE, dueOn: "2026-07-05" };
    const screen = render(<TaskCard task={task} onUpdate={jest.fn()} />);

    expect(screen.queryByText("🚫")).toBeNull();
    expect(mockMoreMenu).not.toHaveBeenCalled();

    const title = screen.getByText("Write the report");
    const flatStyle = StyleSheet.flatten(title.props.style as TextStyle[]);
    expect(flatStyle.textDecorationLine).toBe("line-through");
  });

  it("skips the more menu for a won't-do task too", () => {
    const task = { ...baseTask, status: ETaskStatus.WONT_DO };
    render(<TaskCard task={task} onUpdate={jest.fn()} />);

    expect(mockMoreMenu).not.toHaveBeenCalled();
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
