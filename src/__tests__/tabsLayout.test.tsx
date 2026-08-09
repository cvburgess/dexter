import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import TabsLayout from "@/app/(app)/(tabs)/_layout";

// `IS_TABLET` is a module-scope constant (utils/deviceType.ts), not a hook, so
// there is nothing to mock per render. A getter defers the read to render time:
// the factory is hoisted above the imports and runs while the module graph is
// still initialising, so it must not touch `mockIsTablet` (still in its TDZ) —
// returning a plain object with a getter does exactly that. Babel compiles
// `import { IS_TABLET }` to a property access at each use site to preserve live
// bindings, so every render re-reads it. The `mock` name prefix is what
// babel-plugin-jest-hoist allows through its out-of-scope check.
let mockIsTablet = false;
jest.mock("@/utils/deviceType", () => ({
  get IS_TABLET() {
    return mockIsTablet;
  },
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

jest.mock("@/components/NewTaskButton", () => ({
  NewTaskButton: function NewTaskButton() {
    return null;
  },
}));

describe("TabsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Phones are the default here and under jest generally: unmocked,
    // `Platform.isPad` is undefined, so `IS_TABLET` is false everywhere else in
    // the suite too.
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

    // DEX-96 + DEX-104: seven day columns don't fit a phone, and a phone is now
    // the only thing that reaches this branch — so Week is absent
    // unconditionally rather than gated on window width. That is what keeps the
    // trigger set (and therefore the registered routes, via
    // `useOnlyUserDefinedScreens`) from depending on a value that can change
    // mid-session.
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
