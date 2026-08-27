import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";

// Stub both nav variants to markers so this exercises the shell's own
// composition, not the nav's internals (AppNav.test covers those).
jest.mock("@/components/AppNav", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    NavDock: function NavDock() {
      return <Text>nav-dock</Text>;
    },
    NavRail: function NavRail() {
      return <Text>nav-rail</Text>;
    },
  };
});

// Stubbed to a marker since it's a live query with nothing to render without
// a running block (DEX-49).
jest.mock("@/components/FocusTimerBar", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    FocusTimerBar: function FocusTimerBar() {
      return <Text>focus-timer-bar</Text>;
    },
  };
});

// Real Tabs needs a navigation container this test doesn't mount; a
// passthrough exercises the wrapping View, and Tabs.Screen echoes its name.
jest.mock("expo-router", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Tabs = ({ children }: { children?: ReactNode }) => children;
  Tabs.Screen = function TabsScreen({ name }: { name: string }) {
    return <Text>{`tab-screen:${name}`}</Text>;
  };
  return { Tabs };
});

describe("AppShell", () => {
  it("mounts the rail, in a row, when told to", () => {
    const screen = render(<AppShell rail />);

    expect(screen.getByText("nav-rail")).toBeTruthy();
    expect(screen.queryByText("nav-dock")).toBeNull();
  });

  it("mounts the dock, in a column, when told not to", () => {
    const screen = render(<AppShell rail={false} />);

    expect(screen.getByText("nav-dock")).toBeTruthy();
    expect(screen.queryByText("nav-rail")).toBeNull();
  });

  // The nav item is width-gated (AppNav.test), but the route must resolve
  // either way or a `/week` URL below the breakpoint is a nav error (DEX-96).
  it.each([
    ["rail", true],
    ["dock", false],
  ])("registers every route behind the %s", (_label, rail) => {
    const screen = render(<AppShell rail={rail} />);

    expect(screen.getByText("tab-screen:today")).toBeTruthy();
    expect(screen.getByText("tab-screen:ritual")).toBeTruthy();
    expect(screen.getByText("tab-screen:week")).toBeTruthy();
    expect(screen.getByText("tab-screen:settings")).toBeTruthy();
    expect(screen.getByText("tab-screen:search")).toBeTruthy();
  });
});
