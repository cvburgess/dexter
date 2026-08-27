import { render } from "@testing-library/react-native";
import { Children, isValidElement, type ReactNode } from "react";

import { createRitualState, type TRitualState } from "@/utils/ritualSteps";

import { RitualStepSegments } from "../RitualStepSegments";
import { STEP_ICONS } from "../RitualStepSwitcher.shared";

// jest.setup's global mock renders SwiftUI Picker as null; captured here
// instead so segments/modifiers can be asserted. Module scope — jest.mock hoists above consts.
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
  glassEffect: (params: unknown) => ({ glassEffect: params }),
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
      STEP_ICONS.breathe.sf,
      STEP_ICONS["open-tasks"].sf,
      STEP_ICONS.review.sf,
      STEP_ICONS.journal.sf,
      STEP_ICONS["preview-tomorrow"].sf,
    ]);
  });

  it("tags each segment with its step index", () => {
    renderSegments();

    expect(segments().map((segment) => modifier(segment, "tag"))).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  // An Image segment has no text, so without this VoiceOver announces nothing.
  it("names every segment for VoiceOver", () => {
    renderSegments();

    expect(
      segments().map((segment) => modifier(segment, "accessibilityLabel")),
    ).toEqual(["Horoscope", "Journal", "Calendar", "Backlog", "Summary"]);
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

  // The tag comes back as a string (PickerField), but goToStep compares
  // against a numeric index — a string would never match.
  it("coerces a string selection back to an index", () => {
    const onSelectStep = jest.fn();
    renderSegments({ onSelectStep });

    (pickerProps?.onSelectionChange as (value: unknown) => void)("4");

    expect(onSelectStep).toHaveBeenCalledWith(4);
  });
});
