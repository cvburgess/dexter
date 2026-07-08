import { render } from "@testing-library/react-native";

import LicensesScreen from "@/app/(app)/(tabs)/settings/licenses";

describe("LicensesScreen", () => {
  it("renders the intro header", () => {
    const screen = render(<LicensesScreen />);

    expect(
      screen.getByText("This app uses the following open source libraries:"),
    ).toBeTruthy();
  });

  it("lists dependencies with their licenses", () => {
    const screen = render(<LicensesScreen />);

    // The list is sorted alphabetically, so scoped "@…" packages render first
    // (well within the FlatList's initial render window).
    expect(screen.getByText("@expo/ui")).toBeTruthy();
    expect(screen.getByText("@tanstack/react-query")).toBeTruthy();

    // Every rendered library shows a "License: <spdx>" line.
    expect(screen.getAllByText(/^License: /).length).toBeGreaterThan(0);
  });
});
