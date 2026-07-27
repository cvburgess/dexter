import { fireEvent, render } from "@testing-library/react-native";

import { SegmentedControl } from "../SegmentedControl";

const OPTIONS = [
  { value: "new", label: "New" },
  { value: "template", label: "Template" },
  { value: "ai", label: "AI" },
];

describe("SegmentedControl", () => {
  it("renders one segment per option", () => {
    const screen = render(
      <SegmentedControl options={OPTIONS} value="new" onChange={jest.fn()} />,
    );

    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Template")).toBeTruthy();
    expect(screen.getByText("AI")).toBeTruthy();
  });

  it("marks only the current value selected", () => {
    const screen = render(
      <SegmentedControl
        options={OPTIONS}
        testIDPrefix="mode"
        value="template"
        onChange={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId("mode-template").props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      screen.getByTestId("mode-new").props.accessibilityState,
    ).toMatchObject({ selected: false });
  });

  it("reports the pressed option's value", () => {
    const onChange = jest.fn();
    const screen = render(
      <SegmentedControl
        options={OPTIONS}
        testIDPrefix="mode"
        value="new"
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId("mode-ai"));

    expect(onChange).toHaveBeenCalledWith("ai");
  });

  // testIDs are derived from the label so callers get stable, readable hooks
  // (`appearance-mode-system`) without declaring one per option.
  it("derives testIDs from the label, and omits them without a prefix", () => {
    const screen = render(
      <SegmentedControl options={OPTIONS} value="new" onChange={jest.fn()} />,
    );

    expect(screen.queryByTestId("mode-new")).toBe(null);
  });
});
