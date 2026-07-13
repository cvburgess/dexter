import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

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
});
