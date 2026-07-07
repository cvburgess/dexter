import { fireEvent, render } from "@testing-library/react-native";

import { DateField } from "../DateField.web";

// The web field is a raw `<input type="date">`, which RNTL's TextInput-oriented
// queries don't recognize; reach it through the test-renderer tree instead.
const getDateInput = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_root.findByProps({ type: "date" });

describe("DateField (web)", () => {
  it("renders the value as a YYYY-MM-DD input value in local time", () => {
    const screen = render(
      <DateField value={new Date(2026, 6, 3)} onChange={jest.fn()} />,
    );

    expect(getDateInput(screen).props.value).toBe("2026-07-03");
  });

  it("parses the picked YYYY-MM-DD string into a local Date", () => {
    const onChange = jest.fn<void, [Date]>();
    const screen = render(
      <DateField value={new Date(2026, 6, 3)} onChange={onChange} />,
    );

    fireEvent(getDateInput(screen), "change", {
      target: { value: "2026-12-25" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const picked = onChange.mock.calls[0][0];
    expect(picked.getFullYear()).toBe(2026);
    expect(picked.getMonth()).toBe(11); // December (0-based)
    expect(picked.getDate()).toBe(25);
  });

  it("ignores a cleared input instead of emitting an invalid date", () => {
    const onChange = jest.fn();
    const screen = render(
      <DateField value={new Date(2026, 6, 3)} onChange={onChange} />,
    );

    fireEvent(getDateInput(screen), "change", { target: { value: "" } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
