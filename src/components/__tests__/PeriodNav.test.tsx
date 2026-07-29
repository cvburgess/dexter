import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text, TextStyle, ViewStyle } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { DayNav } from "../DayNav";
import { PeriodNav, PeriodNavLabel } from "../PeriodNav";
import { WeekNav } from "../WeekNav";
import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";

// `DayNav` imports `DateField`, which wraps a native picker with no test
// double — the same stub `DayNav.test.tsx` uses. Nothing here renders it (the
// alignment cases below use a non-today date, which takes the label branch),
// but the module still has to load.
jest.mock("../DateField", () => ({ DateField: () => null }));

describe("PeriodNav", () => {
  const props = {
    nextLabel: "Next thing",
    onNext: jest.fn(),
    onPrev: jest.fn(),
    prevLabel: "Previous thing",
  };

  it("labels each chevron with the caller's accessibility label", () => {
    const screen = render(
      <PeriodNav {...props}>
        <Text>center</Text>
      </PeriodNav>,
    );

    expect(screen.getByLabelText("Previous thing")).toBeTruthy();
    expect(screen.getByLabelText("Next thing")).toBeTruthy();
  });

  it("renders the center slot between the chevrons", () => {
    const screen = render(
      <PeriodNav {...props}>
        <Text>center</Text>
      </PeriodNav>,
    );

    expect(screen.getByText("center")).toBeTruthy();
  });

  it("calls onPrev when the previous chevron is pressed", () => {
    const onPrev = jest.fn();
    const screen = render(
      <PeriodNav {...props} onPrev={onPrev}>
        <Text>center</Text>
      </PeriodNav>,
    );

    fireEvent.press(screen.getByLabelText("Previous thing"));

    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when the next chevron is pressed", () => {
    const onNext = jest.fn();
    const screen = render(
      <PeriodNav {...props} onNext={onNext}>
        <Text>center</Text>
      </PeriodNav>,
    );

    fireEvent.press(screen.getByLabelText("Next thing"));

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

// The Today and Week header rows have to sit on the same baseline, and the
// chevrons have to stay put as the center label's text width changes. That used
// to be held by a comment in each nav; `PeriodNav` makes it structural, and
// these guard against a local override creeping back in (DEX-97).
describe("shared metrics between DayNav and WeekNav", () => {
  // Derived from the real "today" so `DayNav` never takes its picker branch,
  // which has no `PeriodNavLabel` to compare against.
  const notToday = Temporal.Now.plainDateISO().add({ days: 10 });
  // A Monday — ISO week 31 of 2026, which is what `WeekNav` renders.
  const monday = Temporal.PlainDate.from("2026-07-27");

  const dayNav = () =>
    render(<DayNav date={notToday} onChangeDate={jest.fn()} />);
  const weekNav = () =>
    render(<WeekNav monday={monday} onChangeWeek={jest.fn()} />);

  const styleOf = <T extends TextStyle | ViewStyle>(node: ReactTestInstance) =>
    StyleSheet.flatten<T>(node.props.style);

  it("centers the label at the same size and fixed width", () => {
    const day = styleOf<TextStyle>(
      dayNav().getByText(formatWeekdayMonthDay(notToday)),
    );
    const week = styleOf<TextStyle>(weekNav().getByText("Week 31, 2026"));

    expect(day.minWidth).toBe(160);
    expect(week).toEqual(day);
  });

  it("gives both chevrons the same hit area", () => {
    const day = dayNav();
    const week = weekNav();

    expect(styleOf<ViewStyle>(week.getByLabelText("Previous week"))).toEqual(
      styleOf<ViewStyle>(day.getByLabelText("Previous day")),
    );
    expect(styleOf<ViewStyle>(week.getByLabelText("Next week"))).toEqual(
      styleOf<ViewStyle>(day.getByLabelText("Next day")),
    );
  });
});

describe("PeriodNavLabel", () => {
  it("renders its text at the shared center-slot width", () => {
    const screen = render(<PeriodNavLabel>Friday, Jul 3</PeriodNavLabel>);

    const style = StyleSheet.flatten<TextStyle>(
      screen.getByText("Friday, Jul 3").props.style,
    );

    expect(style.minWidth).toBe(160);
    expect(style.textAlign).toBe("center");
  });
});
