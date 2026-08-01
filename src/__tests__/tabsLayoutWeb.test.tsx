import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import TabsLayoutWeb from "@/app/(app)/(tabs)/_layout.web";
import { useShowNavRail } from "@/hooks/useShowNavRail";

jest.mock("@/hooks/useShowNavRail", () => ({ useShowNavRail: jest.fn() }));

// Stub both nav variants to markers so this test only exercises _layout.web's
// own rail-vs-dock decision, not the nav's internals (AppNav.test covers those).
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

const mockUseShowNavRail = useShowNavRail as jest.MockedFunction<
  typeof useShowNavRail
>;

describe("TabsLayoutWeb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseShowNavRail.mockReturnValue(false);
  });

  it("mounts the rail on wide viewports", () => {
    mockUseShowNavRail.mockReturnValue(true);
    const screen = render(<TabsLayoutWeb />);

    expect(screen.getByText("nav-rail")).toBeTruthy();
    expect(screen.queryByText("nav-dock")).toBeNull();
  });

  it("mounts the dock on narrow viewports", () => {
    mockUseShowNavRail.mockReturnValue(false);
    const screen = render(<TabsLayoutWeb />);

    expect(screen.getByText("nav-dock")).toBeTruthy();
    expect(screen.queryByText("nav-rail")).toBeNull();
  });

  // The Week *nav item* is gated on width (AppNav.test covers that), but the
  // route must resolve at every width or a `/week` URL opened in a narrow
  // window would be a navigation error rather than the screen's own
  // explanation (DEX-96).
  it.each([
    ["wide", true],
    ["narrow", false],
  ])("registers the week route on %s viewports", (_label, rail) => {
    mockUseShowNavRail.mockReturnValue(rail);
    const screen = render(<TabsLayoutWeb />);

    expect(screen.getByText("tab-screen:week")).toBeTruthy();
    expect(screen.getByText("tab-screen:today")).toBeTruthy();
  });
});
