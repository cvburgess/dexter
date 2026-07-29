import { fireEvent, render } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";

import { ModalLoadingScreen } from "../ModalLoadingScreen";

const mockNavigation = { setOptions: jest.fn() };
const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  canDismiss: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
}));

const headerOptions = () => mockNavigation.setOptions.mock.calls.at(-1)?.[0];

describe("ModalLoadingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canDismiss.mockReturnValue(true);
  });

  it("shows a spinner", () => {
    const screen = render(<ModalLoadingScreen fallback="/" />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  // The whole point of the component: a gate that renders a bare LoadingScreen
  // wires no header at all, so the modal has no way out while it resolves.
  it("closes from the header close button", () => {
    render(<ModalLoadingScreen fallback="/" />);

    const close = render(headerOptions().headerLeft());
    fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("replaces with the fallback when there is nothing beneath it", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    render(<ModalLoadingScreen fallback="/settings/tasks" />);

    headerOptions().unstable_headerLeftItems()[0].onPress();

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/tasks");
  });

  // ✓ stays in place so the header doesn't reflow when the form takes over,
  // but there is nothing to save yet.
  it("leaves save present and disabled", () => {
    render(<ModalLoadingScreen fallback="/" />);

    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);

    const save = render(headerOptions().headerRight());
    expect(
      save.getByTestId("modal-done-button").props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
  });

  // The route's own title (`createModalScreenOptions`) already reads correctly;
  // overwriting it here would flash a placeholder before the form's own title.
  it("leaves the route's title alone", () => {
    render(<ModalLoadingScreen fallback="/" />);

    expect(headerOptions()).not.toHaveProperty("title");
  });
});
