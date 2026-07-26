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
  getDeadlineSections,
  getOtherSections,
  getPrioritySections,
  getScheduleSections,
  getTaskActionSections,
  MoreMenu,
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

const mockGetTemplateById = jest.fn(() => undefined);
const mockCreateTemplateFromTask = jest.fn();
const mockSaveTaskAsTemplate = jest.fn<
  void,
  [TTask, { onSuccess: (template: { id: string }) => void }]
>();
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: () => [
    [],
    {
      createTemplate: jest.fn(),
      createTemplateFromTask: mockCreateTemplateFromTask,
      deleteTemplate: jest.fn(),
      getTemplateById: mockGetTemplateById,
      isLoading: false,
      saveTaskAsTemplate: mockSaveTaskAsTemplate,
      updateTemplate: jest.fn(),
    },
  ],
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

// The two untitled inline groups at the foot of the menu: the alarm/subtask
// edits, then the duplicate/repeat/save-as-template/delete actions.
const inlineOptionTitles = () => {
  const { sections } = mockIconMenu.mock.calls[0][0];
  return sections
    .filter((section) => !section.isSubmenu)
    .map((section) => section.options.map((option) => option.title));
};

describe("MoreMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTemplateById.mockReturnValue(undefined);
  });

  it("opens on long-press with no menu title, wrapping its children", () => {
    const screen = render(
      <MoreMenu
        task={makeTask()}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(screen.getByText("Task row")).toBeTruthy();
    expect(mockIconMenu).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "longPress" }),
    );
    expect(mockIconMenu.mock.calls[0][0]).not.toHaveProperty("menuTitle");

    const { sections } = mockIconMenu.mock.calls[0][0];
    expect(sections.map((section) => section.title)).toEqual([
      "Priority",
      "Schedule",
      "Deadline",
      "List",
      undefined,
      undefined,
    ]);
    // Priority/Schedule/Deadline/List collapse into submenus; the two action
    // groups are inline, so their actions are directly tappable.
    expect(sections.map((section) => Boolean(section.isSubmenu))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(
      sections.map((section) =>
        typeof section.icon === "object" ? section.icon.ios : section.icon,
      ),
    ).toEqual([
      "exclamationmark",
      "calendar",
      "calendar.badge.clock",
      "face.smiling",
      undefined,
      undefined,
    ]);
    // Priority through the alarm/subtask actions read as one unruled group;
    // only the duplicate/repeat/delete actions are set apart.
    expect(sections.map((section) => Boolean(section.hideDivider))).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  // The two submenus share one builder, so the only thing that can go wrong
  // here is the field each one is bound to.
  it("names the field when 'Pick a date…' is chosen in either date submenu", () => {
    const onPickDate = jest.fn();
    render(
      <MoreMenu
        task={makeTask()}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={onPickDate}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    const { sections } = mockIconMenu.mock.calls[0][0];
    const pickDateIn = (title: string) =>
      sections
        .find((section) => section.title === title)
        ?.options.find((option) => option.title === "Pick a date…");

    pickDateIn("Schedule")?.onSelect();
    expect(onPickDate).toHaveBeenCalledWith("schedule");

    pickDateIn("Deadline")?.onSelect();
    expect(onPickDate).toHaveBeenCalledWith("deadline");
    expect(onPickDate).toHaveBeenCalledTimes(2);
  });

  // `IconMenu.native` flattens every section into one id -> option map and
  // dispatches the system menu's press by id, so a duplicate silently routes one
  // row's tap to another's handler. Schedule and Deadline offer the same dates,
  // which is exactly where that collides.
  it("gives every option a menu-wide unique id", () => {
    render(
      <MoreMenu
        task={makeTask({
          scheduledFor: Temporal.Now.plainDateISO().toString(),
          dueOn: Temporal.Now.plainDateISO().toString(),
        })}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    const { sections } = mockIconMenu.mock.calls[0][0];
    const ids = sections.flatMap((section) =>
      section.options.map((option) => option.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("labels the repeat action 'Repeat' when the task has no template", () => {
    render(
      <MoreMenu
        task={makeTask({ templateId: null })}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(inlineOptionTitles()).toEqual([
      ["Set alarm"],
      ["Duplicate", "Repeat", "Save as template", "Delete"],
    ]);
  });

  it("labels the repeat action 'Edit repeat schedule' when a scheduled template is linked", () => {
    mockGetTemplateById.mockReturnValue({
      id: "template-1",
      schedule: "0 0 * * *",
    } as never);

    render(
      <MoreMenu
        task={makeTask({ templateId: "template-1" })}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(inlineOptionTitles()).toEqual([
      ["Set alarm"],
      ["Duplicate", "Edit repeat schedule", "Save as template", "Delete"],
    ]);
  });

  // A task template linked to a task carries no schedule, so the task does not
  // repeat and the action must still offer to start a repeat rather than to
  // edit a schedule that isn't there (DEX-65).
  it("labels the repeat action 'Repeat' when the linked template has no schedule", () => {
    mockGetTemplateById.mockReturnValue({
      id: "template-1",
      schedule: null,
    } as never);

    render(
      <MoreMenu
        task={makeTask({ templateId: "template-1" })}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(inlineOptionTitles()[1]).toEqual([
      "Duplicate",
      "Repeat",
      "Save as template",
      "Delete",
    ]);
  });

  // Saving a template must not touch the task it came from: linking would make
  // the task look like it repeats and would let `delete_task` take the template
  // down with it.
  it("saves a template from the task without linking it, then opens the editor", () => {
    const task = makeTask({ templateId: null });
    mockSaveTaskAsTemplate.mockImplementation((_task, { onSuccess }) => {
      onSuccess({ id: "template-9" });
    });

    render(
      <MoreMenu
        task={task}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    const { sections } = mockIconMenu.mock.calls[0][0];
    sections
      .flatMap((section) => section.options)
      .find((option) => option.id === "save-as-template")
      ?.onSelect();

    expect(mockSaveTaskAsTemplate).toHaveBeenCalledWith(
      task,
      expect.anything(),
    );
    expect(mockCreateTemplateFromTask).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/tasks/[id]",
      params: { id: "template-9" },
    });
  });

  it("shows 'Unset alarm' when the task already has an alarm", () => {
    render(
      <MoreMenu
        task={makeTask({ alarmTime: "08:00" })}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeDeadline={jest.fn()}
        onChangeList={jest.fn()}
        onPickDate={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(inlineOptionTitles()[0]).toEqual(["Unset alarm"]);
  });
});

describe("getOtherSections", () => {
  const repeat = { label: "Repeat", onSelect: jest.fn() };

  it("offers Duplicate, Repeat, Save as template, and Delete as an untitled inline group, with Delete destructive", () => {
    const [section] = getOtherSections({
      onDuplicate: jest.fn(),
      repeat,
      onSaveAsTemplate: jest.fn(),
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

  it("calls the action handlers when their options are selected", () => {
    const onDuplicate = jest.fn();
    const onDelete = jest.fn();
    const onRepeat = jest.fn();
    const onSaveAsTemplate = jest.fn();
    const [section] = getOtherSections({
      onDuplicate,
      repeat: { label: "Repeat", onSelect: onRepeat },
      onSaveAsTemplate,
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

  it("holds no alarm or subtask item — those sit in their own group above", () => {
    const [section] = getOtherSections({
      onDuplicate: jest.fn(),
      repeat,
      onSaveAsTemplate: jest.fn(),
      onDelete: jest.fn(),
    });

    expect(section.options.map((option) => option.title)).toEqual([
      "Duplicate",
      "Repeat",
      "Save as template",
      "Delete",
    ]);
  });
});

describe("getTaskActionSections", () => {
  it("offers the alarm and subtask actions as one untitled inline group", () => {
    const onSetAlarm = jest.fn();
    const onAddSubtask = jest.fn();
    const [section] = getTaskActionSections(
      { title: "Set alarm", onSelect: onSetAlarm },
      onAddSubtask,
    );

    expect(section.title).toBeUndefined();
    // Directly-tappable actions, not a submenu.
    expect(section.isSubmenu).toBeUndefined();
    expect(section.options.map((option) => option.title)).toEqual([
      "Set alarm",
      "Add subtask",
    ]);

    const [alarmOption, subtaskOption] = section.options;
    // Same icon whether setting or unsetting.
    expect(alarmOption.icon).toEqual({
      ios: "alarm",
      android: "alarm",
      web: "alarm",
    });

    alarmOption.onSelect();
    expect(onSetAlarm).toHaveBeenCalledTimes(1);

    subtaskOption.onSelect();
    expect(onAddSubtask).toHaveBeenCalledTimes(1);
  });

  it("omits the alarm item when none is passed (non-iOS)", () => {
    const [section] = getTaskActionSections(undefined, jest.fn());

    expect(section.options.map((option) => option.title)).toEqual([
      "Add subtask",
    ]);
  });

  // Nothing to act on: a card with no alarm support and no checklist affordance
  // should not open a menu with an empty divider in it.
  it("drops the group entirely when neither action is available", () => {
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

  it("always offers 'Pick a date…', which opens the picker", () => {
    const onPickDate = jest.fn();
    const [unscheduled] = getScheduleSections(null, jest.fn(), onPickDate);
    const [scheduled] = getScheduleSections(
      today.toString(),
      jest.fn(),
      onPickDate,
    );

    for (const section of [unscheduled, scheduled]) {
      const pickOption = section.options.find(
        (option) => option.title === "Pick a date…",
      );
      expect(pickOption).toBeDefined();
      pickOption?.onSelect();
    }

    expect(onPickDate).toHaveBeenCalledTimes(2);
  });

  // Previously a no-op row that told the user their date and did nothing.
  it("opens the picker from the custom-date row rather than doing nothing", () => {
    const onChangeSchedule = jest.fn();
    const onPickDate = jest.fn();
    const [section] = getScheduleSections(
      today.add({ days: 60 }).toString(),
      onChangeSchedule,
      onPickDate,
    );

    section.options.find((option) => option.isSelected)?.onSelect();

    expect(onPickDate).toHaveBeenCalledTimes(1);
    expect(onChangeSchedule).not.toHaveBeenCalled();
  });
});

describe("getDeadlineSections", () => {
  const today = Temporal.Now.plainDateISO();

  it("mirrors the Schedule presets under its own title and icon", () => {
    const [section] = getDeadlineSections(null, jest.fn(), jest.fn());

    expect(section.title).toBe("Deadline");
    expect(section.isSubmenu).toBe(true);
    expect(section.options.map((option) => option.title)).toEqual(
      expect.arrayContaining(["Today", "Tomorrow", "Pick a date…"]),
    );
    // Nothing to clear until a deadline is set.
    expect(section.options.map((option) => option.title)).not.toContain(
      "Clear deadline",
    );
  });

  it("selects the matching preset and offers Clear deadline once set", () => {
    const [section] = getDeadlineSections(
      today.toString(),
      jest.fn(),
      jest.fn(),
    );

    expect(
      section.options.find((option) => option.title === "Today")?.isSelected,
    ).toBe(true);
    expect(section.options.map((option) => option.title)).toContain(
      "Clear deadline",
    );
  });

  it("calls onChangeDeadline with the picked preset", () => {
    const onChangeDeadline = jest.fn();
    const [section] = getDeadlineSections(null, onChangeDeadline, jest.fn());

    section.options.find((option) => option.title === "Today")?.onSelect();

    expect(onChangeDeadline).toHaveBeenCalledWith(today.toString());
  });

  it("calls onChangeDeadline with null when Clear deadline is selected", () => {
    const onChangeDeadline = jest.fn();
    const [section] = getDeadlineSections(
      today.toString(),
      onChangeDeadline,
      jest.fn(),
    );

    section.options
      .find((option) => option.title === "Clear deadline")
      ?.onSelect();

    expect(onChangeDeadline).toHaveBeenCalledWith(null);
  });
});
