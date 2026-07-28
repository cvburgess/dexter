import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import TabsLayout from "@/app/(app)/(tabs)/_layout";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(),
}));

// NativeTabs renders a real platform tab bar through react-native-screens,
// which this unit test doesn't mount. Stub the pieces to markers so the only
// thing exercised is which triggers the layout declares.
jest.mock("expo-router/unstable-native-tabs", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const NativeTabs = ({ children }: { children?: ReactNode }) => children;
  NativeTabs.BottomAccessory = function BottomAccessory() {
    return null;
  };
  const Trigger = function Trigger({ name }: { name: string }) {
    return <Text>{`trigger:${name}`}</Text>;
  };
  Trigger.Icon = function Icon() {
    return null;
  };
  Trigger.Label = function Label() {
    return null;
  };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

jest.mock("@/components/NewTaskButton", () => ({
  NewTaskButton: function NewTaskButton() {
    return null;
  },
}));

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

describe("TabsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("always declares the core destinations", () => {
    const screen = render(<TabsLayout />);

    expect(screen.getByText("trigger:today")).toBeTruthy();
    expect(screen.getByText("trigger:settings")).toBeTruthy();
    expect(screen.getByText("trigger:search")).toBeTruthy();
  });

  // DEX-96: seven day columns don't fit a phone, so the tab isn't offered
  // there. Only the trigger is conditional — the route stays registered.
  it("offers the Week tab on a large device", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = render(<TabsLayout />);

    expect(screen.getByText("trigger:week")).toBeTruthy();
  });

  it("omits the Week tab on a small device", () => {
    const screen = render(<TabsLayout />);

    expect(screen.queryByText("trigger:week")).toBeNull();
  });

  it("keeps Week directly after Today so the order matches the web nav", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = render(<TabsLayout />);

    const order = screen
      .getAllByText(/^trigger:/)
      .map((node) => String(node.props.children));
    expect(order).toEqual([
      "trigger:today",
      "trigger:week",
      "trigger:settings",
      "trigger:search",
    ]);
  });
});
