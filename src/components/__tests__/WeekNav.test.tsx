import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { WeekNav } from "../WeekNav";
import { weekOf } from "@/utils/weekStartEnd";

describe("WeekNav", () => {
  // 2026-07-27 is a Monday — ISO week 31 of 2026.
  const monday = Temporal.PlainDate.from("2026-07-27");

  it("labels the week by its ISO week number and year", () => {
    const screen = render(<WeekNav monday={monday} onChangeWeek={jest.fn()} />);

    expect(screen.getByText("Week 31, 2026")).toBeTruthy();
  });

  it("moves back a whole week when the previous arrow is pressed", () => {
    const onChangeWeek = jest.fn();
    const screen = render(
      <WeekNav monday={monday} onChangeWeek={onChangeWeek} />,
    );

    fireEvent.press(screen.getByLabelText("Previous week"));

    expect(onChangeWeek).toHaveBeenCalledWith(
      Temporal.PlainDate.from("2026-07-20"),
    );
  });

  it("moves forward a whole week when the next arrow is pressed", () => {
    const onChangeWeek = jest.fn();
    const screen = render(
      <WeekNav monday={monday} onChangeWeek={onChangeWeek} />,
    );

    fireEvent.press(screen.getByLabelText("Next week"));

    expect(onChangeWeek).toHaveBeenCalledWith(
      Temporal.PlainDate.from("2026-08-03"),
    );
  });

  it("returns to the current week when the label is pressed", () => {
    const onChangeWeek = jest.fn();
    const screen = render(
      <WeekNav monday={monday} onChangeWeek={onChangeWeek} />,
    );

    fireEvent.press(screen.getByLabelText("Go to this week"));

    expect(onChangeWeek).toHaveBeenCalledWith(
      weekOf(Temporal.Now.plainDateISO()).monday,
    );
  });

  it("keeps the label as the reset shortcut even on the current week", () => {
    // Unlike DayNav, there is no picker branch — the shortcut never swaps out.
    const thisMonday = weekOf(Temporal.Now.plainDateISO()).monday;
    const screen = render(
      <WeekNav monday={thisMonday} onChangeWeek={jest.fn()} />,
    );

    expect(screen.getByLabelText("Go to this week")).toBeTruthy();
  });

  // ISO weeks can belong to the neighbouring calendar year. The legacy app
  // labelled these with `.year` and got both cases wrong.
  describe("ISO year boundaries", () => {
    it("labels a December week owned by the next year", () => {
      // 2024-12-30 is a Monday in ISO week 1 of 2025.
      const screen = render(
        <WeekNav
          monday={Temporal.PlainDate.from("2024-12-30")}
          onChangeWeek={jest.fn()}
        />,
      );

      expect(screen.getByText("Week 1, 2025")).toBeTruthy();
    });

    it("labels a January week owned by the previous year", () => {
      // 2026-12-28 is a Monday; its week runs into 2027 as week 53 of 2026.
      const screen = render(
        <WeekNav
          monday={Temporal.PlainDate.from("2026-12-28")}
          onChangeWeek={jest.fn()}
        />,
      );

      expect(screen.getByText("Week 53, 2026")).toBeTruthy();
    });
  });
});
