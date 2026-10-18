import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import type { IconMenuProps } from "@/components/IconMenu";
import { MODE_META } from "@/components/RitualModeButton";

import { JournalPeriodMenu, journalPeriodSections } from "../JournalPeriodMenu";

// The renderer keeps only host elements, so stand the menu in as a View that
// carries the props the real one hands its native host.
jest.mock("@/components/IconMenu", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    IconMenu: ({ accessibilityLabel, style, children }: IconMenuProps) => (
      <View accessibilityLabel={accessibilityLabel} style={style}>
        {children}
      </View>
    ),
  };
});

describe("journalPeriodSections", () => {
  it("offers the two rituals, in the order the day runs", () => {
    const options = journalPeriodSections("am", jest.fn())[0].options;

    expect(options.map((option) => option.id)).toEqual(["am", "pm"]);
    expect(options.map((option) => option.title)).toEqual([
      "Morning",
      "Evening",
    ]);
  });

  // Named from `MODE_META` rather than spelled out again, so this and the
  // ritual's AM/PM button can't drift apart.
  it("takes its icons from the ritual mode button's table", () => {
    const options = journalPeriodSections("am", jest.fn())[0].options;

    expect(options[0].icon).toBe(MODE_META.am.icon);
    expect(options[1].icon).toBe(MODE_META.pm.icon);
  });

  it("checkmarks the ritual the prompt currently belongs to", () => {
    expect(
      journalPeriodSections("pm", jest.fn())[0].options.map(
        (option) => option.isSelected,
      ),
    ).toEqual([false, true]);
  });

  it("reports the chosen ritual", () => {
    const onChange = jest.fn();

    journalPeriodSections("am", onChange)[0].options[1].onSelect();

    expect(onChange).toHaveBeenCalledWith("pm");
  });

  // Re-choosing the current ritual still reports: the write is idempotent, and
  // swallowing it would make the two rows behave differently for no reason.
  it("still reports a ritual the prompt is already in", () => {
    const onChange = jest.fn();

    journalPeriodSections("am", onChange)[0].options[0].onSelect();

    expect(onChange).toHaveBeenCalledWith("am");
  });
});

describe("JournalPeriodMenu", () => {
  // The `MenuView` double drops every prop, so the menu's own props are the
  // seam. This is all a screen reader gets: which prompt, and which ritual.
  it("names the prompt and its current ritual", async () => {
    const screen = await render(
      <JournalPeriodMenu period="pm" promptNumber={2} onChange={jest.fn()} />,
    );

    expect(
      screen.getByLabelText("Journal prompt 2 ritual: evening"),
    ).toBeOnTheScreen();
  });

  // Left to flex, the native menu host reports zero height and collapses the
  // row — the note `StatusButton` and `ListButton` both carry.
  it("pins the menu host to the trigger's exact size", async () => {
    const screen = await render(
      <JournalPeriodMenu period="am" promptNumber={1} onChange={jest.fn()} />,
    );

    const style = StyleSheet.flatten(
      screen.getByLabelText("Journal prompt 1 ritual: morning").props.style,
    );
    expect(style?.height).toBeGreaterThan(0);
    expect(style?.width).toBe(style?.height);
  });
});
