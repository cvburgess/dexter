import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import TabsLayout from "@/app/(app)/(tabs)/_layout";

// `IS_TABLET` is a module-scope constant, not a hook — a getter defers the
// read to render time so it never touches `mockIsTablet` while still in TDZ.
let mockIsTablet = false;
jest.mock("@/utils/deviceType", () => ({
  get IS_TABLET() {
    return mockIsTablet;
  },
}));

// NativeTabs renders a real platform tab bar this unit test doesn't mount;
// stub to markers so only which triggers the layout declares is exercised.
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

// The shell is covered by AppShell.test; here it only has to be identifiable.
jest.mock("@/components/AppShell", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    AppShell: function AppShell({ rail }: { rail: boolean }) {
      return <Text>{`shell:rail=${rail}`}</Text>;
    },
  };
});

// The accessory's own branch is its own component's concern; here it only has
// to not drag expo-router's untransformed navigation internals into this suite.
jest.mock("@/components/TabBarAccessory", () => ({
  TabBarAccessory: function TabBarAccessory() {
    return null;
  },
}));

describe("TabsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Phones are the default under jest: unmocked, `Platform.isPad` is
    // undefined, so `IS_TABLET` is false everywhere else too.
    mockIsTablet = false;
  });

  describe("on a phone", () => {
    it("declares the core destinations in order", () => {
      const screen = render(<TabsLayout />);

      const order = screen
        .getAllByText(/^trigger:/)
        .map((node) => String(node.props.children));
      expect(order).toEqual([
        "trigger:today",
        "trigger:ritual",
        "trigger:settings",
        "trigger:search",
      ]);
    });

    // DEX-96 + DEX-104: seven columns don't fit a phone, so Week is absent
    // unconditionally rather than gated on window width, which can change mid-session.
    it("never offers the Week tab, at any width", () => {
      const screen = render(<TabsLayout />);

      expect(screen.queryByText("trigger:week")).toBeNull();
    });

    it("does not render the rail shell", () => {
      const screen = render(<TabsLayout />);

      expect(screen.queryByText(/^shell:/)).toBeNull();
    });
  });

  describe("on a tablet", () => {
    beforeEach(() => {
      mockIsTablet = true;
    });

    it("renders the shared shell with the rail pinned", () => {
      const screen = render(<TabsLayout />);

      expect(screen.getByText("shell:rail=true")).toBeTruthy();
    });

    it("declares no native triggers", () => {
      const screen = render(<TabsLayout />);

      expect(screen.queryAllByText(/^trigger:/)).toHaveLength(0);
    });
  });
});
