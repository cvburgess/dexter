import { render } from "@testing-library/react-native";

import ListsScreen from "@/app/(app)/(tabs)/lists";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(),
}));
jest.mock("@/components/ListsView", () => {
  const { Text: RNText } = require("react-native");
  return { ListsView: () => <RNText>lists-view</RNText> };
});

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

describe("ListsScreen", () => {
  it("renders the board on a large screen", () => {
    mockUseIsLargeDevice.mockReturnValue(true);
    const screen = render(<ListsScreen />);

    expect(screen.getByText("lists-view")).toBeTruthy();
  });

  // A deep-linked /lists in a narrow window (or Split View) still resolves.
  it("explains itself below the breakpoint instead of rendering the board", () => {
    mockUseIsLargeDevice.mockReturnValue(false);
    const screen = render(<ListsScreen />);

    expect(screen.queryByText("lists-view")).toBeNull();
    expect(screen.getByText(/needs a wider screen/)).toBeTruthy();
  });
});
