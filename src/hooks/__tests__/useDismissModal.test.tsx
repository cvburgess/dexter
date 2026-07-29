import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { useDismissModal } from "../useDismissModal";

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  canDismiss: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

function Harness({ fallback }: { fallback: string }) {
  const dismiss = useDismissModal(fallback);
  return (
    <Text testID="dismiss" onPress={dismiss}>
      dismiss
    </Text>
  );
}

const dismiss = (fallback: string) => {
  const screen = render(<Harness fallback={fallback} />);
  fireEvent.press(screen.getByTestId("dismiss"));
};

describe("useDismissModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canDismiss.mockReturnValue(true);
  });

  it("pops when there is a stack screen underneath", () => {
    dismiss("/settings/lists");

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("falls back when there is nothing to pop", () => {
    mockRouter.canDismiss.mockReturnValue(false);

    dismiss("/settings/lists");

    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/lists");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  // `canGoBack` is global, so it is also true when the only "back" available is
  // the tab navigator jumping to another tab — popping then throws the user out
  // of Settings instead of landing on `fallback` (DEX-93).
  it("ignores canGoBack, which cannot tell a stack pop from a tab jump", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    mockRouter.canGoBack.mockReturnValue(true);

    dismiss("/settings/tasks");

    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/tasks");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
