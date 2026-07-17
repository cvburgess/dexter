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
  const ids = (
    view: TDayView,
    notes: boolean,
    journal: boolean,
    calendar = false,
  ) =>
    dayViewOptions(view, jest.fn(), notes, journal, calendar).map((o) => o.id);

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

  it("includes Calendar only when enabled", () => {
    expect(ids("tasks", false, false, true)).toContain("calendar");
    expect(ids("tasks", false, false, false)).not.toContain("calendar");
  });

  it("marks the active view as selected and no others", () => {
    const options = dayViewOptions("notes", jest.fn(), true, true, true);
    const selected = options.filter((o) => o.isSelected).map((o) => o.id);

    expect(selected).toEqual(["notes"]);
  });

  it("calls onChangeView with the option's id when selected", () => {
    const onChangeView = jest.fn();
    const options = dayViewOptions("tasks", onChangeView, true, true, true);

    options.find((o) => o.id === "calendar")?.onSelect();

    expect(onChangeView).toHaveBeenCalledWith("calendar");
  });
});

describe("DayViewSwitcher", () => {
  beforeEach(() => mockGlassIconButton.mockClear());

  it("shows the current view's icon in the trigger", () => {
    const screen = render(
      <DayViewSwitcher
        view="notes"
        onChangeView={jest.fn()}
        enableNotes
        enableJournal
        enableCalendar
      />,
    );

    expect(screen.getByText("note.text")).toBeTruthy();
  });

  it("forwards `attention` to the trigger button as its indicator", () => {
    render(
      <DayViewSwitcher
        view="tasks"
        onChangeView={jest.fn()}
        attention
        enableNotes={false}
        enableJournal={false}
        enableCalendar={false}
      />,
    );

    expect(mockGlassIconButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ indicator: true }),
    );
  });

  it("leaves the indicator unset when `attention` is omitted", () => {
    render(
      <DayViewSwitcher
        view="tasks"
        onChangeView={jest.fn()}
        enableNotes={false}
        enableJournal={false}
        enableCalendar={false}
      />,
    );

    expect(mockGlassIconButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ indicator: undefined }),
    );
  });
});
