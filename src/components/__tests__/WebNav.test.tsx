import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { WEB_NAV_ITEMS, WebNavDock, WebNavRail } from "@/components/WebNav";

const mockRouter = { navigate: jest.fn(), push: jest.fn() };
const mockPathname = { current: "/today" };
jest.mock("expo-router", () => ({
  usePathname: () => mockPathname.current,
  useRouter: () => mockRouter,
}));

const mockViewedDay: { current: Temporal.PlainDate | null } = { current: null };
jest.mock("@/hooks/useViewedDay", () => ({
  getViewedDay: () => mockViewedDay.current,
}));

// Both variants render the same destinations and wire them the same way, so the
// shared behavior is exercised against each rather than only the rail.
const variants = [
  { name: "WebNavRail", Component: WebNavRail },
  { name: "WebNavDock", Component: WebNavDock },
] as const;

describe.each(variants)("$name", ({ Component }) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.current = "/today";
    mockViewedDay.current = null;
  });

  it("renders every destination plus the create-task button", () => {
    const screen = render(<Component />);

    WEB_NAV_ITEMS.forEach((item) => {
      expect(screen.getByTestId(`web-nav-${item.key}`)).toBeTruthy();
    });
    expect(screen.getByTestId("web-nav-new-task")).toBeTruthy();
  });

  it("marks the current destination as selected", () => {
    const screen = render(<Component />);

    expect(screen.getByTestId("web-nav-today")).toBeSelected();
    expect(screen.getByTestId("web-nav-settings")).not.toBeSelected();
  });

  it("keeps Settings selected inside its nested routes", () => {
    mockPathname.current = "/settings/lists/abc";
    const screen = render(<Component />);

    expect(screen.getByTestId("web-nav-settings")).toBeSelected();
    expect(screen.getByTestId("web-nav-today")).not.toBeSelected();
  });

  it("navigates to a destination rather than pushing another copy of it", () => {
    const screen = render(<Component />);

    fireEvent.press(screen.getByTestId("web-nav-search"));

    expect(mockRouter.navigate).toHaveBeenCalledWith("/search");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("opens the new-task modal seeded with the viewed day", () => {
    mockViewedDay.current = Temporal.PlainDate.from("2026-07-08");
    const screen = render(<Component />);

    fireEvent.press(screen.getByTestId("web-nav-new-task"));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { scheduledFor: "2026-07-08" },
    });
  });

  it("opens the new-task modal with no date when no day is on screen", () => {
    const screen = render(<Component />);

    fireEvent.press(screen.getByTestId("web-nav-new-task"));

    expect(mockRouter.push).toHaveBeenCalledWith("/new-task");
  });
});
