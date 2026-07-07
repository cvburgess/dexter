import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { DateField } from "../DateField.web";

const SELECTED_DATE = new Date(2026, 11, 25); // Dec 25, 2026 (month is 0-based)

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
