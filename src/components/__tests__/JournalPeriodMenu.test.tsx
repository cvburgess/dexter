import { render } from "@testing-library/react-native";

import { IconMenu } from "@/components/IconMenu";
import { MODE_META } from "@/components/RitualModeButton";

import { JournalPeriodMenu, journalPeriodSections } from "../JournalPeriodMenu";

describe("journalPeriodSections", () => {
  it("offers the two rituals, in the order the day runs", () => {
    const options = journalPeriodSections("am", jest.fn())[0].options;

    expect(options.map((option) => option.id)).toEqual(["am", "pm"]);
    expect(options.map((option) => option.title)).toEqual([
      "Morning",
      "Evening",
    ]);
  });

  // Named from `MODE_META` rather than spelled out again, so the menu and the
  // ritual's own AM/PM button can't come to call the halves of the day
  // different things.
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

  // Choosing the ritual it is already in is a no-op to the caller, not a
  // suppressed one here: the screen's write is idempotent, and swallowing it
  // would make the menu's two rows behave differently for no visible reason.
  it("still reports a ritual the prompt is already in", () => {
    const onChange = jest.fn();

    journalPeriodSections("am", onChange)[0].options[0].onSelect();

    expect(onChange).toHaveBeenCalledWith("am");
  });
});

describe("JournalPeriodMenu", () => {
  // The `MenuView` double renders only the trigger and drops every prop, so
  // the menu's own props are the seam. This is what a screen reader has to go
  // on: which prompt, and which ritual it is in today.
  it("names the prompt and its current ritual", () => {
    const screen = render(
      <JournalPeriodMenu period="pm" promptNumber={2} onChange={jest.fn()} />,
    );

    expect(screen.UNSAFE_getByType(IconMenu).props.accessibilityLabel).toBe(
      "Journal prompt 2 ritual: evening",
    );
  });

  // Left to flex, the native menu host reports zero height while sizing and
  // collapses the row it sits in — the note `StatusButton` and `ListButton`
  // both carry.
  it("pins the menu host to the trigger's exact size", () => {
    const screen = render(
      <JournalPeriodMenu period="am" promptNumber={1} onChange={jest.fn()} />,
    );

    const { style } = screen.UNSAFE_getByType(IconMenu).props;
    expect(style.height).toBeGreaterThan(0);
    expect(style.width).toBe(style.height);
  });
});
