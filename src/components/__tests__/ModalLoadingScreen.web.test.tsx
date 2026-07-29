import { fireEvent, render } from "@testing-library/react-native";

import { ModalLoadingScreen } from "../ModalLoadingScreen";

const mockNavigation = { setOptions: jest.fn() };
const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
}));

// The suite runs under the native platform resolution, so point the two
// platform-split pieces at their web files — web is the platform that matters
// here, since `createModalScreenOptions.web` sets `headerShown: false` and this
// header is the only one the user gets (DEX-101).
jest.mock("@/components/WebModalHeader", () =>
  jest.requireActual<typeof import("@/components/WebModalHeader.web")>(
    "@/components/WebModalHeader.web",
  ),
);
jest.mock("@/components/ModalScreen", () =>
  jest.requireActual<typeof import("@/components/ModalScreen.web")>(
    "@/components/ModalScreen.web",
  ),
);

describe("ModalLoadingScreen on web", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack.mockReturnValue(true);
  });

  it("renders a close button in the tree, not only in the navigator header", () => {
    const screen = render(<ModalLoadingScreen fallback="/" />);

    fireEvent.press(screen.getByTestId("modal-close-button"));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  // Present so the header doesn't reflow when the form takes over, but greyed
  // out — there is nothing to save until the row lands.
  it("renders save disabled", () => {
    const screen = render(<ModalLoadingScreen fallback="/" />);

    expect(
      screen.getByTestId("modal-done-button").props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
  });
});
