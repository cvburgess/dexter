import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { IconMenu } from "../IconMenu.web";
import { TIconMenuSection } from "../IconMenu.types";
import { WebOverlay } from "../WebOverlay.web";

// The menu reaches the screen through `WebOverlay`, which portals it to
// `document.body` at runtime; render it inline here so react-test-renderer
// keeps it in the tree for RNTL queries.
jest.mock("react-dom", () =>
  require("@/testUtils/mockReactDomPortal").mockReactDomPortal(),
);

/**
 * Host (not composite) elements whose flattened style matches — the menu's
 * layout details live in styles, and every element renders twice in the tree
 * otherwise.
 */
const hostsStyled = (
  screen: ReturnType<typeof render>,
  matches: (style: ViewStyle) => boolean,
) =>
  screen.UNSAFE_root.findAll((node) => {
    if (typeof node.type !== "string") return false;
    const style = StyleSheet.flatten(
      (node.props as { style?: StyleProp<ViewStyle> }).style,
    );
    return matches(style ?? {});
  });

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
  it("does not show menu options until the trigger is pressed", () => {
    const screen = render(
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

  it("opens the menu and shows every option when the trigger is pressed", () => {
    const screen = render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    expect(screen.getByText("To Do")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  // It used to be an RN `Modal`, whose body portal inherits the
  // `pointer-events: none` Radix puts on the body — so the menu was dead
  // wherever it opened from inside a modal screen, which `SubtaskRow` inside
  // `TaskForm` does (DEX-134). `WebOverlay` is the portal that re-declares
  // `auto`.
  it("renders the menu through WebOverlay", () => {
    const screen = render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(screen.UNSAFE_root.findAllByType(WebOverlay)).toHaveLength(0);

    fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    expect(screen.UNSAFE_root.findAllByType(WebOverlay)).toHaveLength(1);
  });

  it("calls onSelect and closes the menu when an option is pressed", () => {
    const onSelect = jest.fn();
    const sectionsWithSpy: TIconMenuSection[] = [
      {
        options: [{ id: "todo", title: "To Do", isSelected: false, onSelect }],
      },
    ];
    const screen = render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sectionsWithSpy}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    fireEvent.press(screen.getByText("To Do"));

    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByText("To Do")).toBeNull();
  });

  // The overlay is invisible — a context menu floats over undimmed content
  // (DEX-125) — so nothing about it is visible to catch a regression. It is
  // still the only thing that closes the menu on a click outside, and it would
  // go on rendering exactly the same if it stopped taking presses at all.
  it("closes the menu when the invisible overlay is pressed", () => {
    const screen = render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.getByText("To Do")).toBeTruthy();

    fireEvent.press(screen.getByTestId("menu-overlay"));

    expect(screen.queryByText("To Do")).toBeNull();
  });

  // The catcher is a sibling behind the menu, not its parent. Nested, a press
  // on the menu's own chrome — the title, a section heading, the container's
  // padding — found no responder of its own and bubbled to the catcher, so
  // clicking the header of a menu that had just popped open under the cursor
  // dismissed it.
  it("keeps the menu open when its own title is pressed", () => {
    const titled: TIconMenuSection[] = [
      {
        title: "Section Heading",
        options: [{ id: "todo", title: "To Do", onSelect: jest.fn() }],
      },
    ];
    const screen = render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Menu Title"
        sections={titled}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    fireEvent.press(screen.getByText("Menu Title"));
    expect(screen.getByText("To Do")).toBeTruthy();

    fireEvent.press(screen.getByText("Section Heading"));
    expect(screen.getByText("To Do")).toBeTruthy();
  });

  // jest-expo's window, which the clamps below are figured against.
  const VIEWPORT = { width: 750, height: 1334 };

  /** The menu's own box — the only element carrying both an edge and a lift. */
  const menuBox = (screen: ReturnType<typeof render>) =>
    hostsStyled(
      screen,
      (style) => (style.borderWidth ?? 0) > 0 && style.boxShadow !== undefined,
    )[0];

  const openAndMeasure = (
    screen: ReturnType<typeof render>,
    at: { x: number; y: number },
    measured: { width: number; height: number },
  ) => {
    fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: at.x, clientY: at.y },
    });
    fireEvent(menuBox(screen), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, ...measured } },
    });
    return StyleSheet.flatten(
      menuBox(screen).props.style as StyleProp<ViewStyle>,
    );
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
  it("pulls a menu opened near the bottom edge back on screen", () => {
    const screen = render(menu);
    const style = openAndMeasure(
      screen,
      { x: 10, y: 1300 },
      { width: 220, height: 300 },
    );

    expect(style.top).toBe(VIEWPORT.height - 300 - 8);
  });

  // The x clamp used to assume `MENU_WIDTH`, which is only a `minWidth` — a
  // long option label grows the menu past it and back off the right edge.
  it("clamps against the menu's measured width, not its minimum", () => {
    const screen = render(menu);
    const style = openAndMeasure(
      screen,
      { x: 700, y: 10 },
      { width: 400, height: 200 },
    );

    expect(style.left).toBe(VIEWPORT.width - 400 - 8);
  });

  it("leaves a menu that already fits where it was opened", () => {
    const screen = render(menu);
    const style = openAndMeasure(
      screen,
      { x: 100, y: 100 },
      { width: 220, height: 200 },
    );

    expect(style.left).toBe(100);
    // The anchor sits one margin below the cursor so the menu clears it.
    expect(style.top).toBe(100 + 8);
  });

  // The option row holds focus while it is pressed, so an action that focuses
  // something of its own — an inline edit's autoFocus input, say — has to run
  // after the row is unmounted or it loses the focus again (DEX-70, first seen
  // against RN `Modal`'s focus restore).
  it("runs the option's action only once the menu has closed", () => {
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
    const screen = render(
      <IconMenu accessibilityLabel="Status" sections={sectionsWithSpy}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Status"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    fireEvent.press(screen.getByText("To Do"));

    expect(menuStillOpen).toBe(false);
  });

  it("keeps a submenu section's options collapsed until its header is pressed", () => {
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
    const screen = render(
      <IconMenu
        accessibilityLabel="More"
        menuTitle="More"
        sections={submenuSections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("More"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();

    fireEvent.press(screen.getByText("Priority"));

    expect(screen.getByText("Urgent")).toBeTruthy();
  });

  it("calls onSelect for an option inside an expanded submenu", () => {
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
    const screen = render(
      <IconMenu
        accessibilityLabel="More"
        menuTitle="More"
        sections={submenuSections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("More"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    fireEvent.press(screen.getByText("Priority"));
    fireEvent.press(screen.getByText("Urgent"));

    expect(onSelect).toHaveBeenCalled();
  });

  it("opens a long-press menu on right-click and suppresses the browser menu", () => {
    const screen = render(
      <IconMenu
        accessibilityLabel="More"
        trigger="longPress"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(screen.queryByText("To Do")).toBeNull();

    const wrapper = screen.UNSAFE_root.find(
      (node) => typeof node.props.onContextMenu === "function",
    );
    const preventDefault = jest.fn();
    fireEvent(wrapper, "contextMenu", {
      clientX: 10,
      clientY: 10,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(screen.getByText("To Do")).toBeTruthy();
  });

  it("does not wire right-click for a tap menu, leaving the browser menu intact", () => {
    const screen = render(
      <IconMenu accessibilityLabel="Status" sections={sections}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(
      screen.UNSAFE_root.findAll(
        (node) => typeof node.props.onContextMenu === "function",
      ),
    ).toHaveLength(0);
    expect(screen.queryByText("To Do")).toBeNull();
  });

  it("opens on long-press instead of a regular press when configured for it", () => {
    const screen = render(
      <IconMenu
        accessibilityLabel="More"
        trigger="longPress"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("More"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.queryByText("To Do")).toBeNull();

    fireEvent(screen.getByLabelText("More"), "longPress", {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    expect(screen.getByText("To Do")).toBeTruthy();
  });
});
