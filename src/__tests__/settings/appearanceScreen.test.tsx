import { fireEvent, render } from "@testing-library/react-native";

import AppearanceScreen from "@/app/(app)/(tabs)/settings/appearance";
import { EThemeMode } from "@/api/preferences";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUpdate = jest.fn();

const mockPreferences = (
  overrides: Partial<{
    themeMode: EThemeMode;
    lightTheme: string;
    darkTheme: string;
  }> = {},
) => {
  mockUsePreferences.mockReturnValue([
    {
      themeMode: EThemeMode.SYSTEM,
      lightTheme: "dexter",
      darkTheme: "dark",
      ...overrides,
    } as never,
    { updatePreferences: mockUpdate },
  ]);
};

const renderWith = (overrides = {}) => {
  mockPreferences(overrides);
  return render(<AppearanceScreen />);
};

describe("AppearanceScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the mode control and both theme sections in SYSTEM mode", () => {
    const screen = renderWith();

    expect(screen.getByTestId("appearance-mode-system")).toBeTruthy();
    // Light themes
    expect(screen.getByTestId("appearance-theme-dexter")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-light")).toBeTruthy();
    // Dark themes
    expect(screen.getByTestId("appearance-theme-dim")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-dark")).toBeTruthy();
    expect(screen.getByTestId("appearance-theme-abyss")).toBeTruthy();
  });

  it("saves the mode when a mode pill is pressed", () => {
    const screen = renderWith();

    fireEvent.press(screen.getByTestId("appearance-mode-dark"));

    expect(mockUpdate).toHaveBeenCalledWith({ themeMode: EThemeMode.DARK });
  });

  it("saves the light theme when a light card is pressed", () => {
    const screen = renderWith();

    fireEvent.press(screen.getByTestId("appearance-theme-light"));

    expect(mockUpdate).toHaveBeenCalledWith({ lightTheme: "light" });
  });

  it("saves the dark theme when a dark card is pressed", () => {
    const screen = renderWith();

    fireEvent.press(screen.getByTestId("appearance-theme-abyss"));

    expect(mockUpdate).toHaveBeenCalledWith({ darkTheme: "abyss" });
  });

  it("hides the dark section when the mode is forced to LIGHT", () => {
    const screen = renderWith({ themeMode: EThemeMode.LIGHT });

    expect(screen.getByTestId("appearance-theme-dexter")).toBeTruthy();
    expect(screen.queryByTestId("appearance-theme-abyss")).toBeNull();
  });

  it("hides the light section when the mode is forced to DARK", () => {
    const screen = renderWith({ themeMode: EThemeMode.DARK });

    expect(screen.getByTestId("appearance-theme-abyss")).toBeTruthy();
    expect(screen.queryByTestId("appearance-theme-dexter")).toBeNull();
  });
});
