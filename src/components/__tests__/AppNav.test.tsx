import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { StyleSheet } from "react-native";

import { NAV_ITEMS, NavDock, NavRail } from "@/components/AppNav";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { renderWithInsets } from "@/testUtils/renderWithBottomInset";
import { NAV_RAIL_WIDTH } from "@/utils/breakpoints";

const mockRouter = { navigate: jest.fn(), push: jest.fn() };
const mockPathname = { current: "/today" };
// `Link` stubbed as a pressable surfacing `href`, mirroring the real
// asChild/Slot clone that makes destinations real anchors on web.
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
      // Real `Slot` refuses an array style on its child (logs, doesn't
      // render) — the dock once shipped one uncaught because nothing rendered it.
      if (Array.isArray(children.props.style)) {
        throw new Error(
          "<Link asChild> needs a flattened style on its child, not an array — " +
            "see StyleSheet.flatten in AppNav.tsx",
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
  NAV_ITEMS.filter((item) => largeDevice || !item.largeScreenOnly);

// Both variants render the same destinations and wire them the same way, so the
// shared behavior is exercised against each rather than only the rail.
const variants = [
  { name: "NavRail", Component: NavRail },
  { name: "NavDock", Component: NavDock },
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
      expect(screen.getByTestId(`nav-${item.key}`)).toBeTruthy();
    });
    expect(screen.getByTestId("nav-new-task")).toBeTruthy();
  });

  describe("large-screen-only destinations (DEX-96)", () => {
    it("offers Week on a large screen", () => {
      const screen = render(<Component />);

      expect(screen.getByTestId("nav-week")).toBeTruthy();
      expect(screen.getByTestId("nav-week").props.href).toBe("/week");
    });

    it("hides Week below the breakpoint", () => {
      mockUseIsLargeDevice.mockReturnValue(false);
      const screen = render(<Component />);

      expect(screen.queryByTestId("nav-week")).toBeNull();
    });

    it("keeps every other destination below the breakpoint", () => {
      mockUseIsLargeDevice.mockReturnValue(false);
      const screen = render(<Component />);

      visibleItems(false).forEach((item) => {
        expect(screen.getByTestId(`nav-${item.key}`)).toBeTruthy();
      });
      expect(screen.getByTestId("nav-new-task")).toBeTruthy();
    });
  });

  it("marks the current destination as selected", () => {
    const screen = render(<Component />);

    expect(screen.getByTestId("nav-today")).toBeSelected();
    expect(screen.getByTestId("nav-settings")).not.toBeSelected();
  });

  it("keeps Settings selected inside its nested routes", () => {
    mockPathname.current = "/settings/lists/abc";
    const screen = render(<Component />);

    expect(screen.getByTestId("nav-settings")).toBeSelected();
    expect(screen.getByTestId("nav-today")).not.toBeSelected();
  });

  it("renders each destination as a real link to its route", () => {
    const screen = render(<Component />);

    visibleItems(true).forEach((item) => {
      expect(screen.getByTestId(`nav-${item.key}`).props.href).toBe(item.href);
    });
  });

  it("marks the current destination with aria-current for assistive tech", () => {
    mockPathname.current = "/search";
    const screen = render(<Component />);

    expect(screen.getByTestId("nav-search").props["aria-current"]).toBe("page");
    expect(
      screen.getByTestId("nav-today").props["aria-current"],
    ).toBeUndefined();
  });

  it("opens the new-task modal seeded with the viewed day", () => {
    mockViewedDay.current = Temporal.PlainDate.from("2026-07-08");
    const screen = render(<Component />);

    fireEvent.press(screen.getByTestId("nav-new-task"));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { scheduledFor: "2026-07-08" },
    });
  });

  it("opens the new-task modal with no date when no day is on screen", () => {
    const screen = render(<Component />);

    fireEvent.press(screen.getByTestId("nav-new-task"));

    expect(mockRouter.push).toHaveBeenCalledWith("/new-task");
  });
});

// Every destination's glyph is fixed, and two of them are about the time of
// day, so they have to stay visually distinct (DEX-127).
describe("destination glyphs", () => {
  it("gives Today and Ritual different icons", () => {
    const icons = NAV_ITEMS.filter((item) =>
      ["today", "ritual"].includes(item.key),
    ).map((item) => item.icon);

    expect(icons).toHaveLength(2);
    expect(new Set(icons).size).toBe(2);
  });
});

// The rail's own concern: it owns the physical left edge with no stack
// header above it, so it clears the status bar/home indicator itself (DEX-104).
describe("NavRail safe-area insets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsLargeDevice.mockReturnValue(true);
  });

  const railStyle = (screen: ReturnType<typeof render>) =>
    StyleSheet.flatten(screen.getByLabelText("Main navigation").props.style);

  it("absorbs the top, bottom and left insets", () => {
    const base = railStyle(renderWithInsets({}, <NavRail />));
    const inset = railStyle(
      renderWithInsets({ top: 24, left: 8, bottom: 20 }, <NavRail />),
    );

    // Measured against the zero-inset render rather than a hardcoded token, so
    // retuning `space.md` doesn't break these.
    expect(inset.paddingTop).toBe(Number(base.paddingTop) + 24);
    expect(inset.paddingBottom).toBe(Number(base.paddingBottom) + 20);
    expect(inset.paddingLeft).toBe(8);
  });

  // The rail grows rather than padding inward: eating the cutout out of the
  // fixed 76dp would squeeze the tiles the inset exists to protect.
  it("widens by the left inset instead of padding into its own width", () => {
    const screen = renderWithInsets({ left: 8 }, <NavRail />);

    expect(railStyle(screen).width).toBe(NAV_RAIL_WIDTH + 8);
  });

  // Web's insets are always 0 (nothing opts into `viewport-fit=cover`), so this
  // is the guard that the tablet work left web's rail exactly as it was.
  it("is exactly the rail width when there are no insets", () => {
    const screen = renderWithInsets({}, <NavRail />);

    expect(railStyle(screen).width).toBe(NAV_RAIL_WIDTH);
    expect(railStyle(screen).paddingLeft).toBe(0);
  });
});
