import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { TTodayPanes } from "@/hooks/useTodayPanes";

import { DayPaneToggles, paneToggleOptions } from "../DayPaneToggles";

// The circular buttons wrap native glass/SF-symbol views; stub them so each
// toggle renders its SF Symbol name as text and exposes its a11y label/press.
const mockGlassIconButton = jest.fn(
  ({
    sfSymbol,
    accessibilityLabel,
    onPress,
  }: {
    sfSymbol: string;
    accessibilityLabel: string;
    onPress?: () => void;
  }) => (
    <Text accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {sfSymbol}
    </Text>
  ),
);
jest.mock("../GlassIconButton", () => ({
  GlassIconButton: (props: {
    sfSymbol: string;
    accessibilityLabel: string;
    onPress?: () => void;
  }) => mockGlassIconButton(props),
}));

const allOpen: TTodayPanes = {
  notes: true,
  journal: true,
  calendar: true,
  drawer: false,
};

describe("paneToggleOptions", () => {
  const panesFor = (
    notes: boolean,
    journal: boolean,
    calendar: boolean,
  ): TTodayPanes => ({
    notes,
    journal,
    calendar,
    drawer: false,
  });

  it("offers nothing when every pane is disabled in settings", () => {
    const options = paneToggleOptions(allOpen, jest.fn(), false, false, false);
    expect(options).toEqual([]);
  });

  it("includes Notes only when enabled", () => {
    const options = paneToggleOptions(allOpen, jest.fn(), true, false, false);
    expect(options.map((o) => o.pane)).toEqual(["notes"]);
  });

  it("includes Journal only when enabled", () => {
    const options = paneToggleOptions(allOpen, jest.fn(), false, true, false);
    expect(options.map((o) => o.pane)).toEqual(["journal"]);
  });

  it("includes Calendar only when enabled", () => {
    const options = paneToggleOptions(allOpen, jest.fn(), false, false, true);
    expect(options.map((o) => o.pane)).toEqual(["calendar"]);
  });

  it("reflects each pane's current on/off state", () => {
    const panes = panesFor(false, true, false);
    const options = paneToggleOptions(panes, jest.fn(), true, true, true);

    expect(options.find((o) => o.pane === "notes")?.active).toBe(false);
    expect(options.find((o) => o.pane === "journal")?.active).toBe(true);
    expect(options.find((o) => o.pane === "calendar")?.active).toBe(false);
  });

  it("calls onTogglePane with the option's pane when toggled", () => {
    const onTogglePane = jest.fn();
    const options = paneToggleOptions(allOpen, onTogglePane, true, true, true);

    options.find((o) => o.pane === "calendar")?.onToggle();

    expect(onTogglePane).toHaveBeenCalledWith("calendar");
  });
});

describe("DayPaneToggles", () => {
  it("renders a button per enabled pane", () => {
    const screen = render(
      <DayPaneToggles
        panes={allOpen}
        onTogglePane={jest.fn()}
        enableNotes
        enableJournal
        enableCalendar={false}
      />,
    );

    expect(screen.getByLabelText("Toggle notes pane")).toBeTruthy();
    expect(screen.getByLabelText("Toggle journal pane")).toBeTruthy();
    expect(screen.queryByLabelText("Toggle calendar pane")).toBeNull();
  });

  it("toggles a pane when its button is pressed", () => {
    const onTogglePane = jest.fn();
    const screen = render(
      <DayPaneToggles
        panes={allOpen}
        onTogglePane={onTogglePane}
        enableNotes
        enableJournal
        enableCalendar
      />,
    );

    fireEvent.press(screen.getByLabelText("Toggle calendar pane"));

    expect(onTogglePane).toHaveBeenCalledWith("calendar");
  });

  it("never renders a toggle for the task drawer pane", () => {
    // The task drawer (DEX-33) is a standalone header button, not one of
    // this component's Notes/Journal/Calendar toggles.
    const screen = render(
      <DayPaneToggles
        panes={allOpen}
        onTogglePane={jest.fn()}
        enableNotes
        enableJournal
        enableCalendar
      />,
    );

    expect(screen.queryByLabelText("Toggle drawer pane")).toBeNull();
  });
});
