import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

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

  // For the Ritual toolbar, where glyphs fit but six words wouldn't — iOS
  // hosts a real UISegmentedControl instead (RitualStepSegments.ios).
  describe("icon segments", () => {
    const ICON_OPTIONS = [
      {
        value: "am",
        label: "Morning",
        icon: { sf: "sun.max" as const, ionicon: "sunny-outline" as const },
      },
      {
        value: "pm",
        label: "Evening",
        icon: { sf: "moon" as const, ionicon: "moon-outline" as const },
      },
    ];

    // An icon segment has no text, so the label has to reach the screen reader
    // some other way or the segment announces nothing.
    it("names an icon segment with its label", () => {
      const screen = render(
        <SegmentedControl
          options={ICON_OPTIONS}
          value="am"
          onChange={jest.fn()}
        />,
      );

      expect(screen.queryByText("Morning")).toBeNull();
      expect(screen.getByLabelText("Morning")).toBeTruthy();
    });

    it("still reports the pressed segment's value", () => {
      const onChange = jest.fn();
      const screen = render(
        <SegmentedControl
          options={ICON_OPTIONS}
          value="am"
          onChange={onChange}
        />,
      );

      fireEvent.press(screen.getByLabelText("Evening"));

      expect(onChange).toHaveBeenCalledWith("pm");
    });
  });

  // A toolbar row has no width of its own for `flex: 1` segments to divide —
  // they'd collapse to nothing without content-sizing.
  describe("stretch", () => {
    const segmentFlex = (value: boolean | undefined) => {
      const screen = render(
        <SegmentedControl
          options={OPTIONS}
          stretch={value}
          testIDPrefix="mode"
          value="new"
          onChange={jest.fn()}
        />,
      );

      return StyleSheet.flatten(screen.getByTestId("mode-new").props.style)
        .flex;
    };

    it("divides the container by default", () => {
      expect(segmentFlex(undefined)).toBe(1);
    });

    it("sizes to content when off", () => {
      expect(segmentFlex(false)).toBeUndefined();
    });
  });
});
