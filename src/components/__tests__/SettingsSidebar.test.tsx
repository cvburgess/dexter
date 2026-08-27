import { render, renderHook, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

import { useTheme } from "@/utils/theme";

import { SettingsSidebar } from "../SettingsSidebar";

const mockReplace = jest.fn();
let mockPathname = "/settings/account";
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

// Stubbed to a marker exposing `color`, since the real Ionicons glyph's
// color isn't queryable.
jest.mock("@/components/SettingsIcon", () => ({
  SettingsIcon: ({ color, name }: { color: string; name: string }) => {
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <View testID={`icon-${name}`} style={{ backgroundColor: color }} />;
  },
}));

/**
 * The palette the component itself resolves. Read through the hook rather than
 * indexing `themes` directly, because with no ThemeProvider mounted `useTheme`
 * falls back on the *system* color scheme — so naming a theme here would pin
 * the test to whichever one Jest's scheme happens to select.
 */
const themeColors = () => renderHook(() => useTheme()).result.current.colors;

/** A row's own style, flattened — `styles.row` plus the inline themed half. */
const rowStyle = (slug: string) =>
  StyleSheet.flatten(
    screen.getByTestId(`settings-sidebar-${slug}`).props.style as ViewStyle[],
  );

const labelColor = (text: string) =>
  StyleSheet.flatten(screen.getByText(text).props.style as TextStyle[]).color;

describe("SettingsSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/settings/account";
  });

  it("marks the routed destination as selected", () => {
    render(<SettingsSidebar />);

    expect(
      screen.getByTestId("settings-sidebar-account").props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      screen.getByTestId("settings-sidebar-appearance").props.accessibilityState
        .selected,
    ).toBe(false);
  });

  // DEX-110: the active row sinks into the sidebar rather than a solid
  // primary slab — surfaceSunken is the one step down background allows.
  it("fills the selected row with the sunken surface, not the primary color", () => {
    const colors = themeColors();
    render(<SettingsSidebar />);

    expect(rowStyle("account").backgroundColor).toBe(colors.surfaceSunken);
    expect(rowStyle("account").backgroundColor).not.toBe(colors.primary);
  });

  it("leaves an unselected row unfilled", () => {
    render(<SettingsSidebar />);

    expect(rowStyle("appearance").backgroundColor).toBe("transparent");
  });

  // Pins both from one contentColor const — primary, not the primaryContent
  // that paired with the old primary fill (DEX-110).
  it("inks the selected row's icon and label with the primary color", () => {
    const colors = themeColors();
    render(<SettingsSidebar />);

    const icon = StyleSheet.flatten(
      screen.getByTestId("icon-person-circle-outline").props
        .style as ViewStyle[],
    );

    expect(icon.backgroundColor).toBe(colors.primary);
    expect(labelColor("Account")).toBe(colors.primary);
  });

  it("inks an unselected row with the ordinary text color", () => {
    const colors = themeColors();
    render(<SettingsSidebar />);

    expect(labelColor("Appearance")).toBe(colors.text);
  });

  // Asserted against each other, not a literal — alignment is the
  // requirement, whichever token it ends up being.
  it("lines the heading up with the rows' content, not the pane's edge", () => {
    render(<SettingsSidebar />);

    const heading = StyleSheet.flatten(
      screen.getByText("Settings").props.style as TextStyle[],
    );

    expect(heading.paddingHorizontal).toBe(
      rowStyle("account").paddingHorizontal,
    );
  });
});
