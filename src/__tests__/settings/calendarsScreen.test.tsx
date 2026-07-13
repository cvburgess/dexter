import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react-native";
import { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { Edge } from "react-native-safe-area-context";

import CalendarsScreen from "@/app/(app)/(tabs)/settings/calendars";
import { useEnabledDeviceCalendars } from "@/hooks/useEnabledDeviceCalendars";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useEnabledDeviceCalendars", () => ({
  useEnabledDeviceCalendars: jest.fn(() => [
    null,
    { setEnabledIds: jest.fn(), isLoading: false },
  ]),
}));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

// The project-wide react-native-safe-area-context mock doesn't stub
// SafeAreaView itself, so `edges` isn't otherwise observable in a render
// tree — expose it via testID to assert on the two-pane/single-pane split.
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual(
    "react-native-safe-area-context/jest/mock",
  ).default;
  const { View } = require("react-native");
  return {
    ...actual,
    SafeAreaView: ({
      children,
      edges,
      style,
    }: {
      children: React.ReactNode;
      edges?: Edge[];
      style?: StyleProp<ViewStyle>;
    }) => (
      <View testID={`safe-area-edges-${(edges ?? []).join(",")}`} style={style}>
        {children}
      </View>
    ),
  };
});

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;
const mockUpdate = jest.fn();

// The device-calendars source list (native variant on the default jest
// platform) reads via React Query, so the screen needs a client.
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

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
  return render(<CalendarsScreen />, { wrapper });
};

describe("CalendarsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useEnabledDeviceCalendars as jest.Mock).mockReturnValue([
      null,
      { setEnabledIds: jest.fn(), isLoading: false },
    ]);
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = renderWith({ enableCalendar: true });

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = renderWith({ enableCalendar: true });

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
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
