import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { weekStartEnd } from "@/utils/weekStartEnd";

import {
  getPrioritySections,
  getScheduleSections,
  MoreMenu,
} from "../MoreMenu";

const mockIconMenu = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

describe("MoreMenu", () => {
  it("opens on long-press with no menu title, wrapping its children", () => {
    const screen = render(
      <MoreMenu
        priority={ETaskPriority.NEITHER}
        scheduledFor={null}
        onChangePriority={jest.fn()}
        onChangeSchedule={jest.fn()}
      >
        <Text>Task row</Text>
      </MoreMenu>,
    );

    expect(screen.getByText("Task row")).toBeTruthy();
    expect(mockIconMenu).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "longPress" }),
    );
    expect(mockIconMenu.mock.calls[0][0]).not.toHaveProperty("menuTitle");
  });
});

describe("getPrioritySections", () => {
  it("lists priorities in Important & Urgent / Important / Urgent / Neither order", () => {
    const [section] = getPrioritySections(ETaskPriority.NEITHER, jest.fn());

    expect(section.title).toBe("Priority");
    expect(section.isSubmenu).toBe(true);
    expect(section.options.map((option) => option.title)).toEqual([
      "Important & Urgent",
      "Important",
      "Urgent",
      "Neither",
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
