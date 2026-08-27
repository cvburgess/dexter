import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { GlassIconButton } from "../GlassIconButton";

// jest-expo resolves the .ios variant (SymbolView); render the symbol name as
// text, overriding jest.setup's null SymbolView for this file.
const mockSymbolView = jest.fn(({ name }: { name: string }) => (
  <Text>{name}</Text>
));
jest.mock("expo-symbols", () => ({
  SymbolView: (props: { name: string }) => mockSymbolView(props),
}));

describe("GlassIconButton", () => {
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
    expect(screen.getByLabelText("Backlog, needs attention")).toBeTruthy();
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
