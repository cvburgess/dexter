import { render } from "@testing-library/react-native";

import SettingsLayout from "@/app/(app)/(tabs)/settings/_layout";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

// Stub the sidebar to a marker so this test only exercises _layout's own
// mount/unmount decision, not the sidebar's internals (its own tests cover
// those).
jest.mock("@/components/SettingsSidebar", () => {
  const { Text } = require("react-native");
  return { SettingsSidebar: () => <Text>settings-sidebar</Text> };
});

// The real Stack/Stack.Screen require a navigation container this unit test
// doesn't mount; render children through a passthrough so the wrapping View
// structure around the sidebar is still exercised. Stack.Screen echoes the
// options that decide who owns each screen's header, so they're assertable.
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

  // Tasks is the one section that is a nested stack of its own, and this stack
  // has to keep its header: `tasks/index` is that nested stack's root, and a
  // stack's root screen gets no native back button however much history sits
  // under the navigator. Hiding it here is what stranded the Tasks list with
  // the tab bar as its only way out (DEX-93).
  it("owns the header for the nested tasks stack", () => {
    const screen = render(<SettingsLayout />);

    expect(
      screen.getByText("screen:tasks|header:shown|back:shown|title:Tasks"),
    ).toBeTruthy();
  });

  // The back item leads to `settings/index`, the list of sections. In two-pane
  // mode the sidebar is that list and never leaves, so the chevron points at
  // something already on screen. Titles are unaffected — only the back item.
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
