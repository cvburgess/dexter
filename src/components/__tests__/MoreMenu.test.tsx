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
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: () => [
    [],
    {
      createTemplate: jest.fn(),
      createTemplateFromTask: jest.fn(),
      deleteTemplate: jest.fn(),
      getTemplateById: mockGetTemplateById,
      isLoading: false,
      updateTemplate: jest.fn(),
    },
  ],
}));

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const otherOptionTitles = () => {
  const { sections } = mockIconMenu.mock.calls[0][0];
  const other = sections.find((section) => section.title === "Other");
  return other?.options.map((option) => option.title);
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
        onChangeList={jest.fn()}
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
      "List",
      "Other",
    ]);
    // Priority/Schedule/List collapse into submenus; the Other action group
    // (which now leads with the alarm toggle) is inline so its actions are
    // directly tappable.
    expect(sections.map((section) => Boolean(section.isSubmenu))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(
      sections.map((section) =>
        typeof section.icon === "object" ? section.icon.ios : section.icon,
      ),
    ).toEqual(["exclamationmark", "calendar", "face.smiling", undefined]);
  });

  it("labels the repeat action 'Repeat' when the task has no template", () => {
    render(
      <MoreMenu
        task={makeTask({ templateId: null })}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeList={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(otherOptionTitles()).toEqual([
      "Set alarm",
      "Duplicate",
      "Repeat",
      "Delete",
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
        onChangeList={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(otherOptionTitles()).toEqual([
      "Set alarm",
      "Duplicate",
      "Edit repeat schedule",
      "Delete",
    ]);
  });

  it("shows 'Unset alarm' in the Other group when the task already has an alarm", () => {
    render(
      <MoreMenu
        task={makeTask({ alarmTime: "08:00" })}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
        onChangeList={jest.fn()}
        onSetAlarm={jest.fn()}
        onClearAlarm={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(otherOptionTitles()?.[0]).toBe("Unset alarm");
  });
});

describe("getOtherSections", () => {
  const repeat = { label: "Repeat", onSelect: jest.fn() };

  it("offers Duplicate, Repeat, and Delete as an inline group, with Delete destructive", () => {
    const [section] = getOtherSections(jest.fn(), jest.fn(), repeat);

    expect(section.title).toBe("Other");
    expect(section.isSubmenu).toBeUndefined();
    expect(section.options.map((option) => option.title)).toEqual([
      "Duplicate",
      "Repeat",
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
    const [section] = getOtherSections(onDuplicate, onDelete, {
      label: "Repeat",
      onSelect: onRepeat,
    });

    section.options.find((option) => option.title === "Duplicate")?.onSelect();
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    section.options.find((option) => option.title === "Repeat")?.onSelect();
    expect(onRepeat).toHaveBeenCalledTimes(1);

    section.options.find((option) => option.title === "Delete")?.onSelect();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("leads with an inline alarm item (same icon for set/unset) when one is passed", () => {
    const onSelect = jest.fn();
    const [section] = getOtherSections(
      jest.fn(),
      jest.fn(),
      { label: "Repeat", onSelect: jest.fn() },
      { title: "Set alarm", onSelect },
    );

    const [alarmOption] = section.options;
    expect(alarmOption.title).toBe("Set alarm");
    // Same icon whether setting or unsetting.
    expect(alarmOption.icon).toEqual({
      ios: "alarm",
      android: "alarm",
      web: "alarm",
    });

    alarmOption.onSelect();
    expect(onSelect).toHaveBeenCalledTimes(1);

    // The alarm item is not a submenu; it's a directly-tappable action.
    expect(section.isSubmenu).toBeUndefined();
  });

  it("omits the alarm item when none is passed (non-iOS)", () => {
    const [section] = getOtherSections(jest.fn(), jest.fn(), {
      label: "Repeat",
      onSelect: jest.fn(),
    });

    expect(section.options.map((option) => option.title)).toEqual([
      "Duplicate",
      "Repeat",
      "Delete",
    ]);
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
    const [section] = getScheduleSections(null, jest.fn());

    expect(section.title).toBe("Schedule");
    expect(section.isSubmenu).toBe(true);
    const titles = section.options.map((option) => option.title);
    expect(titles).toEqual(expect.arrayContaining(["Today", "Tomorrow"]));
    expect(titles).not.toContain("Unschedule");
  });

  it("selects Today and offers Unschedule when scheduled for today", () => {
    const [section] = getScheduleSections(today.toString(), jest.fn());

    const todayOption = section.options.find(
      (option) => option.title === "Today",
    );
    expect(todayOption?.isSelected).toBe(true);
    expect(section.options.map((option) => option.title)).toContain(
      "Unschedule",
    );
  });

  it("hides Next Week when already scheduled within the next week", () => {
    const [section] = getScheduleSections(nextMonday.toString(), jest.fn());

    expect(section.options.map((option) => option.title)).not.toContain(
      "Next Week",
    );
  });

  it("shows a selected custom-date option for a date scheduled beyond next week", () => {
    const farOut = today.add({ days: 60 }).toString();
    const [section] = getScheduleSections(farOut, jest.fn());

    const titles = section.options.map((option) => option.title);
    if (nextWeekOptionExpected) expect(titles).toContain("Next Week");

    const customOption = section.options.find((option) => option.isSelected);
    expect(customOption).toBeDefined();
    expect(customOption?.title).not.toBe("Today");
    expect(customOption?.title).not.toBe("Tomorrow");
  });

  it("calls onChangeSchedule with null when Unschedule is selected", () => {
    const onChangeSchedule = jest.fn();
    const [section] = getScheduleSections(today.toString(), onChangeSchedule);

    section.options.find((option) => option.title === "Unschedule")?.onSelect();

    expect(onChangeSchedule).toHaveBeenCalledWith(null);
  });
});
