import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";

import { DueDateButton } from "../DueDateButton";

const daysFromNow = (days: number) =>
  Temporal.Now.plainDateISO().add({ days }).toString();

const PRIORITY = "#111111";
const CONTENT = "#eeeeee";

const renderBadge = (dueOn: string) =>
  render(
    <DueDateButton
      dueOn={dueOn}
      priorityColor={PRIORITY}
      contentColor={CONTENT}
    />,
  );

const colors = (dueOn: string) => {
  const screen = renderBadge(dueOn);
  const badge = screen.getByTestId("due-date-badge");
  const badgeStyle = StyleSheet.flatten(badge.props.style as ViewStyle[]);
  const text = screen.getByText(
    Temporal.Now.plainDateISO()
      .until(Temporal.PlainDate.from(dueOn))
      .days.toString(),
  );
  const textStyle = StyleSheet.flatten(text.props.style as TextStyle[]);
  return {
    background: badgeStyle.backgroundColor,
    border: badgeStyle.borderColor,
    borderWidth: badgeStyle.borderWidth,
    text: textStyle.color,
  };
};

describe("DueDateButton", () => {
  it("renders nothing when dueOn is unset", () => {
    const screen = render(
      <DueDateButton
        dueOn={null}
        priorityColor={PRIORITY}
        contentColor={CONTENT}
      />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it("shows the integer days remaining for a future due date", () => {
    expect(renderBadge(daysFromNow(5)).getByText("5")).toBeTruthy();
  });

  it("shows 0 when due today", () => {
    expect(renderBadge(daysFromNow(0)).getByText("0")).toBeTruthy();
  });

  it("shows a negative count when overdue", () => {
    expect(renderBadge(daysFromNow(-3)).getByText("-3")).toBeTruthy();
  });

  it("sits on the priority color with priority-content text/outline when not overdue", () => {
    const style = colors(daysFromNow(5));

    expect(style.background).toBe(PRIORITY);
    expect(style.text).toBe(CONTENT);
    expect(style.border).toBe(CONTENT);
    expect(style.borderWidth).toBe(1);
  });

  it("inverts to a solid priority-content fill with priority-color text/outline once overdue", () => {
    const style = colors(daysFromNow(-3));

    expect(style.background).toBe(CONTENT);
    expect(style.text).toBe(PRIORITY);
    expect(style.border).toBe(PRIORITY);
  });

  it("treats due-today as overdue but tomorrow as not overdue", () => {
    // Threshold is `daysUntilDue <= 0`: today inverts, tomorrow stays normal.
    expect(colors(daysFromNow(0)).background).toBe(CONTENT);
    expect(colors(daysFromNow(1)).background).toBe(PRIORITY);
  });
});
