import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { IconMenu } from "../IconMenu.web";
import { TIconMenuSection } from "../IconMenu.types";

// WebOverlay portals to document.body at runtime; render inline so
// react-test-renderer keeps it in the tree for RNTL queries.
jest.mock("react-dom", () =>
  require("@/testUtils/mockReactDomPortal").mockReactDomPortal(),
);

type TScreen = Awaited<ReturnType<typeof render>>;
type TFlatStyle = NonNullable<ReturnType<typeof StyleSheet.flatten>>;

const flatStyle = (style: unknown): TFlatStyle =>
  StyleSheet.flatten(style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};

const hostsStyled = (
  screen: TScreen,
  matches: (style: TFlatStyle) => boolean,
) => screen.container.queryAll((node) => matches(flatStyle(node.props.style)));

/** WebOverlay's portal root — the only fixed-position `div` in the tree. */
const overlayRoots = (screen: TScreen) =>
  screen.container.queryAll(
    (node) => node.type === "div" && node.props.style?.position === "fixed",
  );

const sections: TIconMenuSection[] = [
  {
    title: "Status",
    options: [
      { id: "todo", title: "To Do", isSelected: false, onSelect: jest.fn() },
      { id: "done", title: "Done", isSelected: true, onSelect: jest.fn() },
    ],
  },
];

describe("IconMenu (web)", () => {
  it("does not show menu options until the trigger is pressed", async () => {
    const screen = await render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(screen.queryByText("To Do")).toBeNull();
  });

  it("opens the menu and shows every option when the trigger is pressed", async () => {
    const screen = await render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    expect(screen.getByText("To Do")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  // It used to be an RN Modal, whose body portal inherits Radix's
  // pointer-events: none — dead wherever opened inside a modal (DEX-134).
  it("renders the menu through WebOverlay", async () => {
    const screen = await render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(overlayRoots(screen)).toHaveLength(0);

    await fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    expect(overlayRoots(screen)).toHaveLength(1);
  });

  it("calls onSelect and closes the menu when an option is pressed", async () => {
    const onSelect = jest.fn();
    const sectionsWithSpy: TIconMenuSection[] = [
      {
        options: [{ id: "todo", title: "To Do", isSelected: false, onSelect }],
      },
    ];
    const screen = await render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sectionsWithSpy}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    await fireEvent.press(screen.getByText("To Do"));

    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByText("To Do")).toBeNull();
  });

  // The overlay is invisible (DEX-125), so nothing catches a regression
  // visually — it would render the same if it stopped taking presses.
  it("closes the menu when the invisible overlay is pressed", async () => {
    const screen = await render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.getByText("To Do")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("menu-overlay"));

    expect(screen.queryByText("To Do")).toBeNull();
  });

  // The catcher is a sibling behind the menu, not its parent — nested, a
  // press on the menu's own chrome bubbled up and dismissed it on open.
  it("keeps the menu open when its own title is pressed", async () => {
    const titled: TIconMenuSection[] = [
      {
        title: "Section Heading",
        options: [{ id: "todo", title: "To Do", onSelect: jest.fn() }],
      },
    ];
    const screen = await render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Menu Title"
        sections={titled}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    await fireEvent.press(screen.getByText("Menu Title"));
    expect(screen.getByText("To Do")).toBeTruthy();

    await fireEvent.press(screen.getByText("Section Heading"));
    expect(screen.getByText("To Do")).toBeTruthy();
  });

  // jest-expo's window, which the clamps below are figured against.
  const VIEWPORT = { width: 750, height: 1334 };

  /** The menu's own box — the only element carrying both an edge and a lift. */
  const menuBox = (screen: TScreen) =>
    hostsStyled(
      screen,
      (style) =>
        Number(style.borderWidth ?? 0) > 0 && style.boxShadow !== undefined,
    )[0];

  const openAndMeasure = async (
    screen: TScreen,
    at: { x: number; y: number },
    measured: { width: number; height: number },
  ) => {
    await fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: at.x, clientY: at.y },
    });
    await fireEvent(menuBox(screen), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, ...measured } },
    });
    return flatStyle(menuBox(screen).props.style);
  };

  const menu = (
    <IconMenu
      accessibilityLabel="Status"
      menuTitle="Status"
      sections={sections}
    >
      <Text>Trigger</Text>
    </IconMenu>
  );

  // A menu opened near the bottom of the viewport used to run straight off it:
  // `openAt` clamped x and left y alone entirely.
  it("pulls a menu opened near the bottom edge back on screen", async () => {
    const screen = await render(menu);
    const style = await openAndMeasure(
      screen,
      { x: 10, y: 1300 },
      { width: 220, height: 300 },
    );

    expect(style.top).toBe(VIEWPORT.height - 300 - 8);
  });

  // The x clamp used to assume `MENU_WIDTH`, which is only a `minWidth` — a
  // long option label grows the menu past it and back off the right edge.
  it("clamps against the menu's measured width, not its minimum", async () => {
    const screen = await render(menu);
    const style = await openAndMeasure(
      screen,
      { x: 700, y: 10 },
      { width: 400, height: 200 },
    );

    expect(style.left).toBe(VIEWPORT.width - 400 - 8);
  });

  it("leaves a menu that already fits where it was opened", async () => {
    const screen = await render(menu);
    const style = await openAndMeasure(
      screen,
      { x: 100, y: 100 },
      { width: 220, height: 200 },
    );

    expect(style.left).toBe(100);
    // The anchor sits one margin below the cursor so the menu clears it.
    expect(style.top).toBe(100 + 8);
  });

  // The row holds focus while pressed, so an action focusing its own input
  // must run after the row unmounts or it loses focus again (DEX-70).
  it("runs the option's action only once the menu has closed", async () => {
    let menuStillOpen: boolean | null = null;
    const sectionsWithSpy: TIconMenuSection[] = [
      {
        options: [
          {
            id: "todo",
            title: "To Do",
            onSelect: () => {
              menuStillOpen = screen.queryByText("To Do") !== null;
            },
          },
        ],
      },
    ];
    const screen = await render(
      <IconMenu accessibilityLabel="Status" sections={sectionsWithSpy}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    await fireEvent.press(screen.getByText("To Do"));

    expect(menuStillOpen).toBe(false);
  });

  it("keeps a submenu section's options collapsed until its header is pressed", async () => {
    const submenuSections: TIconMenuSection[] = [
      {
        title: "Priority",
        isSubmenu: true,
        options: [
          {
            id: "urgent",
            title: "Urgent",
            isSelected: false,
            onSelect: jest.fn(),
          },
        ],
      },
    ];
    const screen = await render(
      <IconMenu
        accessibilityLabel="More"
        menuTitle="More"
        sections={submenuSections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("More"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();

    await fireEvent.press(screen.getByText("Priority"));

    expect(screen.getByText("Urgent")).toBeTruthy();
  });

  it("calls onSelect for an option inside an expanded submenu", async () => {
    const onSelect = jest.fn();
    const submenuSections: TIconMenuSection[] = [
      {
        title: "Priority",
        isSubmenu: true,
        options: [
          { id: "urgent", title: "Urgent", isSelected: false, onSelect },
        ],
      },
    ];
    const screen = await render(
      <IconMenu
        accessibilityLabel="More"
        menuTitle="More"
        sections={submenuSections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("More"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    await fireEvent.press(screen.getByText("Priority"));
    await fireEvent.press(screen.getByText("Urgent"));

    expect(onSelect).toHaveBeenCalled();
  });

  it("opens a long-press menu on right-click and suppresses the browser menu", async () => {
    const screen = await render(
      <IconMenu
        accessibilityLabel="More"
        trigger="longPress"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(screen.queryByText("To Do")).toBeNull();

    const [wrapper] = screen.container.queryAll(
      (node) => typeof node.props.onContextMenu === "function",
    );
    const preventDefault = jest.fn();
    await fireEvent(wrapper, "contextMenu", {
      clientX: 10,
      clientY: 10,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(screen.getByText("To Do")).toBeTruthy();
  });

  it("does not wire right-click for a tap menu, leaving the browser menu intact", async () => {
    const screen = await render(
      <IconMenu accessibilityLabel="Status" sections={sections}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(
      screen.container.queryAll(
        (node) => typeof node.props.onContextMenu === "function",
      ),
    ).toHaveLength(0);
    expect(screen.queryByText("To Do")).toBeNull();
  });

  it("opens on long-press instead of a regular press when configured for it", async () => {
    const screen = await render(
      <IconMenu
        accessibilityLabel="More"
        trigger="longPress"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    await fireEvent.press(screen.getByLabelText("More"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.queryByText("To Do")).toBeNull();

    await fireEvent(screen.getByLabelText("More"), "longPress", {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.getByText("To Do")).toBeTruthy();
  });
});
