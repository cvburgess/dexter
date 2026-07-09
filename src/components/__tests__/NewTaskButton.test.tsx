import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { NewTaskButton } from "@/components/NewTaskButton";

const mockRouter = { push: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("expo-router/unstable-native-tabs", () => ({
  NativeTabs: { BottomAccessory: { usePlacement: () => "expanded" } },
}));

const mockViewedDay: { current: Temporal.PlainDate | null } = { current: null };
jest.mock("@/hooks/useViewedDay", () => ({
  getViewedDay: () => mockViewedDay.current,
}));

describe("NewTaskButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockViewedDay.current = null;
  });

  it("opens the new-task modal seeded with the viewed day", () => {
    mockViewedDay.current = Temporal.PlainDate.from("2026-07-08");
    const screen = render(<NewTaskButton />);

    fireEvent.press(screen.getByLabelText("New Task"));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { scheduledFor: "2026-07-08" },
    });
  });

  it("opens the new-task modal with no date when no day is on screen", () => {
    const screen = render(<NewTaskButton />);

    fireEvent.press(screen.getByLabelText("New Task"));

    expect(mockRouter.push).toHaveBeenCalledWith("/new-task");
  });
});
