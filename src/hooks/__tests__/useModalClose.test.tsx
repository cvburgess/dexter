import { render } from "@testing-library/react-native";

import { useModalClose } from "../useModalClose";

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  canDismiss: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

let close: () => void;

function Harness({ fallbackHref }: { fallbackHref: string }) {
  close = useModalClose(fallbackHref);
  return null;
}

describe("useModalClose", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canDismiss.mockReturnValue(true);
  });

  it("pops when there is a stack screen underneath", () => {
    render(<Harness fallbackHref="/settings/lists" />);
    close();

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("falls back to the list when there is nothing to pop", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    render(<Harness fallbackHref="/settings/lists" />);
    close();

    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/lists");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  // `canGoBack` is global, so it is also true when the only "back" available is
  // the tab navigator jumping to another tab — popping then throws the user out
  // of Settings instead of landing on the list.
  it("ignores canGoBack, which cannot tell a stack pop from a tab jump", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    mockRouter.canGoBack.mockReturnValue(true);
    render(<Harness fallbackHref="/settings/tasks" />);
    close();

    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/tasks");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
