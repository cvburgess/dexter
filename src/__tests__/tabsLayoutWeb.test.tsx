import { render } from "@testing-library/react-native";

import TabsLayoutWeb from "@/app/(app)/(tabs)/_layout.web";
import { useShowNavRail } from "@/hooks/useShowNavRail";

jest.mock("@/hooks/useShowNavRail", () => ({ useShowNavRail: jest.fn() }));

// The shell itself is covered by AppShell.test; stub it to a marker that echoes
// the one thing this layout decides.
jest.mock("@/components/AppShell", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    AppShell: function AppShell({ rail }: { rail: boolean }) {
      return <Text>{`shell:rail=${rail}`}</Text>;
    },
  };
});

const mockUseShowNavRail = useShowNavRail as jest.MockedFunction<
  typeof useShowNavRail
>;

describe("TabsLayoutWeb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseShowNavRail.mockReturnValue(false);
  });

  // Web is the only surface that still swaps between the two: phones render the
  // native tab bar and tablets pin the rail at every width (DEX-104).
  it.each([
    ["wide", true],
    ["narrow", false],
  ])("passes the %s-viewport rail decision to the shell", (_label, rail) => {
    mockUseShowNavRail.mockReturnValue(rail);
    const screen = render(<TabsLayoutWeb />);

    expect(screen.getByText(`shell:rail=${rail}`)).toBeTruthy();
  });
});
