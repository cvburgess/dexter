import { render } from "@testing-library/react-native";

import TabsLayoutWeb from "@/app/(app)/(tabs)/_layout.web";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";

jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

// Stub both nav variants to markers so this test only exercises _layout.web's
// own rail-vs-dock decision, not the nav's internals (WebNav.test covers those).
jest.mock("@/components/WebNav", () => {
  const { Text } = require("react-native");
  return {
    WebNavDock: () => <Text>web-nav-dock</Text>,
    WebNavRail: () => <Text>web-nav-rail</Text>,
  };
});

// The real Tabs/Tabs.Screen require a navigation container this unit test
// doesn't mount; render children through a passthrough so the wrapping View
// structure around the nav is still exercised.
jest.mock("expo-router", () => {
  const Tabs = ({ children }: { children?: React.ReactNode }) => children;
  Tabs.Screen = () => null;
  return { Tabs };
});

const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;

describe("TabsLayoutWeb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("mounts the rail on wide viewports", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = render(<TabsLayoutWeb />);

    expect(screen.getByText("web-nav-rail")).toBeTruthy();
    expect(screen.queryByText("web-nav-dock")).toBeNull();
  });

  it("mounts the dock on narrow viewports", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = render(<TabsLayoutWeb />);

    expect(screen.getByText("web-nav-dock")).toBeTruthy();
    expect(screen.queryByText("web-nav-rail")).toBeNull();
  });
});
