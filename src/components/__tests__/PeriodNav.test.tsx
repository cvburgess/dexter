import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text, TextStyle, ViewStyle } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { DayNav } from "../DayNav";
import { PeriodNav, PeriodNavLabel } from "../PeriodNav";
import { WeekNav } from "../WeekNav";
import { formatWeekdayMonthDay } from "@/utils/formatPlainDate";

// `DateField` wraps a native picker with no test double; the alignment cases
// use a non-today date so `DayNav` takes the label branch and never renders it.
jest.mock("../DateField", () => ({ DateField: () => null }));

// Pinned from outside the module on purpose: both tabs' chevrons land on the
// same x only because the slot is this wide regardless of the label.
const CENTER_SLOT_WIDTH = 160;

const styleOf = (node: ReactTestInstance) =>
  StyleSheet.flatten<TextStyle & ViewStyle>(node.props.style);

describe("PeriodNav", () => {
  const renderNav = (overrides: Partial<typeof props> = {}) =>
    render(
      <PeriodNav {...props} {...overrides}>
        <Text>center</Text>
      </PeriodNav>,
    );

  const props = {
    nextLabel: "Next thing",
    onNext: jest.fn(),
    onPrev: jest.fn(),
    prevLabel: "Previous thing",
  };

  it("calls onPrev when the previous chevron is pressed", () => {
    const onPrev = jest.fn();

    fireEvent.press(renderNav({ onPrev }).getByLabelText("Previous thing"));

    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when the next chevron is pressed", () => {
    const onNext = jest.fn();

    fireEvent.press(renderNav({ onNext }).getByLabelText("Next thing"));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // The slot, not the label, carries the width — so `DayNav`'s calendar picker
  // gets it too, without restating the number.
  it("sizes the center slot rather than its contents", () => {
    const screen = renderNav();

    expect(styleOf(screen.getByTestId("period-nav-center")).minWidth).toBe(
      CENTER_SLOT_WIDTH,
    );
  });
});

describe("PeriodNavLabel", () => {
  it("centers its text at the shared type metrics", () => {
    const screen = render(<PeriodNavLabel>Friday, Jul 3</PeriodNavLabel>);

    const style = styleOf(screen.getByText("Friday, Jul 3"));

    expect(style.textAlign).toBe("center");
    expect(style.fontSize).toBe(16);
  });
});

// DEX-97: Today and Week header rows share a baseline. This catches the drift
// the extraction can't — a nav dropping PeriodNav or restyling its label.
describe("shared metrics between DayNav and WeekNav", () => {
  // Derived from the real "today" so `DayNav` never takes its picker branch,
  // which has no `PeriodNavLabel` to compare against.
  const notToday = Temporal.Now.plainDateISO().add({ days: 10 });
  // A Monday — ISO week 31 of 2026, which is what `WeekNav` renders.
  const monday = Temporal.PlainDate.from("2026-07-27");

  it("renders both center labels at identical metrics", () => {
    const day = render(<DayNav date={notToday} onChangeDate={jest.fn()} />);
    const week = render(<WeekNav monday={monday} onChangeWeek={jest.fn()} />);

    expect(styleOf(week.getByText("Week 31, 2026"))).toEqual(
      styleOf(day.getByText(formatWeekdayMonthDay(notToday))),
    );
  });

  it("gives both navs the same center slot width", () => {
    const day = render(<DayNav date={notToday} onChangeDate={jest.fn()} />);
    const week = render(<WeekNav monday={monday} onChangeWeek={jest.fn()} />);

    const slotWidth = (screen: typeof day) =>
      styleOf(screen.getByTestId("period-nav-center")).minWidth;

    expect(slotWidth(day)).toBe(CENTER_SLOT_WIDTH);
    expect(slotWidth(week)).toBe(CENTER_SLOT_WIDTH);
  });
});
