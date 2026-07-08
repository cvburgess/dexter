import { fireEvent, render } from "@testing-library/react-native";

import SettingsScreen from "@/app/(app)/(tabs)/settings";

const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
