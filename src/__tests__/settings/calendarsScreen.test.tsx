import { fireEvent, render } from "@testing-library/react-native";

import CalendarsScreen from "@/app/(app)/(tabs)/settings/calendars";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

// The source list runs an unmocked React Query against the device's calendars,
// which resolves a microtask or two *after* these synchronous assertions — a
// state update outside `act()` that `jest.setupAfterEnv.js` then fails whichever
// test happens to be running when React flushes it (DEX-130). Nothing here
// asserts on the list, and both its variants have their own suite in
// `components/__tests__/CalendarSourceList.test.tsx`, so it stands in as a
// marker rather than being re-exercised per screen.
jest.mock("@/components/CalendarSourceList", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CalendarSourceList: function CalendarSourceList() {
      return <Text>calendar-source-list</Text>;
    },
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;
const mockUpdate = jest.fn();

const renderWith = (overrides: Record<string, unknown> = {}) => {
  mockUsePreferences.mockReturnValue([
    {
      enableCalendar: true,
      calendarUrls: [],
      calendarStartTime: "06:00:00",
      calendarEndTime: "20:00:00",
      ...overrides,
    } as never,
    { updatePreferences: mockUpdate },
  ]);
  return render(<CalendarsScreen />);
};

describe("CalendarsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  it("reflects the enabled state and toggles it", () => {
    const screen = renderWith({ enableCalendar: true });
    expect(screen.getByLabelText("Calendar").props.value).toBe(true);
    fireEvent(screen.getByLabelText("Calendar"), "valueChange", false);
    expect(mockUpdate).toHaveBeenCalledWith({ enableCalendar: false });
  });

  it("shows the timeline window controls when enabled", () => {
    const screen = renderWith({ enableCalendar: true });
    expect(screen.getByText("Start time")).toBeTruthy();
    expect(screen.getByText("End time")).toBeTruthy();
  });

  it("hides the settings body when the calendar is disabled", () => {
    const screen = renderWith({ enableCalendar: false });
    expect(screen.queryByText("Start time")).toBeNull();
    expect(screen.queryByText("Daily timeline")).toBeNull();
  });
});
