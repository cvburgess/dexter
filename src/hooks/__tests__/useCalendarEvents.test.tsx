import { Temporal } from "@js-temporal/polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import * as Calendar from "expo-calendar";
import { ReactNode } from "react";

import { usePreferences } from "@/hooks/usePreferences";

import { useCalendarEvents as useNativeCalendarEvents } from "../useCalendarEvents";
// The web/native hooks are separate platform variants that we test side by side.
// eslint-disable-next-line import/no-duplicates -- the resolver collapses the `.web` suffix to the same module, but this must stay a distinct import so the web implementation is exercised.
import { useCalendarEvents as useWebCalendarEvents } from "../useCalendarEvents.web";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useEnabledDeviceCalendars", () => ({
  useEnabledDeviceCalendars: jest.fn(() => [
    null,
    { setEnabledIds: jest.fn(), isLoading: false },
  ]),
}));
// useAuth runs Linking.createURL at import time (throws under jest); the hooks
// only read the signed-in email from it, so stub a signed-out session.
jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn(() => ({})) }));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

const DAY = Temporal.PlainDate.from("2026-07-12");

const setPreferences = (overrides: Record<string, unknown>) =>
  mockUsePreferences.mockReturnValue([
    {
      enableCalendar: true,
      calendarUrls: [],
      calendarStartTime: "06:00:00",
      calendarEndTime: "20:00:00",
      ...overrides,
    } as never,
    { updatePreferences: jest.fn() },
  ]);

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Test//EN",
  "BEGIN:VEVENT",
  "UID:web-1",
  "SUMMARY:Design review",
  "DTSTART:20260712T160000Z",
  "DTEND:20260712T170000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("useCalendarEvents (web)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => ICS,
    })) as unknown as typeof fetch;
  });

  it("fetches and parses configured feeds", async () => {
    setPreferences({ calendarUrls: ["https://example.com/cal.ics"] });

    const { result } = renderHook(() => useWebCalendarEvents(DAY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[0]).toHaveLength(1));
    expect(result.current[0][0].title).toBe("Design review");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/functions/v1/ics-proxy?url=https%3A%2F%2Fexample.com%2Fcal.ics",
      ),
    );
  });

  it("refetches when the view remounts for the same day", async () => {
    setPreferences({ calendarUrls: ["https://example.com/cal.ics"] });

    // One shared client across both mounts so the day's result is cached: only
    // `refetchOnMount: "always"` makes the second mount fetch again.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => useWebCalendarEvents(DAY), { wrapper });
    await waitFor(() => expect(first.result.current[0]).toHaveLength(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderHook(() => useWebCalendarEvents(DAY), { wrapper });
    await waitFor(() => expect(second.result.current[0]).toHaveLength(1));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stays idle with no feeds configured", async () => {
    setPreferences({ calendarUrls: [] });

    const { result } = renderHook(() => useWebCalendarEvents(DAY), {
      wrapper: createWrapper(),
    });

    expect(result.current[0]).toEqual([]);
    expect(result.current[1].isLoading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces an error when every feed fails", async () => {
    setPreferences({ calendarUrls: ["https://example.com/cal.ics"] });
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      text: async () => "",
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useWebCalendarEvents(DAY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].isError).toBe(true));
  });
});

describe("useCalendarEvents (native)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Calendar.requestCalendarPermissions as jest.Mock).mockResolvedValue({
      status: "granted",
      granted: true,
    });
    (Calendar.getCalendars as jest.Mock).mockResolvedValue([
      { id: "cal-1", color: "#ff0000" },
    ]);
    (Calendar.listEvents as jest.Mock).mockResolvedValue([
      {
        id: "evt-1",
        title: "1:1",
        calendarId: "cal-1",
        allDay: false,
        startDate: "2026-07-12T18:00:00.000Z",
        endDate: "2026-07-12T18:30:00.000Z",
      },
    ]);
  });

  it("maps device events, carrying the calendar color", async () => {
    setPreferences({});

    const { result } = renderHook(() => useNativeCalendarEvents(DAY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[0]).toHaveLength(1));
    expect(result.current[0][0].title).toBe("1:1");
    expect(result.current[0][0].color).toBe("#ff0000");
    expect(result.current[1].permissionDenied).toBe(false);
    expect(Calendar.listEvents).toHaveBeenCalledWith(
      ["cal-1"],
      expect.any(Date),
      expect.any(Date),
    );
  });

  it("reports permissionDenied when the grant is refused", async () => {
    setPreferences({});
    (Calendar.requestCalendarPermissions as jest.Mock).mockResolvedValue({
      status: "denied",
      granted: false,
    });

    const { result } = renderHook(() => useNativeCalendarEvents(DAY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current[1].permissionDenied).toBe(true));
    expect(result.current[0]).toEqual([]);
  });
});
