import { render } from "@testing-library/react-native";
import { Children, isValidElement, type ReactNode } from "react";

import { createRitualState, type TRitualState } from "@/utils/ritualSteps";

import { RitualStepSegments } from "../RitualStepSegments";
import { STEP_ICONS } from "../RitualStepSwitcher.shared";

// jest-expo resolves the `.ios` variant, which hosts a real SwiftUI Picker.
// The global mock in jest.setup renders those as null; capture them here
// instead so the segments and their modifiers can be asserted. The captured
// props live at module scope because a `jest.mock` factory is hoisted above the
// test file's own `const`s (the same reason `testUtils/mockExpoUiPicker` does).
let pickerProps: Record<string, unknown> | null = null;
jest.mock("@expo/ui/swift-ui", () => ({
  Host: ({ children }: { children: ReactNode }) => children,
  Image: () => null,
  Picker: (props: Record<string, unknown>) => {
    pickerProps = props;
    return null;
  },
}));

// Identifiable stand-ins, so a modifier can be asserted rather than just
// counted — `pickerStyle("segmented")` is the whole point of this component.
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  accessibilityLabel: (label: string) => ({ accessibilityLabel: label }),
  pickerStyle: (style: string) => ({ pickerStyle: style }),
  tag: (value: number) => ({ tag: value }),
}));

type TSegment = {
  systemName: string;
  modifiers: Record<string, unknown>[];
};

const segments = (): TSegment[] =>
  Children.toArray(pickerProps?.children as ReactNode)
    .filter(isValidElement)
    .map((child) => child.props as TSegment);

const modifier = (segment: TSegment, key: string) =>
  segment.modifiers.find((entry) => key in entry)?.[key];

const state = (overrides: Partial<TRitualState> = {}): TRitualState => ({
  ...createRitualState(undefined, "am"),
  ...overrides,
});

const renderSegments = (
  props: Partial<Parameters<typeof RitualStepSegments>[0]> = {},
) =>
  render(
    <RitualStepSegments onSelectStep={jest.fn()} state={state()} {...props} />,
  );

beforeEach(() => {
  pickerProps = null;
});

describe("RitualStepSegments on iOS", () => {
  // The reason this file exists rather than reusing the drawn control: a real
  // UISegmentedControl is what the system draws in liquid glass on iOS 26.
  it("hosts a native segmented picker", () => {
    renderSegments();

    expect(pickerProps?.modifiers).toContainEqual({ pickerStyle: "segmented" });
  });

  it("renders one segment per step of the active ritual", () => {
    renderSegments({ state: state({ mode: "pm" }) });

    expect(segments().map((segment) => segment.systemName)).toEqual([
      STEP_ICONS["open-tasks"].sf,
      STEP_ICONS.review.sf,
      STEP_ICONS.journal.sf,
      STEP_ICONS["preview-tomorrow"].sf,
      STEP_ICONS.congrats.sf,
    ]);
  });

  it("tags each segment with its step index", () => {
    renderSegments();

    expect(segments().map((segment) => modifier(segment, "tag"))).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  // An Image segment has no text, so without this VoiceOver announces nothing.
  it("names every segment for VoiceOver", () => {
    renderSegments();

    expect(
      segments().map((segment) => modifier(segment, "accessibilityLabel")),
    ).toEqual([
      "Horoscope",
      "Journal",
      "Calendar",
      "Backlog",
      "Tasks",
      "Congrats",
    ]);
  });

  it("selects the step on screen", () => {
    renderSegments({ state: state({ step: 3 }) });

    expect(pickerProps?.selection).toBe(3);
  });

  it("jumps to the picked step", () => {
    const onSelectStep = jest.fn();
    renderSegments({ onSelectStep });

    (pickerProps?.onSelectionChange as (value: number) => void)(2);

    expect(onSelectStep).toHaveBeenCalledWith(2);
  });

  // The tag comes back raw, and the universal picker is already documented as
  // handing its value over as a string (`PickerField`). `goToStep` compares it
  // against a numeric index, so a string would never match a step.
  it("coerces a string selection back to an index", () => {
    const onSelectStep = jest.fn();
    renderSegments({ onSelectStep });

    (pickerProps?.onSelectionChange as (value: unknown) => void)("4");

    expect(onSelectStep).toHaveBeenCalledWith(4);
  });
});
