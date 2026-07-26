import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { WEB_NAV_ITEMS, WebNavDock, WebNavRail } from "@/components/WebNav";

const mockRouter = { navigate: jest.fn(), push: jest.fn() };
const mockPathname = { current: "/today" };
// `Link` is stubbed as a pressable that surfaces its `href` — the real one needs
// a navigation container this unit test doesn't mount. Asserting on the rendered
// href is the point: destinations are real anchors on web, not onPress handlers,
// so cmd-click and "copy link address" work.
jest.mock("expo-router", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Link: function Link({ children, ...props }: { children?: ReactNode }) {
      return <View {...props}>{children}</View>;
    },
    usePathname: () => mockPathname.current,
    useRouter: () => mockRouter,
  };
});

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

  it("renders each destination as a real link to its route", () => {
    const screen = render(<Component />);

    WEB_NAV_ITEMS.forEach((item) => {
      expect(screen.getByTestId(`web-nav-${item.key}`).props.href).toBe(
        item.href,
      );
    });
  });

  it("marks the current destination with aria-current for assistive tech", () => {
    mockPathname.current = "/search";
    const screen = render(<Component />);

    expect(screen.getByTestId("web-nav-search").props["aria-current"]).toBe(
      "page",
    );
    expect(
      screen.getByTestId("web-nav-today").props["aria-current"],
    ).toBeUndefined();
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
