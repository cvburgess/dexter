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

// The icon's only role in these assertions is carrying `color`; stub it to a
// marker that exposes that, since the real one renders an Ionicons glyph whose
// color a query can't reach.
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

  // DEX-110. The active row sinks into the sidebar rather than sitting on it as
  // a solid primary slab. `surfaceSunken` is the token because a settings row
  // *holds* content (docs/design.md's surface rule) and the sidebar around it is
  // `background` — the one step down that rule allows.
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

  // The icon and the label read one `contentColor` const, so this pins both at
  // once — and pins that it is `primary`, not the `primaryContent` that paired
  // with the old primary fill (DEX-110).
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
});
