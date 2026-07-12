import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { DayViewSwitcher, dayViewOptions, TDayView } from "../DayViewSwitcher";

// The circular button wraps native glass/SF-symbol views; stub it so the
// switcher's trigger renders the current view's SF Symbol name as text.
const mockGlassIconButton = jest.fn(({ sfSymbol }: { sfSymbol: string }) => (
  <Text>{sfSymbol}</Text>
));
jest.mock("../GlassIconButton", () => ({
  GlassIconButton: (props: { sfSymbol: string }) => mockGlassIconButton(props),
}));

describe("dayViewOptions", () => {
  const ids = (view: TDayView, notes: boolean, journal: boolean) =>
    dayViewOptions(view, jest.fn(), notes, journal).map((o) => o.id);

  it("always offers Tasks", () => {
    expect(ids("tasks", false, false)).toEqual(["tasks"]);
  });

  it("includes Notes only when enabled", () => {
    expect(ids("tasks", true, false)).toContain("notes");
    expect(ids("tasks", false, false)).not.toContain("notes");
  });

  it("includes Journal only when enabled", () => {
    expect(ids("tasks", false, true)).toContain("journal");
    expect(ids("tasks", false, false)).not.toContain("journal");
  });

  it("marks the active view as selected and no others", () => {
    const options = dayViewOptions("notes", jest.fn(), true, true);
    const selected = options.filter((o) => o.isSelected).map((o) => o.id);

    expect(selected).toEqual(["notes"]);
  });

  it("calls onChangeView with the option's id when selected", () => {
    const onChangeView = jest.fn();
    const options = dayViewOptions("tasks", onChangeView, true, true);

    options.find((o) => o.id === "journal")?.onSelect();

    expect(onChangeView).toHaveBeenCalledWith("journal");
  });
});

describe("DayViewSwitcher", () => {
  it("shows the current view's icon in the trigger", () => {
    const screen = render(
      <DayViewSwitcher
        view="notes"
        onChangeView={jest.fn()}
        enableNotes
        enableJournal
      />,
    );

    expect(screen.getByText("note.text")).toBeTruthy();
  });
});
