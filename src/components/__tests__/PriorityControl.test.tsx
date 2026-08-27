import { fireEvent, render, renderHook } from "@testing-library/react-native";

import { ETaskPriority } from "@/api/tasks";
import { useTheme } from "@/utils/theme";

import { PriorityControl, prioritySelectedColors } from "../PriorityControl";

const theme = renderHook(() => useTheme()).result.current;

describe("PriorityControl", () => {
  it("renders an option for each priority", () => {
    const screen = render(
      <PriorityControl
        priority={ETaskPriority.UNPRIORITIZED}
        onChangePriority={jest.fn()}
      />,
    );

    for (const label of [
      "Important & Urgent",
      "Important",
      "Urgent",
      "Neither",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("selects the tapped priority", () => {
    const onChangePriority = jest.fn();
    const screen = render(
      <PriorityControl
        priority={ETaskPriority.UNPRIORITIZED}
        onChangePriority={onChangePriority}
      />,
    );

    fireEvent.press(screen.getByLabelText("Urgent"));

    expect(onChangePriority).toHaveBeenCalledWith(ETaskPriority.URGENT);
  });

  it("marks the current priority as selected", () => {
    const screen = render(
      <PriorityControl
        priority={ETaskPriority.IMPORTANT}
        onChangePriority={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Important")).toBeSelected();
    expect(screen.getByLabelText("Urgent")).not.toBeSelected();
  });

  // NEITHER's priority color matches the card's unselected icon color, so
  // drawing it like the other three would look untouched — it inverts instead.
  it("fills the selected Neither option with a color that isn't the card", () => {
    const screen = render(
      <PriorityControl
        priority={ETaskPriority.NEITHER}
        onChangePriority={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Neither")).toHaveStyle({
      backgroundColor: theme.colors.priorityContent[ETaskPriority.NEITHER],
    });

    screen.rerender(
      <PriorityControl
        priority={ETaskPriority.UNPRIORITIZED}
        onChangePriority={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Neither")).not.toHaveStyle({
      backgroundColor: theme.colors.priorityContent[ETaskPriority.NEITHER],
    });
  });

  it("swaps Neither's fill and content colors, and no other priority's", () => {
    expect(prioritySelectedColors(ETaskPriority.NEITHER, theme)).toEqual({
      background: theme.colors.priorityContent[ETaskPriority.NEITHER],
      content: theme.colors.priority[ETaskPriority.NEITHER],
    });
    expect(prioritySelectedColors(ETaskPriority.URGENT, theme)).toEqual({
      background: theme.colors.priority[ETaskPriority.URGENT],
      content: theme.colors.priorityContent[ETaskPriority.URGENT],
    });
  });

  it("clears back to unprioritized when the selected option is tapped again", () => {
    const onChangePriority = jest.fn();
    const screen = render(
      <PriorityControl
        priority={ETaskPriority.NEITHER}
        onChangePriority={onChangePriority}
      />,
    );

    fireEvent.press(screen.getByLabelText("Neither"));

    expect(onChangePriority).toHaveBeenCalledWith(ETaskPriority.UNPRIORITIZED);
  });
});
