import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { themes } from "@/utils/theme";

import { GlassIconButton } from "../GlassIconButton";

// Render the SF Symbol name as text so we can assert on the icon (jest-expo
// resolves the .ios variant, which uses SymbolView). Overrides jest.setup's
// null SymbolView for this file.
const mockSymbolView = jest.fn(({ name }: { name: string }) => (
  <Text>{name}</Text>
));
jest.mock("expo-symbols", () => ({
  SymbolView: (props: { name: string }) => mockSymbolView(props),
}));

describe("GlassIconButton", () => {
  it("renders the icon and exposes its accessibility label", () => {
    const screen = render(
      <GlassIconButton
        sfSymbol="book"
        ionicon="book-outline"
        accessibilityLabel="Open menu"
      />,
    );

    expect(screen.getByText("book")).toBeTruthy();
    expect(screen.getByLabelText("Open menu")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const screen = render(
      <GlassIconButton
        sfSymbol="book"
        ionicon="book-outline"
        accessibilityLabel="Open menu"
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByLabelText("Open menu"));

    expect(onPress).toHaveBeenCalled();
  });

  it("tints the icon primary when active is undefined (default)", () => {
    render(
      <GlassIconButton
        sfSymbol="book"
        ionicon="book-outline"
        accessibilityLabel="Toggle"
      />,
    );

    expect(mockSymbolView).toHaveBeenLastCalledWith(
      expect.objectContaining({ tintColor: themes.dexter.colors.primary }),
    );
  });

  it("tints the icon primary when active is true", () => {
    render(
      <GlassIconButton
        active
        sfSymbol="book"
        ionicon="book-outline"
        accessibilityLabel="Toggle"
      />,
    );

    expect(mockSymbolView).toHaveBeenLastCalledWith(
      expect.objectContaining({ tintColor: themes.dexter.colors.primary }),
    );
  });

  it("tints the icon text color when active is false", () => {
    render(
      <GlassIconButton
        active={false}
        sfSymbol="book"
        ionicon="book-outline"
        accessibilityLabel="Toggle"
      />,
    );

    expect(mockSymbolView).toHaveBeenLastCalledWith(
      expect.objectContaining({ tintColor: themes.dexter.colors.text }),
    );
  });

  it("shows the attention dot and annotates the label when indicator is true", () => {
    const screen = render(
      <GlassIconButton
        indicator
        sfSymbol="tray.full"
        ionicon="file-tray-full-outline"
        accessibilityLabel="Backlog"
      />,
    );

    expect(screen.getByTestId("attention-indicator")).toBeTruthy();
    expect(
      screen.getByLabelText("Backlog with overdue or left behind tasks"),
    ).toBeTruthy();
  });

  it("omits the attention dot when indicator is falsy", () => {
    const screen = render(
      <GlassIconButton
        sfSymbol="tray.full"
        ionicon="file-tray-full-outline"
        accessibilityLabel="Backlog"
      />,
    );

    expect(screen.queryByTestId("attention-indicator")).toBeNull();
    expect(screen.getByLabelText("Backlog")).toBeTruthy();
  });
});
