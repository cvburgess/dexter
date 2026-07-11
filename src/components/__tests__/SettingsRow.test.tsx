import { fireEvent, render } from "@testing-library/react-native";

import { SettingsRow } from "../SettingsRow";

describe("SettingsRow", () => {
  it("renders the title and subtitle", () => {
    const screen = render(
      <SettingsRow
        icon="person-circle-outline"
        title="Account"
        subtitle="Manage your account and sign out"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("Manage your account and sign out")).toBeTruthy();
  });

  it("calls onPress when the row is pressed", () => {
    const onPress = jest.fn();
    const screen = render(
      <SettingsRow
        icon="color-palette-outline"
        title="Appearance"
        subtitle="Theme and display options"
        onPress={onPress}
        testID="settings-row-appearance"
      />,
    );

    fireEvent.press(screen.getByTestId("settings-row-appearance"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
