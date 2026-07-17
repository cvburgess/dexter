import { fireEvent, render, screen } from "@testing-library/react-native";

import { WeekdayPicker } from "../WeekdayPicker";

// Cron day-of-week (0 = Sunday), ordered Monday-first — matches
// settings/tasks/[id].tsx's WEEKDAYS.
const CRON_DAYS = [
  { value: 1, label: "M", accessibilityLabel: "Monday" },
  { value: 2, label: "T", accessibilityLabel: "Tuesday" },
  { value: 0, label: "S", accessibilityLabel: "Sunday" },
];

// Temporal dayOfWeek (Monday = 1 ... Sunday = 7) — matches
// settings/habits/[id].tsx's DAYS. Sunday is encoded differently (7 vs
// cron's 0) to prove the component round-trips whatever value it's given.
const TEMPORAL_DAYS = [
  { value: 1, label: "M", accessibilityLabel: "Monday" },
  { value: 7, label: "S", accessibilityLabel: "Sunday" },
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

  it("uses the caller-supplied accessibility labels", () => {
    render(
      <WeekdayPicker days={CRON_DAYS} selected={[]} onToggle={jest.fn()} />,
    );

    expect(screen.getByLabelText("Sunday")).toBeTruthy();
    expect(screen.getByLabelText("Monday")).toBeTruthy();
  });

  it("round-trips the caller's value regardless of encoding (cron vs Temporal)", () => {
    const onToggle = jest.fn();
    render(
      <WeekdayPicker days={TEMPORAL_DAYS} selected={[]} onToggle={onToggle} />,
    );

    fireEvent.press(screen.getByLabelText("Sunday"));

    expect(onToggle).toHaveBeenCalledWith(7);
  });

  it("marks only the selected days as selected", () => {
    render(
      <WeekdayPicker days={CRON_DAYS} selected={[1, 0]} onToggle={jest.fn()} />,
    );

    expect(screen.getByLabelText("Monday").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText("Sunday").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText("Tuesday").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("calls onToggle with the pressed day's value", () => {
    const onToggle = jest.fn();
    render(
      <WeekdayPicker days={CRON_DAYS} selected={[]} onToggle={onToggle} />,
    );

    fireEvent.press(screen.getByLabelText("Tuesday"));

    expect(onToggle).toHaveBeenCalledWith(2);
  });
});
