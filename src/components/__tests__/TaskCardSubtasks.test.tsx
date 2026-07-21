import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import type { TIconMenuOption, TIconMenuSection } from "../IconMenu.types";
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

// The native menu host isn't driveable in a test renderer, so capture the
// sections each IconMenu is handed and invoke the options directly. This keeps
// the real SubtaskRow and EditableText in the tree.
type IconMenuMockProps = {
  accessibilityLabel: string;
  sections: TIconMenuSection[];
  children: ReactNode;
};
const mockIconMenu = jest.fn((props: IconMenuMockProps) => props.children);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: IconMenuMockProps) => mockIconMenu(props),
}));

type MoreMenuMockProps = {
  children: ReactNode;
  onAddSubtask?: () => void;
};
const mockMoreMenu = jest.fn((props: MoreMenuMockProps) => props.children);
jest.mock("../MoreMenu", () => ({
  MoreMenu: (props: MoreMenuMockProps) => mockMoreMenu(props),
}));

jest.mock("@/hooks/useConfirmation", () => ({
  useConfirmation: () => ({
    confirm: jest.fn(),
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
  listId: "list-1",
  priority: ETaskPriority.URGENT,
  scheduledFor: "2026-07-03",
  status: ETaskStatus.TODO,
  subtasks: [
    { id: "sub-1", title: "Draft outline", status: ETaskStatus.TODO },
    { id: "sub-2", title: "Gather figures", status: ETaskStatus.DONE },
  ],
  templateId: null,
};

const renderCard = (
  task: TTask,
  props: Partial<React.ComponentProps<typeof TaskCard>> = {},
) =>
  render(
    <TaskCard
      task={task}
      onUpdate={jest.fn()}
      onDuplicate={jest.fn()}
      onDelete={jest.fn()}
      {...props}
    />,
  );

/**
 * The options of the `index`-th menu carrying `label`, in render order — so
 * index 0 is the first subtask's menu, index 1 the second's.
 */
const menuOptions = (label: string, index: number): TIconMenuOption[] =>
  mockIconMenu.mock.calls
    .map(([props]) => props)
    .filter((props) => props.accessibilityLabel === label)
    [index].sections.flatMap((section) => section.options);

const selectOption = (label: string, index: number, id: string) => {
  const option = menuOptions(label, index).find((o) => o.id === id);
  if (!option) throw new Error(`No "${id}" option in the ${label} menu`);
  option.onSelect();
};

/**
 * Invokes "Add subtask" the way the parent's MoreMenu would. Wrapped in `act`
 * because it is a captured callback, not a fired event — the resulting state
 * update would otherwise not be flushed before the assertions run.
 */
const addSubtask = () =>
  act(() => mockMoreMenu.mock.calls[0][0].onAddSubtask?.());

describe("TaskCard subtasks", () => {
  beforeEach(() => {
    mockMoreMenu.mockClear();
    mockIconMenu.mockClear();
  });

  it("renders each subtask inside the parent's card, not as its own card", () => {
    renderCard(baseTask);

    expect(screen.getByTestId("subtask-row-sub-1")).toBeTruthy();
    expect(screen.getByTestId("subtask-row-sub-2")).toBeTruthy();
    // A subtask is never a task, so it never gets a card of its own.
    expect(screen.queryByTestId("task-card-sub-1")).toBeNull();
  });

  it("renders the card unchanged when there are no subtasks", () => {
    renderCard({ ...baseTask, subtasks: [] });

    expect(screen.getByTestId("task-card-task-1")).toBeTruthy();
    expect(screen.queryByTestId("subtask-row-sub-1")).toBeNull();
  });

  describe("inline title editing", () => {
    it("swaps the title to an input when tapped", () => {
      renderCard(baseTask);

      expect(screen.queryByTestId("subtask-title-sub-1-input")).toBeNull();
      fireEvent.press(screen.getByTestId("subtask-title-sub-1"));

      expect(screen.getByTestId("subtask-title-sub-1-input")).toBeTruthy();
    });

    it("saves an edited subtask title on blur", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      fireEvent.press(screen.getByTestId("subtask-title-sub-1"));
      const input = screen.getByTestId("subtask-title-sub-1-input");
      fireEvent.changeText(input, "Draft the outline");
      fireEvent(input, "blur");

      expect(onUpdate).toHaveBeenCalledWith({
        subtasks: [
          { id: "sub-1", title: "Draft the outline", status: ETaskStatus.TODO },
          { id: "sub-2", title: "Gather figures", status: ETaskStatus.DONE },
        ],
      });
    });

    it("reverts rather than blanking when an existing title is emptied", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      fireEvent.press(screen.getByTestId("subtask-title-sub-1"));
      const input = screen.getByTestId("subtask-title-sub-1-input");
      fireEvent.changeText(input, "   ");
      fireEvent(input, "blur");

      // Nothing is written, and the row survives — a titleless subtask would be
      // unidentifiable, which is the opposite of the just-added-row rule below.
      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByTestId("subtask-row-sub-1")).toBeTruthy();
    });

    it("edits the parent task's title too", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      fireEvent.press(screen.getByTestId("task-title-task-1"));
      const input = screen.getByTestId("task-title-task-1-input");
      fireEvent.changeText(input, "Write the annual report");
      fireEvent(input, "blur");

      expect(onUpdate).toHaveBeenCalledWith({
        title: "Write the annual report",
      });
    });

    it("reverts rather than blanking when the parent title is emptied", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      fireEvent.press(screen.getByTestId("task-title-task-1"));
      const input = screen.getByTestId("task-title-task-1-input");
      fireEvent.changeText(input, "");
      fireEvent(input, "blur");

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not write when a title is committed unchanged", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      fireEvent.press(screen.getByTestId("task-title-task-1"));
      fireEvent(screen.getByTestId("task-title-task-1-input"), "blur");

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("is disabled on a completed task", () => {
      renderCard({ ...baseTask, status: ETaskStatus.DONE });

      fireEvent.press(screen.getByTestId("task-title-task-1"));

      expect(screen.queryByTestId("task-title-task-1-input")).toBeNull();
    });

    it("commits a half-typed title when the row unmounts mid-edit", () => {
      // FlashList recycles rows as they scroll out; without this the edit
      // would be silently discarded.
      const onUpdate = jest.fn();
      const { unmount } = renderCard(baseTask, { onUpdate });

      fireEvent.press(screen.getByTestId("task-title-task-1"));
      fireEvent.changeText(
        screen.getByTestId("task-title-task-1-input"),
        "Half typed",
      );
      unmount();

      expect(onUpdate).toHaveBeenCalledWith({ title: "Half typed" });
    });
  });

  describe("adding subtasks", () => {
    it("shows an empty focused row before anything is written", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      addSubtask();

      expect(screen.getAllByTestId(/^subtask-row-/)).toHaveLength(3);
      // An empty subtask is never persisted.
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("persists the new subtask once it has a title", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      addSubtask();
      const input = screen.getByPlaceholderText("Subtask");
      fireEvent.changeText(input, "Proofread");
      fireEvent(input, "blur");

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const [{ subtasks }] = onUpdate.mock.calls[0];
      expect(subtasks).toHaveLength(3);
      expect(subtasks[2]).toEqual(
        expect.objectContaining({
          title: "Proofread",
          status: ETaskStatus.TODO,
        }),
      );
    });

    it("discards a just-added row left empty, instead of reverting it", () => {
      const onUpdate = jest.fn();
      renderCard(baseTask, { onUpdate });

      addSubtask();
      fireEvent(screen.getByPlaceholderText("Subtask"), "blur");

      expect(screen.getAllByTestId(/^subtask-row-/)).toHaveLength(2);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("chains another empty row when return commits a non-empty title", () => {
      renderCard(baseTask, { onUpdate: jest.fn() });

      addSubtask();
      const input = screen.getByPlaceholderText("Subtask");
      fireEvent.changeText(input, "Proofread");
      fireEvent(input, "submitEditing");

      expect(screen.getAllByTestId(/^subtask-row-/)).toHaveLength(4);
    });

    it("ends the chain when return commits an empty row", () => {
      renderCard(baseTask, { onUpdate: jest.fn() });

      addSubtask();
      fireEvent(screen.getByPlaceholderText("Subtask"), "submitEditing");

      expect(screen.getAllByTestId(/^subtask-row-/)).toHaveLength(2);
    });
  });

  it("promotes a subtask to a task and removes it from the parent", () => {
    const onUpdate = jest.fn();
    const onPromoteSubtask = jest.fn();
    renderCard(baseTask, { onUpdate, onPromoteSubtask });

    selectOption("Subtask actions", 0, "promote");

    expect(onPromoteSubtask).toHaveBeenCalledWith({
      title: "Draft outline",
      status: ETaskStatus.TODO,
      listId: "list-1",
      goalId: null,
      dueOn: null,
      priority: ETaskPriority.URGENT,
      scheduledFor: "2026-07-03",
      alarmTime: null,
    });
    expect(onUpdate).toHaveBeenCalledWith({
      subtasks: [
        { id: "sub-2", title: "Gather figures", status: ETaskStatus.DONE },
      ],
    });
  });

  it("deletes only the chosen subtask", () => {
    const onUpdate = jest.fn();
    renderCard(baseTask, { onUpdate });

    selectOption("Subtask actions", 1, "delete");

    expect(onUpdate).toHaveBeenCalledWith({
      subtasks: [
        { id: "sub-1", title: "Draft outline", status: ETaskStatus.TODO },
      ],
    });
  });

  it("writes the whole array when one subtask's status changes", () => {
    const onUpdate = jest.fn();
    renderCard(baseTask, { onUpdate });

    selectOption("Subtask status", 0, "done");

    expect(onUpdate).toHaveBeenCalledWith({
      subtasks: [
        { id: "sub-1", title: "Draft outline", status: ETaskStatus.DONE },
        { id: "sub-2", title: "Gather figures", status: ETaskStatus.DONE },
      ],
    });
  });
});
