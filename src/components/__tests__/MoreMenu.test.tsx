import { Temporal } from "@js-temporal/polyfill";
import { render, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { PRIORITY_OPTIONS } from "@/components/PriorityControl";
import { useTheme } from "@/utils/theme";
import { weekStartEnd } from "@/utils/weekStartEnd";

import type { TIconMenuSection } from "../IconMenu.types";
import {
  getOtherSections,
  getPrioritySections,
  getScheduleSections,
  getTaskActionSections,
  MoreMenu,
  type TTemplateMenuAction,
} from "../MoreMenu";

const theme = renderHook(() => useTheme()).result.current;

const makeTask = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "Task row",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.NEITHER,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  ...overrides,
});

const mockIconMenu = jest.fn(
  (props: { children: ReactNode; sections: TIconMenuSection[] }) =>
    props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

const mockGetTemplateById = jest.fn(() => undefined);
const mockCreateTemplate = jest.fn();
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: () => [
    [],
    {
      createTemplate: mockCreateTemplate,
      deleteTemplate: jest.fn(),
      getTemplateById: mockGetTemplateById,
      isLoading: false,
      updateTemplate: jest.fn(),
    },
  ],
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

/** Renders the menu with the props every test would otherwise restate. */
const renderMenu = (task: TTask = makeTask(), props = {}) =>
  render(
    <MoreMenu
      task={task}
      onChangePriority={jest.fn()}
      onChangeSchedule={jest.fn()}
      onDuplicate={jest.fn()}
      onDelete={jest.fn()}
      {...props}
    >
      <Text>Task row</Text>
    </MoreMenu>,
  );

const renderedSections = () => mockIconMenu.mock.calls[0][0].sections;

const optionById = (id: string) =>
  renderedSections()
    .flatMap((section) => section.options)
    .find((option) => option.id === id);

// The untitled inline groups: Edit task, the subtask edit, then Duplicate /
// the template rows / Delete.
const inlineOptionTitles = () =>
  renderedSections()
    .filter((section) => !section.isSubmenu)
    .map((section) => section.options.map((option) => option.title));

describe("MoreMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTemplateById.mockReturnValue(undefined);
  });

  it("opens on long-press with no menu title, wrapping its children", () => {
    const screen = renderMenu();

    expect(screen.getByText("Task row")).toBeTruthy();
    expect(mockIconMenu).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "longPress" }),
    );
    expect(mockIconMenu.mock.calls[0][0]).not.toHaveProperty("menuTitle");
  });

  // The point of DEX-98: List, Deadline, and the alarm are gone, and every
  // field they used to reach now lives behind the one Edit task row.
  it("puts Edit task first and drops the List, Deadline and alarm rows", () => {
    renderMenu(makeTask({ alarmTime: "08:00", listId: "list-home" }), {
      onAddSubtask: jest.fn(),
    });

    const titles = renderedSections().map((section) => section.title);
    expect(titles).toEqual([
      undefined,
      "Priority",
      "Schedule",
      undefined,
      undefined,
    ]);
    expect(titles).not.toContain("List");
    expect(titles).not.toContain("Deadline");

    const allTitles = renderedSections().flatMap((section) =>
      section.options.map((option) => option.title),
    );
    expect(allTitles[0]).toBe("Edit task");
    expect(allTitles).not.toContain("Set alarm");
    expect(allTitles).not.toContain("Unset alarm");
  });

  it("marks Priority and Schedule as submenus and the rest inline", () => {
    renderMenu(makeTask(), { onAddSubtask: jest.fn() });

    expect(
      renderedSections().map((section) => Boolean(section.isSubmenu)),
    ).toEqual([false, true, true, false, false]);
    expect(
      renderedSections().map((section) =>
        typeof section.icon === "object" ? section.icon.ios : section.icon,
      ),
    ).toEqual([undefined, "exclamationmark", "calendar", undefined, undefined]);
  });

  // Edit task through Add subtask read as one unruled group; only the
  // duplicate/repeat/delete actions are set apart. The Edit task row carries
  // the flag too: `IconMenu.native` draws an unmarked plain section as its own
  // separated inline group, which would rule it off from the shortcuts below.
  it("rules off only the final action group", () => {
    renderMenu(makeTask(), { onAddSubtask: jest.fn() });

    expect(
      renderedSections().map((section) => Boolean(section.hideDivider)),
    ).toEqual([true, true, true, true, false]);
  });

  it("opens the edit modal from the Edit task row", () => {
    renderMenu();

    optionById("edit-task")?.onSelect();

    // No `withAnchor`: the route is on the root `(app)` stack, which already
    // has the tab navigator beneath it.
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/edit-task/[id]",
      params: { id: "task-1" },
    });
  });

  // "Pick a date…" used to open a sheet that could only set the schedule. It
  // now opens the form that owns every date the task has (DEX-98).
  it("opens the edit modal from 'Pick a date…' rather than a picker sheet", () => {
    renderMenu();

    optionById("schedule-pick-date")?.onSelect();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/edit-task/[id]",
      params: { id: "task-1" },
    });
  });

  it("opens the edit modal from the current custom-date row", () => {
    const farOut = Temporal.Now.plainDateISO().add({ days: 60 }).toString();
    renderMenu(makeTask({ scheduledFor: farOut }));

    renderedSections()
      .find((section) => section.title === "Schedule")
      ?.options.find((option) => option.isSelected)
      ?.onSelect();

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/edit-task/[id]",
      params: { id: "task-1" },
    });
  });

  // `IconMenu.native` flattens every section into one id -> option map and
  // dispatches the system menu's press by id, so a duplicate silently routes one
  // row's tap to another's handler.
  it("gives every option a menu-wide unique id", () => {
    renderMenu(
      makeTask({
        scheduledFor: Temporal.Now.plainDateISO().toString(),
        dueOn: Temporal.Now.plainDateISO().toString(),
      }),
      { onAddSubtask: jest.fn() },
    );

    const ids = renderedSections().flatMap((section) =>
      section.options.map((option) => option.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  // Only a task that belongs to no template can make one, and it can make
  // either kind — so this is the one case that shows two template rows.
  it("offers both Repeat and Save as template when the task has no template", () => {
    renderMenu(makeTask({ templateId: null }));

    expect(inlineOptionTitles()).toEqual([
      ["Edit task"],
      ["Duplicate", "Repeat", "Save as template", "Delete"],
    ]);
  });

  // A task that already belongs to a template has nothing to choose: offering
  // "Save as template" here would let it be saved a second time, as an
  // orphaned row.
  it("offers only 'Edit repeat schedule' when a scheduled template is linked", () => {
    mockGetTemplateById.mockReturnValue({
      id: "template-1",
      schedule: "0 0 * * *",
    } as never);

    renderMenu(makeTask({ templateId: "template-1" }));

    expect(inlineOptionTitles()).toEqual([
      ["Edit task"],
      ["Duplicate", "Edit repeat schedule", "Delete"],
    ]);
  });

  // The linked row carries no schedule, so it is a saved template rather than a
  // repeat — the same single edit item, under the noun that fits (DEX-65).
  it("offers only 'Edit template' when the linked template has no schedule", () => {
    mockGetTemplateById.mockReturnValue({
      id: "template-1",
      schedule: null,
    } as never);

    renderMenu(makeTask({ templateId: "template-1" }));

    expect(inlineOptionTitles().at(-1)).toEqual([
      "Duplicate",
      "Edit template",
      "Delete",
    ]);
  });

  // An unresolved lookup means the templates query hasn't landed, not that the
  // row is scheduleless — the repeat wording is the safe fallback, and either
  // way the item opens the same editor.
  it("keeps the repeat wording while the linked template is still loading", () => {
    mockGetTemplateById.mockReturnValue(undefined);

    renderMenu(makeTask({ templateId: "template-1" }));

    expect(inlineOptionTitles().at(-1)).toEqual([
      "Duplicate",
      "Edit repeat schedule",
      "Delete",
    ]);
  });

  // Save as template opens a draft rather than writing a row, so ✕ leaves
  // nothing behind — the link to the source task is made by the editor's ✓.
  it("opens an unsaved draft seeded from the task, writing nothing yet", () => {
    renderMenu(makeTask({ templateId: null }));

    optionById("save-as-template")?.onSelect();

    // Nothing is stored until the editor's ✓, so ✕ leaves no orphan row — and
    // navigating synchronously means two of these in a row can't have the
    // first's late callback push its editor over the second's.
    expect(mockCreateTemplate).not.toHaveBeenCalled();
    // `withAnchor` brings the tasks stack's anchor — its list — along when this
    // push first enters that navigator, so the modal has something to render
    // over and close back to rather than an empty black pane.
    expect(mockPush).toHaveBeenCalledWith(
      {
        pathname: "/settings/tasks/[id]",
        params: { id: "new", fromTask: "task-1" },
      },
      { withAnchor: true },
    );
  });

  // Repeat writes nothing up front either — it opens the same draft, differing
  // only in the cadence it starts on.
  it("opens a repeating draft from Repeat, writing nothing yet", () => {
    renderMenu(makeTask({ templateId: null }));

    optionById("repeat")?.onSelect();

    expect(mockCreateTemplate).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(
      {
        pathname: "/settings/tasks/[id]",
        params: { id: "new", fromTask: "task-1", repeats: "1" },
      },
      { withAnchor: true },
    );
  });

  // An existing template is edited, never re-drafted, or the task would end up
  // with a second one. Both kinds open the same editor at the same route.
  it.each([
    ["0 0 * * *", "edit-repeat"],
    [null, "edit-template"],
  ])(
    "opens the linked template directly (schedule %p, via %s)",
    (schedule, optionId_) => {
      mockGetTemplateById.mockReturnValue({
        id: "template-1",
        schedule,
      } as never);

      renderMenu(makeTask({ templateId: "template-1" }));

      optionById(optionId_)?.onSelect();

      expect(mockCreateTemplate).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(
        { pathname: "/settings/tasks/[id]", params: { id: "template-1" } },
        { withAnchor: true },
      );
    },
  );
});

describe("getOtherSections", () => {
  const unlinked: TTemplateMenuAction = {
    kind: "unlinked",
    onRepeat: jest.fn(),
    onSaveAsTemplate: jest.fn(),
  };

  it("offers both template rows between Duplicate and Delete when unlinked, with Delete destructive", () => {
    const [section] = getOtherSections({
      onDuplicate: jest.fn(),
      template: unlinked,
      onDelete: jest.fn(),
    });

    expect(section.title).toBeUndefined();
    expect(section.isSubmenu).toBeUndefined();
    // Save as template sits directly under Repeat: both create a template row,
    // and they differ only in whether it carries a schedule.
    expect(section.options.map((option) => option.title)).toEqual([
      "Duplicate",
      "Repeat",
      "Save as template",
      "Delete",
    ]);

    const deleteOption = section.options.find(
      (option) => option.title === "Delete",
    );
    expect(deleteOption?.isDestructive).toBe(true);

    const duplicateOption = section.options.find(
      (option) => option.title === "Duplicate",
    );
    expect(duplicateOption?.isDestructive).toBeFalsy();
  });

  // One item, not two: the template exists, so there is nothing to create.
  it.each([
    ["repeat" as const, "Edit repeat schedule", "edit-repeat"],
    ["template" as const, "Edit template", "edit-template"],
  ])("offers one edit row for a linked %s", (kind, title, id) => {
    const onEdit = jest.fn();
    const [section] = getOtherSections({
      onDuplicate: jest.fn(),
      template: { kind, onEdit },
      onDelete: jest.fn(),
    });

    expect(section.options.map((option) => option.title)).toEqual([
      "Duplicate",
      title,
      "Delete",
    ]);

    // Ids stay distinct per kind — `IconMenu.native` dispatches by id.
    const editOption = section.options.find((option) => option.id === id);
    editOption?.onSelect();
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls the action handlers when their options are selected", () => {
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    const onRepeat = jest.fn();
    const onSaveAsTemplate = jest.fn();
    const [section] = getOtherSections({
      onDuplicate,
      template: { kind: "unlinked", onRepeat, onSaveAsTemplate },
      onDelete,
    });

    section.options.find((option) => option.title === "Duplicate")?.onSelect();
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    section.options.find((option) => option.title === "Repeat")?.onSelect();
    expect(onRepeat).toHaveBeenCalledTimes(1);

    section.options
      .find((option) => option.title === "Save as template")
      ?.onSelect();
    expect(onSaveAsTemplate).toHaveBeenCalledTimes(1);

    section.options.find((option) => option.title === "Delete")?.onSelect();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("getTaskActionSections", () => {
  it("offers the subtask action as one untitled inline group", () => {
    const onAddSubtask = jest.fn();
    const [section] = getTaskActionSections(onAddSubtask);

    expect(section.title).toBeUndefined();
    // A directly-tappable action, not a submenu.
    expect(section.isSubmenu).toBeUndefined();
    expect(section.options.map((option) => option.title)).toEqual([
      "Add subtask",
    ]);

    section.options[0].onSelect();
    expect(onAddSubtask).toHaveBeenCalledTimes(1);
  });

  // Nothing to act on: a card with no checklist affordance should not open a
  // menu with an empty divider in it.
  it("drops the group entirely when no subtask handler is given", () => {
    expect(getTaskActionSections()).toEqual([]);
  });
});

describe("getPrioritySections", () => {
  it("lists priorities in shorthand token order (! → !!!!)", () => {
    const [section] = getPrioritySections(
      ETaskPriority.NEITHER,
      jest.fn(),
      theme,
    );

    expect(section.title).toBe("Priority");
    expect(section.isSubmenu).toBe(true);
    expect(section.options.map((option) => option.title)).toEqual([
      "Urgent",
      "Important",
      "Important & Urgent",
      "Neither",
    ]);
    expect(section.options.map((option) => option.icon)).toEqual(
      PRIORITY_OPTIONS.map((option) => option.icon),
    );
    expect(section.options.map((option) => option.iconColor)).toEqual([
      theme.colors.priority[ETaskPriority.URGENT],
      theme.colors.priority[ETaskPriority.IMPORTANT],
      theme.colors.priority[ETaskPriority.IMPORTANT_AND_URGENT],
      theme.colors.text,
    ]);
    expect(section.options.map((option) => option.isSelected)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("calls onChangePriority with the selected priority", () => {
    const onChangePriority = jest.fn();
    const [section] = getPrioritySections(
      ETaskPriority.NEITHER,
      onChangePriority,
      theme,
    );

    section.options.find((option) => option.title === "Urgent")?.onSelect();

    expect(onChangePriority).toHaveBeenCalledWith(ETaskPriority.URGENT);
  });
});

describe("getScheduleSections", () => {
  const today = Temporal.Now.plainDateISO();
  const tomorrow = today.add({ days: 1 });
  const { monday: nextMonday } = weekStartEnd(1);
  const nextWeekOptionExpected = tomorrow.toString() !== nextMonday.toString();

  it("offers Today and Tomorrow with no Unschedule when nothing is scheduled", () => {
    const [section] = getScheduleSections(null, jest.fn(), jest.fn());

    expect(section.title).toBe("Schedule");
    expect(section.isSubmenu).toBe(true);
    const titles = section.options.map((option) => option.title);
    expect(titles).toEqual(expect.arrayContaining(["Today", "Tomorrow"]));
    expect(titles).not.toContain("Unschedule");
  });

  it("selects Today and offers Unschedule when scheduled for today", () => {
    const [section] = getScheduleSections(
      today.toString(),
      jest.fn(),
      jest.fn(),
    );

    const todayOption = section.options.find(
      (option) => option.title === "Today",
    );
    expect(todayOption?.isSelected).toBe(true);
    expect(section.options.map((option) => option.title)).toContain(
      "Unschedule",
    );
  });

  it("hides Next Week when already scheduled within the next week", () => {
    const [section] = getScheduleSections(
      nextMonday.toString(),
      jest.fn(),
      jest.fn(),
    );

    expect(section.options.map((option) => option.title)).not.toContain(
      "Next Week",
    );
  });

  it("shows a selected custom-date option for a date scheduled beyond next week", () => {
    const farOut = today.add({ days: 60 }).toString();
    const [section] = getScheduleSections(farOut, jest.fn(), jest.fn());

    const titles = section.options.map((option) => option.title);
    if (nextWeekOptionExpected) expect(titles).toContain("Next Week");

    const customOption = section.options.find((option) => option.isSelected);
    expect(customOption).toBeDefined();
    expect(customOption?.title).not.toBe("Today");
    expect(customOption?.title).not.toBe("Tomorrow");
  });

  it("calls onChangeSchedule with null when Unschedule is selected", () => {
    const onChangeSchedule = jest.fn();
    const [section] = getScheduleSections(
      today.toString(),
      onChangeSchedule,
      jest.fn(),
    );

    section.options.find((option) => option.title === "Unschedule")?.onSelect();

    expect(onChangeSchedule).toHaveBeenCalledWith(null);
  });

  // The presets still write straight through; only the arbitrary-date rows
  // hand off to the form.
  it("calls onChangeSchedule with the picked preset", () => {
    const onChangeSchedule = jest.fn();
    const onEditTask = jest.fn();
    const [section] = getScheduleSections(null, onChangeSchedule, onEditTask);

    section.options.find((option) => option.title === "Tomorrow")?.onSelect();

    expect(onChangeSchedule).toHaveBeenCalledWith(tomorrow.toString());
    expect(onEditTask).not.toHaveBeenCalled();
  });

  it("always offers 'Pick a date…', which opens the edit modal", () => {
    const onEditTask = jest.fn();
    const [unscheduled] = getScheduleSections(null, jest.fn(), onEditTask);
    const [scheduled] = getScheduleSections(
      today.toString(),
      jest.fn(),
      onEditTask,
    );

    for (const section of [unscheduled, scheduled]) {
      const pickOption = section.options.find(
        (option) => option.title === "Pick a date…",
      );
      expect(pickOption).toBeDefined();
      pickOption?.onSelect();
    }

    expect(onEditTask).toHaveBeenCalledTimes(2);
  });

  it("opens the edit modal from the custom-date row rather than doing nothing", () => {
    const onChangeSchedule = jest.fn();
    const onEditTask = jest.fn();
    const [section] = getScheduleSections(
      today.add({ days: 60 }).toString(),
      onChangeSchedule,
      onEditTask,
    );

    section.options.find((option) => option.isSelected)?.onSelect();

    expect(onEditTask).toHaveBeenCalledTimes(1);
    expect(onChangeSchedule).not.toHaveBeenCalled();
  });
});
