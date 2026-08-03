import { fireEvent, render } from "@testing-library/react-native";
import { Href } from "expo-router";
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

// `Href`, not `string`: that's what `useDismissModal` takes. `Href` only
// narrows to the concrete route union once `.expo/types/router.d.ts` has been
// generated, so a `string` here type-checks in CI (where the file is absent)
// and fails locally after the dev server has run — see DEX-120.
function Harness({ fallback }: { fallback: Href }) {
  const dismiss = useDismissModal(fallback);
  return (
    <Text testID="dismiss" onPress={dismiss}>
      dismiss
    </Text>
  );
}

const dismiss = (fallback: Href) => {
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
