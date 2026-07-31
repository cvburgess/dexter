import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { WEB_NAV_ITEMS, WebNavDock, WebNavRail } from "@/components/WebNav";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";

const mockRouter = { navigate: jest.fn(), push: jest.fn() };
const mockPathname = { current: "/today" };
// `Link` is stubbed as a pressable that surfaces its `href` — the real one needs
// a navigation container this unit test doesn't mount. Asserting on the rendered
// href is the point: destinations are real anchors on web, not onPress handlers,
// so cmd-click and "copy link address" work.
// Stands in for the real `Link`'s `asChild` path, which renders a `Slot` that
// clones its single child with the href. Mirroring that here (rather than
// wrapping the child) is what lets the tests assert the href lands on the
// pressable itself — the property that makes these real anchors on web, and
// that keeps the tile a flex container so its icon stays centered.
jest.mock("expo-router", () => {
  const { cloneElement } = jest.requireActual<typeof import("react")>("react");
  return {
    Link: function Link({
      children,
      href,
    }: {
      children: ReactElement<{ href?: string; style?: unknown }>;
      href: string;
    }) {
      // The real `Slot` refuses an array style on its child — it can't merge one
      // with the props it clones in, and logs an `[expo-router]` error instead
      // of rendering. Enforcing that here is what makes the rest of this suite a
      // regression guard: the dock shipped with an array style that nothing
      // caught, because the dock only renders below `WEB_RAIL_MIN_WIDTH` and no
      // test rendered the real `Link`.
      if (Array.isArray(children.props.style)) {
        throw new Error(
          "<Link asChild> needs a flattened style on its child, not an array — " +
            "see StyleSheet.flatten in WebNav.tsx",
        );
      }
      return cloneElement(children, { href });
    },
    usePathname: () => mockPathname.current,
    useRouter: () => mockRouter,
  };
});

const mockViewedDay: { current: Temporal.PlainDate | null } = { current: null };
jest.mock("@/hooks/useViewedDay", () => ({
  getViewedDay: () => mockViewedDay.current,
}));

jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(),
}));
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

// The destinations offered at a given width. Most of these assertions are about
// wiring rather than the breakpoint, so they run wide — where every item shows.
const visibleItems = (largeDevice: boolean) =>
  WEB_NAV_ITEMS.filter((item) => largeDevice || !item.largeScreenOnly);

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
    mockUseIsLargeDevice.mockReturnValue(true);
  });

  it("renders every destination plus the create-task button", () => {
    const screen = render(<Component />);

    visibleItems(true).forEach((item) => {
      expect(screen.getByTestId(`web-nav-${item.key}`)).toBeTruthy();
    });
    expect(screen.getByTestId("web-nav-new-task")).toBeTruthy();
  });

  describe("large-screen-only destinations (DEX-96)", () => {
    it("offers Week on a large screen", () => {
      const screen = render(<Component />);

      expect(screen.getByTestId("web-nav-week")).toBeTruthy();
      expect(screen.getByTestId("web-nav-week").props.href).toBe("/week");
    });

    it("hides Week below the breakpoint", () => {
      mockUseIsLargeDevice.mockReturnValue(false);
      const screen = render(<Component />);

      expect(screen.queryByTestId("web-nav-week")).toBeNull();
    });

    it("keeps every other destination below the breakpoint", () => {
      mockUseIsLargeDevice.mockReturnValue(false);
      const screen = render(<Component />);

      visibleItems(false).forEach((item) => {
        expect(screen.getByTestId(`web-nav-${item.key}`)).toBeTruthy();
      });
      expect(screen.getByTestId("web-nav-new-task")).toBeTruthy();
    });
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

    visibleItems(true).forEach((item) => {
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
