import { render } from "@testing-library/react-native";

import SettingsLayout from "@/app/(app)/(tabs)/settings/_layout";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";

jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

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
  Stack.Screen = () => null;
  return { Stack };
});

const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;

describe("SettingsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("mounts the persistent sidebar in two-pane mode", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = render(<SettingsLayout />);

    expect(screen.getByText("settings-sidebar")).toBeTruthy();
  });

  it("does not mount the sidebar in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = render(<SettingsLayout />);

    expect(screen.queryByText("settings-sidebar")).toBeNull();
  });
});
