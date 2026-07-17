import { fireEvent, render, screen } from "@testing-library/react-native";

import { WeekdayPicker } from "../WeekdayPicker";

// Cron day-of-week (0 = Sunday), ordered Monday-first — matches
// settings/tasks/[id].tsx's WEEKDAYS.
const CRON_DAYS = [
  { value: 1, label: "M", accessibilityLabel: "Weekday 1" },
  { value: 2, label: "T", accessibilityLabel: "Weekday 2" },
  { value: 0, label: "S", accessibilityLabel: "Weekday 0" },
];

// Temporal dayOfWeek (Monday = 1 ... Sunday = 7) — matches
// settings/habits/[id].tsx's DAYS.
const TEMPORAL_DAYS = [
  { value: 1, label: "M", accessibilityLabel: "Day 1" },
  { value: 7, label: "S", accessibilityLabel: "Day 7" },
];

describe("WeekdayPicker", () => {
  it("renders one chip per day with the caller's labels", () => {
    render(
      <WeekdayPicker days={CRON_DAYS} selected={[]} onToggle={jest.fn()} />,
    );

    expect(screen.getAllByText("M")).toHaveLength(1);
    expect(screen.getAllByText("T")).toHaveLength(1);
    expect(screen.getAllByText("S")).toHaveLength(1);
  });

  it("uses the caller-supplied accessibility label format (cron)", () => {
    render(
      <WeekdayPicker days={CRON_DAYS} selected={[]} onToggle={jest.fn()} />,
    );

    expect(screen.getByLabelText("Weekday 0")).toBeTruthy();
    expect(screen.getByLabelText("Weekday 1")).toBeTruthy();
  });

  it("uses the caller-supplied accessibility label format (Temporal)", () => {
    render(
      <WeekdayPicker days={TEMPORAL_DAYS} selected={[]} onToggle={jest.fn()} />,
    );

    expect(screen.getByLabelText("Day 1")).toBeTruthy();
    expect(screen.getByLabelText("Day 7")).toBeTruthy();
  });

  it("marks only the selected days as selected", () => {
    render(
      <WeekdayPicker days={CRON_DAYS} selected={[1, 0]} onToggle={jest.fn()} />,
    );

    expect(screen.getByLabelText("Weekday 1").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText("Weekday 0").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText("Weekday 2").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("calls onToggle with the pressed day's value", () => {
    const onToggle = jest.fn();
    render(
      <WeekdayPicker days={CRON_DAYS} selected={[]} onToggle={onToggle} />,
    );

    fireEvent.press(screen.getByLabelText("Weekday 2"));

    expect(onToggle).toHaveBeenCalledWith(2);
  });
});
