import { renderHook } from "@testing-library/react-native";
import { useColorScheme } from "react-native";

import { useTheme, withOpacity } from "../theme";

// `react-native`'s `useColorScheme` lazily delegates to the default export of
// this submodule (see react-native/index.js), so mocking the submodule controls
// what the typed public `useColorScheme` — and therefore `useTheme` — resolves,
// without loading the full native module registry.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe("withOpacity", () => {
  it("applies an alpha channel to a hex color", () => {
    expect(withOpacity("#593d31", 0.25)).toBe("rgba(89, 61, 49, 0.25)");
  });

  it("multiplies the existing alpha when given an rgba color", () => {
    expect(withOpacity("rgba(89, 61, 49, 0.25)", 0.1)).toBe(
      "rgba(89, 61, 49, 0.025)",
    );
  });

  it("treats an rgb color with no alpha as fully opaque before multiplying", () => {
    expect(withOpacity("rgb(89, 61, 49)", 0.5)).toBe("rgba(89, 61, 49, 0.5)");
  });
});

describe("useTheme", () => {
  afterEach(() => mockUseColorScheme.mockReset());

  it("returns the dark theme when the device reports a dark scheme", () => {
    mockUseColorScheme.mockReturnValue("dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.background).toBe("#191e24");
    expect(result.current.colors.card).toBe("#1d232a");
    expect(result.current.colors.text).toBe("#ecf9ff");
  });

  it("uses the muted daisyUI 'dim' priority accents in dark mode", () => {
    mockUseColorScheme.mockReturnValue("dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.priority).toEqual([
      "#efd057",
      "#ffae9b",
      "#28ebff",
      "#2a303c",
      "#1c212b",
    ]);
    expect(result.current.colors.priorityContent).toEqual([
      "#141003",
      "#160b09",
      "#011316",
      "#b2ccd6",
      "#b2ccd6",
    ]);
  });

  it("keeps the bolder 'dexter' priority accents in light mode", () => {
    mockUseColorScheme.mockReturnValue("light");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.priority).toEqual([
      "#fcb700",
      "#ff627d",
      "#00bafe",
      "#fffbf4",
      "#593d31",
    ]);
  });

  it("returns the light theme when the device reports a light scheme", () => {
    mockUseColorScheme.mockReturnValue("light");

    const { result } = renderHook(() => useTheme());

    expect(result.current.colors.background).toBe("#f7f1e7");
    expect(result.current.colors.card).toBe("#fffbf4");
    expect(result.current.colors.text).toBe("#593d31");
  });

  it("switches themes when the device scheme changes", () => {
    mockUseColorScheme.mockReturnValue("light");
    const { result, rerender } = renderHook(() => useTheme());
    expect(result.current.colors.background).toBe("#f7f1e7");

    mockUseColorScheme.mockReturnValue("dark");
    rerender({});
    expect(result.current.colors.background).toBe("#191e24");
  });
});
