import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import * as Calendar from "expo-calendar";
import { ReactNode } from "react";

import { useEnabledDeviceCalendars } from "@/hooks/useEnabledDeviceCalendars";
import { usePreferences } from "@/hooks/usePreferences";

import { CalendarSourceList as WebSourceList } from "../CalendarSourceList.web";
import { CalendarSourceList as NativeSourceList } from "../CalendarSourceList.native";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useEnabledDeviceCalendars", () => ({
  useEnabledDeviceCalendars: jest.fn(),
}));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseEnabled = useEnabledDeviceCalendars as jest.MockedFunction<
  typeof useEnabledDeviceCalendars
>;
const mockUpdate = jest.fn();

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("CalendarSourceList (web / .ics feeds)", () => {
  const renderWith = (calendarUrls: string[]) => {
    mockUsePreferences.mockReturnValue([
      { calendarUrls } as never,
      { updatePreferences: mockUpdate },
    ]);
    return render(<WebSourceList />);
  };

  beforeEach(() => jest.clearAllMocks());

  it("appends an empty feed when Add feed is pressed", () => {
    const screen = renderWith([]);
    fireEvent.press(screen.getByText("Add feed"));
    expect(mockUpdate).toHaveBeenCalledWith({ calendarUrls: [""] });
  });

  it("commits an edited feed on blur, replacing it by index", () => {
    const screen = renderWith([
      "https://a.example/one.ics",
      "https://a.example/two.ics",
    ]);
    const input = screen.getByLabelText("Calendar feed 1");
    fireEvent.changeText(input, "https://a.example/edited.ics");
    fireEvent(input, "blur");
    expect(mockUpdate).toHaveBeenCalledWith({
      calendarUrls: ["https://a.example/edited.ics", "https://a.example/two.ics"],
    });
  });

  it("removes a feed by index", () => {
    const screen = renderWith([
      "https://a.example/one.ics",
      "https://a.example/two.ics",
    ]);
    fireEvent.press(screen.getByTestId("delete-feed-0"));
    expect(mockUpdate).toHaveBeenCalledWith({
      calendarUrls: ["https://a.example/two.ics"],
    });
  });
});

describe("CalendarSourceList (native / device calendars)", () => {
  const mockSetEnabledIds = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnabled.mockReturnValue([
      null,
      { setEnabledIds: mockSetEnabledIds, isLoading: false },
    ]);
    (Calendar.requestCalendarPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Calendar.getCalendarsAsync as jest.Mock).mockResolvedValue([
      { id: "work", title: "Work", color: "#ff0000" },
      { id: "home", title: "Home", color: "#00ff00" },
    ]);
  });

  it("lists device calendars, all enabled by default", async () => {
    const screen = render(<NativeSourceList />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Work")).toBeTruthy());
    expect(screen.getByLabelText("Work").props.value).toBe(true);
    expect(screen.getByLabelText("Home").props.value).toBe(true);
  });

  it("materializes the full set before disabling one calendar", async () => {
    const screen = render(<NativeSourceList />, { wrapper });
    await waitFor(() => expect(screen.getByLabelText("Work")).toBeTruthy());
    fireEvent(screen.getByLabelText("Work"), "valueChange", false);
    // From "all enabled" (null), toggling Work off yields an explicit [home].
    expect(mockSetEnabledIds).toHaveBeenCalledWith(["home"]);
  });

  it("prompts when calendar permission is denied", async () => {
    (Calendar.requestCalendarPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    const screen = render(<NativeSourceList />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/Calendar access is off/)).toBeTruthy(),
    );
  });
});
