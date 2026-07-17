import { fireEvent, render, screen } from "@testing-library/react-native";

import { WeekdayPicker } from "../WeekdayPicker";

describe("WeekdayPicker", () => {
  it("renders one chip per day, Monday-first", () => {
    render(
      <WeekdayPicker valueSource="cron" selected={[]} onToggle={jest.fn()} />,
    );

    expect(screen.getAllByText("M")).toHaveLength(1);
    expect(screen.getAllByText("T")).toHaveLength(2); // Tuesday + Thursday
    expect(screen.getAllByText("W")).toHaveLength(1);
    expect(screen.getAllByText("F")).toHaveLength(1);
    expect(screen.getAllByText("S")).toHaveLength(2); // Saturday + Sunday
  });

  it("labels each chip with the full day name for screen readers", () => {
    render(
      <WeekdayPicker valueSource="cron" selected={[]} onToggle={jest.fn()} />,
    );

    expect(screen.getByLabelText("Monday")).toBeTruthy();
    expect(screen.getByLabelText("Sunday")).toBeTruthy();
  });

  it("uses cron day values (Sunday = 0) when valueSource is cron", () => {
    const onToggle = jest.fn();
    render(
      <WeekdayPicker valueSource="cron" selected={[]} onToggle={onToggle} />,
    );

    fireEvent.press(screen.getByLabelText("Sunday"));

    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it("uses Temporal day values (Sunday = 7) when valueSource is temporal", () => {
    const onToggle = jest.fn();
    render(
      <WeekdayPicker
        valueSource="temporal"
        selected={[]}
        onToggle={onToggle}
      />,
    );

    fireEvent.press(screen.getByLabelText("Sunday"));

    expect(onToggle).toHaveBeenCalledWith(7);
  });

  it("marks only the selected days as selected", () => {
    render(
      <WeekdayPicker
        valueSource="cron"
        selected={[1, 0]}
        onToggle={jest.fn()}
      />,
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
      <WeekdayPicker valueSource="cron" selected={[]} onToggle={onToggle} />,
    );

    fireEvent.press(screen.getByLabelText("Tuesday"));

    expect(onToggle).toHaveBeenCalledWith(2);
  });
});
