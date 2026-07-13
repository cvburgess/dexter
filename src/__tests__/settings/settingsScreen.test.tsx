import { fireEvent, render } from "@testing-library/react-native";

import SettingsScreen from "@/app/(app)/(tabs)/settings";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";

jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    useRouter: () => mockRouter,
    // Render a marker exposing the target href so the two-pane redirect is
    // observable without mounting a real navigator.
    Redirect: ({ href }: { href: string }) => <Text>redirect:{href}</Text>,
  };
});

const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("redirects to the first settings item in two-pane mode", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = render(<SettingsScreen />);

    expect(screen.getByText("redirect:/settings/account")).toBeTruthy();
  });

  it("renders the row list instead of redirecting in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = render(<SettingsScreen />);

    expect(screen.queryByText(/^redirect:/)).toBeNull();
    expect(screen.getByText("Account")).toBeTruthy();
  });

  it("renders a row for every settings item", () => {
    const screen = render(<SettingsScreen />);

    for (const title of [
      "Account",
      "Appearance",
      "Tasks",
      "Calendars",
      "Habits",
      "Journal",
      "Notes",
      "Licenses",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it("navigates to the matching subview when a row is pressed", () => {
    const screen = render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId("settings-row-account"));
    expect(mockRouter.push).toHaveBeenCalledWith("/settings/account");

    fireEvent.press(screen.getByTestId("settings-row-licenses"));
    expect(mockRouter.push).toHaveBeenCalledWith("/settings/licenses");
  });
});
