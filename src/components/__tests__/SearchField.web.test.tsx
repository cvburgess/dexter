import { fireEvent, render, screen } from "@testing-library/react-native";

import { SearchField } from "../SearchField.web";

// The `.web` implementation is imported directly rather than mocking
// `Platform.OS`, per docs/testing.md. Its native sibling is `Stack.SearchBar`,
// which renders null and is only exercisable on a device — hence this file
// covers the half that a unit test can actually reach, which is also the half
// that would silently disappear if the platform split were ever collapsed.

describe("SearchField (web)", () => {
  it("renders a controlled field labelled for search", () => {
    render(
      <SearchField
        value="milk"
        onChangeText={jest.fn()}
        placeholder="Search"
      />,
    );

    const field = screen.getByLabelText("Search");
    expect(field.props.value).toBe("milk");
    expect(field.props.placeholder).toBe("Search");
  });

  it("reports what the user types as a plain string", () => {
    const onChangeText = jest.fn();
    render(
      <SearchField value="" onChangeText={onChangeText} placeholder="Search" />,
    );

    fireEvent.changeText(screen.getByLabelText("Search"), "milk");

    // The shared contract is a string. The native half has to unwrap
    // `event.nativeEvent.text` to match it, since react-native-screens' search
    // bar reports a NativeSyntheticEvent rather than the text.
    expect(onChangeText).toHaveBeenCalledWith("milk");
  });

  it("does not autocapitalize or autocorrect a query", () => {
    render(
      <SearchField value="" onChangeText={jest.fn()} placeholder="Search" />,
    );

    const field = screen.getByLabelText("Search");
    expect(field.props.autoCapitalize).toBe("none");
    expect(field.props.autoCorrect).toBe(false);
  });
});
