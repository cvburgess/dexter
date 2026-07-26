import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import TabsLayoutWeb from "@/app/(app)/(tabs)/_layout.web";
import { useShowNavRail } from "@/hooks/useShowNavRail";

jest.mock("@/hooks/useShowNavRail", () => ({ useShowNavRail: jest.fn() }));

// Stub both nav variants to markers so this test only exercises _layout.web's
// own rail-vs-dock decision, not the nav's internals (WebNav.test covers those).
jest.mock("@/components/WebNav", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    WebNavDock: function WebNavDock() {
      return <Text>web-nav-dock</Text>;
    },
    WebNavRail: function WebNavRail() {
      return <Text>web-nav-rail</Text>;
    },
  };
});

// The real Tabs/Tabs.Screen require a navigation container this unit test
// doesn't mount; render children through a passthrough so the wrapping View
// structure around the nav is still exercised.
jest.mock("expo-router", () => {
  const Tabs = ({ children }: { children?: ReactNode }) => children;
  Tabs.Screen = function TabsScreen() {
    return null;
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

    expect(screen.getByText("web-nav-rail")).toBeTruthy();
    expect(screen.queryByText("web-nav-dock")).toBeNull();
  });

  it("mounts the dock on narrow viewports", () => {
    mockUseShowNavRail.mockReturnValue(false);
    const screen = render(<TabsLayoutWeb />);

    expect(screen.getByText("web-nav-dock")).toBeTruthy();
    expect(screen.queryByText("web-nav-rail")).toBeNull();
  });
});
