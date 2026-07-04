import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority } from "@/api/tasks";

import { PriorityControl } from "../PriorityControl";

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

    expect(
      screen.getByLabelText("Important").props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByLabelText("Urgent").props.accessibilityState.selected,
    ).toBe(false);
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
