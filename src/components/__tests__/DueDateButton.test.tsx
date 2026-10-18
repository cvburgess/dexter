import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { DueDateButton } from "../DueDateButton";

const daysFromNow = (days: number) =>
  Temporal.Now.plainDateISO().add({ days }).toString();

const PRIORITY = "#111111";
const CONTENT = "#eeeeee";

const renderBadge = async (dueOn: string) =>
  await render(
    <DueDateButton
      dueOn={dueOn}
      priorityColor={PRIORITY}
      contentColor={CONTENT}
    />,
  );

const flatStyle = (style: unknown) =>
  StyleSheet.flatten(style as Parameters<typeof StyleSheet.flatten>[0])!;

const colors = async (dueOn: string) => {
  const screen = await renderBadge(dueOn);
  const badge = screen.getByTestId("due-date-badge");
  const badgeStyle = flatStyle(badge.props.style);
  const text = screen.getByText(
    Temporal.Now.plainDateISO()
      .until(Temporal.PlainDate.from(dueOn))
      .days.toString(),
  );
  const textStyle = flatStyle(text.props.style);
  return {
    background: badgeStyle.backgroundColor,
    border: badgeStyle.borderColor,
    borderWidth: badgeStyle.borderWidth,
    text: textStyle.color,
  };
};

describe("DueDateButton", () => {
  it("renders nothing when dueOn is unset", async () => {
    const screen = await render(
      <DueDateButton
        dueOn={null}
        priorityColor={PRIORITY}
        contentColor={CONTENT}
      />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it("shows the integer days remaining for a future due date", async () => {
    expect((await renderBadge(daysFromNow(5))).getByText("5")).toBeTruthy();
  });

  it("shows 0 when due today", async () => {
    expect((await renderBadge(daysFromNow(0))).getByText("0")).toBeTruthy();
  });

  it("shows a negative count when overdue", async () => {
    expect((await renderBadge(daysFromNow(-3))).getByText("-3")).toBeTruthy();
  });

  it("sits on the priority color with priority-content text/outline when not overdue", async () => {
    const style = await colors(daysFromNow(5));

    expect(style.background).toBe(PRIORITY);
    expect(style.text).toBe(CONTENT);
    expect(style.border).toBe(CONTENT);
    expect(style.borderWidth).toBe(1);
  });

  it("inverts to a solid priority-content fill with priority-color text/outline once overdue", async () => {
    const style = await colors(daysFromNow(-3));

    expect(style.background).toBe(CONTENT);
    expect(style.text).toBe(PRIORITY);
    expect(style.border).toBe(PRIORITY);
  });

  it("treats due-today as overdue but tomorrow as not overdue", async () => {
    // Threshold is `daysUntilDue <= 0`: today inverts, tomorrow stays normal.
    expect((await colors(daysFromNow(0))).background).toBe(CONTENT);
    expect((await colors(daysFromNow(1))).background).toBe(PRIORITY);
  });
});
