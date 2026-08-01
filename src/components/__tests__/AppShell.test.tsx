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

// The real Tabs/Tabs.Screen require a navigation container this unit test
// doesn't mount; render children through a passthrough so the wrapping View
// structure around the nav is still exercised. Tabs.Screen echoes its `name`
// so which destinations are registered is assertable.
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

  // The rail is a row sibling of the content and the dock a column one — the
  // whole reason both live behind a single `rail` boolean, so the flex
  // direction can't disagree with which variant rendered.
  it.each([
    ["row", true],
    ["column", false],
  ])("lays the shell out as a %s", (direction, rail) => {
    const screen = render(<AppShell rail={rail} />);

    expect(screen.root).toHaveStyle({ flexDirection: direction });
  });

  // The Week *nav item* is gated on width (AppNav.test covers that), but the
  // route must resolve either way or a `/week` URL — typed in a narrow browser
  // window, or deep-linked on a tablet below the breakpoint — would be a
  // navigation error rather than the screen's own explanation (DEX-96).
  it.each([
    ["rail", true],
    ["dock", false],
  ])("registers every route behind the %s", (_label, rail) => {
    const screen = render(<AppShell rail={rail} />);

    expect(screen.getByText("tab-screen:today")).toBeTruthy();
    expect(screen.getByText("tab-screen:week")).toBeTruthy();
    expect(screen.getByText("tab-screen:settings")).toBeTruthy();
    expect(screen.getByText("tab-screen:search")).toBeTruthy();
  });
});
