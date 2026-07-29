import { renderHook } from "@testing-library/react-native";

import { useModalClose } from "../useModalClose";

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

describe("useModalClose", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack.mockReturnValue(true);
  });

  it("pops when there is something beneath the modal", () => {
    const { result } = renderHook(() => useModalClose("/settings/lists"));

    result.current();

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  // A cold deep link leaves the stack holding only the modal, where `back()`
  // is an unhandled GO_BACK: ✕ looks dead and ✓ writes without ever closing.
  it("replaces with the fallback when there is nothing to pop", () => {
    mockRouter.canGoBack.mockReturnValue(false);
    const { result } = renderHook(() => useModalClose("/settings/lists"));

    result.current();

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/lists");
  });

  // The stack can empty between renders (a pop that leaves this modal alone),
  // so the branch has to be read at press time, not at render time.
  it("reads canGoBack on each press rather than caching it", () => {
    const { result } = renderHook(() => useModalClose("/"));

    result.current();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);

    mockRouter.canGoBack.mockReturnValue(false);
    result.current();

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });
});
