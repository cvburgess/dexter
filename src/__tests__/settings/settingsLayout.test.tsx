import { render } from "@testing-library/react-native";

import SettingsLayout from "@/app/(app)/(tabs)/settings/_layout";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

// Stub to a marker so this only exercises _layout's mount/unmount decision,
// not the sidebar's own internals (SettingsSidebar.test's).
jest.mock("@/components/SettingsSidebar", () => {
  const { Text } = require("react-native");
  return { SettingsSidebar: () => <Text>settings-sidebar</Text> };
});

// The real Stack needs a navigation container this test doesn't mount; render
// children through a passthrough and echo the header-ownership options.
jest.mock("expo-router", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Stack = ({ children }: { children?: React.ReactNode }) => children;
  Stack.Screen = function StackScreen({
    name,
    options,
  }: {
    name: string;
    options?: {
      title?: string;
      headerShown?: boolean;
      headerBackVisible?: boolean;
    };
  }) {
    const header = options?.headerShown === false ? "hidden" : "shown";
    // Undefined means the screen never set it, which is the platform default
    // (visible) — distinct from an explicit `false`.
    const back = options?.headerBackVisible === false ? "hidden" : "shown";
    return (
      <Text>{`screen:${name}|header:${header}|back:${back}|title:${options?.title ?? ""}`}</Text>
    );
  };
  return { Stack };
});

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

describe("SettingsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("mounts the persistent sidebar in two-pane mode", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = render(<SettingsLayout />);

    expect(screen.getByText("settings-sidebar")).toBeTruthy();
  });

  it("does not mount the sidebar in single-column mode", () => {
    mockUseIsLargeDevice.mockReturnValue(false);
    const screen = render(<SettingsLayout />);

    expect(screen.queryByText("settings-sidebar")).toBeNull();
  });

  // `tasks/index` is a nested stack's root, which gets no native back button
  // regardless of history — hiding it here stranded the list (DEX-93).
  it("owns the header for the nested tasks stack", () => {
    const screen = render(<SettingsLayout />);

    expect(
      screen.getByText("screen:tasks|header:shown|back:shown|title:Tasks"),
    ).toBeTruthy();
  });

  // The back item leads to `settings/index`; in two-pane mode the sidebar is
  // that list and never leaves, so the chevron would point at the screen itself.
  it("hides the back item in two-pane mode, keeping titles", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = render(<SettingsLayout />);

    expect(
      screen.getByText("screen:account|header:shown|back:hidden|title:Account"),
    ).toBeTruthy();
    // Including Tasks, whose back button exists for the single-column case
    // where the list would otherwise be stranded (DEX-93).
    expect(
      screen.getByText("screen:tasks|header:shown|back:hidden|title:Tasks"),
    ).toBeTruthy();
  });

  it("keeps the back item in single-column mode", () => {
    const screen = render(<SettingsLayout />);

    expect(
      screen.getByText("screen:account|header:shown|back:shown|title:Account"),
    ).toBeTruthy();
  });

  it("registers the flat lists and habits editors alongside their lists", () => {
    const screen = render(<SettingsLayout />);

    expect(
      screen.getByText(
        "screen:lists/index|header:shown|back:shown|title:Lists",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("screen:lists/[id]|header:shown|back:shown|title:List"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "screen:habits/index|header:shown|back:shown|title:Habits",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "screen:habits/[id]|header:shown|back:shown|title:Habit",
      ),
    ).toBeTruthy();
  });
});
