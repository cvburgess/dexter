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
// structure around the sidebar is still exercised.
jest.mock("expo-router", () => {
  const Stack = ({ children }: { children?: React.ReactNode }) => children;
  Stack.Screen = function StackScreen() {
    return null;
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
});
