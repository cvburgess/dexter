import { render } from "@testing-library/react-native";

import LicensesScreen from "@/app/(app)/(tabs)/settings/licenses";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";

jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;

describe("LicensesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = render(<LicensesScreen />);

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    const screen = render(<LicensesScreen />);

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
  });

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
