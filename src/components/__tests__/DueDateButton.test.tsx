import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { DueDateButton } from "../DueDateButton";

const daysFromNow = (days: number) =>
  Temporal.Now.plainDateISO().add({ days }).toString();

describe("DueDateButton", () => {
  it("renders nothing when dueOn is unset", () => {
    const screen = render(<DueDateButton dueOn={null} />);

    expect(screen.toJSON()).toBeNull();
  });

  it("shows the integer days remaining for a future due date", () => {
    const screen = render(<DueDateButton dueOn={daysFromNow(5)} />);

    expect(screen.getByText("5")).toBeTruthy();
  });

  it("shows 0 when due today", () => {
    const screen = render(<DueDateButton dueOn={daysFromNow(0)} />);

    expect(screen.getByText("0")).toBeTruthy();
  });

  it("shows a negative count when overdue", () => {
    const screen = render(<DueDateButton dueOn={daysFromNow(-3)} />);

    expect(screen.getByText("-3")).toBeTruthy();
  });

  it("applies warn styling when due today or tomorrow but not further out", () => {
    const flattenBackground = (dueOn: string) => {
      const screen = render(<DueDateButton dueOn={dueOn} />);
      const badge = screen.getByTestId("due-date-badge");
      const style = StyleSheet.flatten(badge.props.style as ViewStyle[]);
      return style.backgroundColor;
    };

    const warnColor = flattenBackground(daysFromNow(1));
    const normalColor = flattenBackground(daysFromNow(5));

    expect(warnColor).not.toEqual(normalColor);
  });
});
