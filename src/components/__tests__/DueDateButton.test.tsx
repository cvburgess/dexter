import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { DueDateButton } from "../DueDateButton";

const daysFromNow = (days: number) =>
  Temporal.Now.plainDateISO().add({ days }).toString();

describe("DueDateButton", () => {
  it("renders nothing when dueOn is unset", () => {
    const screen = render(
      <DueDateButton dueOn={null} contentColor="#000000" />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it("shows the integer days remaining for a future due date", () => {
    const screen = render(
      <DueDateButton dueOn={daysFromNow(5)} contentColor="#000000" />,
    );

    expect(screen.getByText("5")).toBeTruthy();
  });

  it("shows 0 when due today", () => {
    const screen = render(
      <DueDateButton dueOn={daysFromNow(0)} contentColor="#000000" />,
    );

    expect(screen.getByText("0")).toBeTruthy();
  });

  it("shows a negative count when overdue", () => {
    const screen = render(
      <DueDateButton dueOn={daysFromNow(-3)} contentColor="#000000" />,
    );

    expect(screen.getByText("-3")).toBeTruthy();
  });

  it("is outline-only normally, but fills solid when due today or tomorrow", () => {
    const badgeStyle = (dueOn: string) => {
      const screen = render(
        <DueDateButton dueOn={dueOn} contentColor="#000000" />,
      );
      const badge = screen.getByTestId("due-date-badge");
      return StyleSheet.flatten(badge.props.style as ViewStyle[]);
    };

    const warnStyle = badgeStyle(daysFromNow(1));
    const normalStyle = badgeStyle(daysFromNow(5));

    expect(normalStyle.backgroundColor).toBeUndefined();
    expect(normalStyle.borderWidth).toBe(1);
    expect(warnStyle.backgroundColor).toBeDefined();
  });
});
