import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { DateField } from "../DateField.web";
import { WebOverlay } from "../WebOverlay.web";

const SELECTED_DATE = new Date(2026, 11, 25); // Dec 25, 2026 (month is 0-based)

// The popover reaches the screen through `WebOverlay`, which portals it to
// `document.body` at runtime; render it inline here so react-test-renderer
// keeps it in the tree for RNTL queries.
jest.mock("react-dom", () =>
  require("@/testUtils/mockReactDomPortal").mockReactDomPortal(),
);

// react-day-picker is a DOM calendar with no test double; stand it in with a
// pressable that fires `onSelect` so we can exercise the field's wiring. Its
// stylesheet import is stubbed so Jest doesn't try to parse CSS as JS.
const mockDayPicker = jest.fn((props: { onSelect: (date: Date) => void }) => (
  <Pressable testID="rdp-day" onPress={() => props.onSelect(SELECTED_DATE)}>
    <Text>25</Text>
  </Pressable>
));
jest.mock("react-day-picker/style.css", () => ({}));
jest.mock("react-day-picker", () => ({
  DayPicker: (props: Parameters<typeof mockDayPicker>[0]) =>
    mockDayPicker(props),
}));

const getTrigger = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_root.findByProps({ "data-testid": "field" });

describe("DateField (web)", () => {
  it("renders the value as a Weekday, Mon D label", () => {
    const screen = render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={jest.fn()}
      />,
    );

    expect(getTrigger(screen).props.children).toBe("Friday, Jul 3");
  });

  it("does not open the calendar until the trigger is pressed", () => {
    const screen = render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("rdp-day")).toBeNull();

    fireEvent(getTrigger(screen), "click");

    expect(screen.queryByTestId("rdp-day")).not.toBeNull();
  });

  // Not decoration: a raw `createPortal` here rendered a calendar that painted
  // over the new-task modal and swallowed every click, because a body portal
  // inherits the `pointer-events: none` Radix puts on the body (DEX-134). Only
  // `WebOverlay` re-declares `auto`. jsdom has no vaul in the tree, so this can
  // prove the routing but not the click — that part is manual.
  it("renders the calendar through WebOverlay", () => {
    const screen = render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={jest.fn()}
      />,
    );

    expect(screen.UNSAFE_root.findAllByType(WebOverlay)).toHaveLength(0);

    fireEvent(getTrigger(screen), "click");

    expect(screen.UNSAFE_root.findAllByType(WebOverlay)).toHaveLength(1);
  });

  it("calls onChange with the picked Date and closes the calendar", () => {
    const onChange = jest.fn<void, [Date]>();
    const screen = render(
      <DateField
        testID="field"
        value={new Date(2026, 6, 3)}
        onChange={onChange}
      />,
    );

    fireEvent(getTrigger(screen), "click");
    fireEvent.press(screen.getByTestId("rdp-day"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(SELECTED_DATE);
    expect(screen.queryByTestId("rdp-day")).toBeNull();
  });
});
