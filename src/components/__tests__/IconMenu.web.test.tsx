import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { IconMenu } from "../IconMenu.web";
import { TIconMenuSection } from "../IconMenu.types";

/** `styles.checkmark`'s width — the slot that aligns a checkable row. */
const CHECKMARK_WIDTH = 18;

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

  // The menu is a `Modal`, and react-native-web's modal restores focus to
  // whatever was focused before it opened — from its unmount cleanup. An action
  // run inline would still be inside that commit, so anything it focuses (an
  // inline edit's autoFocus input, say) has the focus taken straight back.
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

  it("renders an option's label in its titleColor when set", () => {
    const colored: TIconMenuSection[] = [
      {
        options: [
          {
            id: "backlog",
            title: "Backlog",
            titleColor: "#fcb700",
            onSelect: jest.fn(),
          },
        ],
      },
    ];
    const screen = render(
      <IconMenu accessibilityLabel="Switch view" sections={colored}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Switch view"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    const style = screen.getByText("Backlog").props.style as { color?: string };
    expect(style.color).toBe("#fcb700");
  });

  // The empty checkmark slot is what indents a row. A group of plain actions
  // has nothing to check, so it lines up with the submenu headers above it.
  it("reserves the checkmark column only for a section that can be checked", () => {
    const mixed: TIconMenuSection[] = [
      {
        options: [
          {
            id: "todo",
            title: "To Do",
            isSelected: false,
            onSelect: jest.fn(),
          },
        ],
      },
      { options: [{ id: "delete", title: "Delete", onSelect: jest.fn() }] },
    ];
    const screen = render(
      <IconMenu accessibilityLabel="Actions" sections={mixed}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Actions"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    // One slot, held open by the unchecked "To Do"; none for "Delete".
    expect(
      hostsStyled(screen, (style) => style.width === CHECKMARK_WIDTH),
    ).toHaveLength(1);
  });

  // The checkmark sits where the header's icon does, which is the alignment
  // that reads as nesting — an extra indent on top of it only breaks the column.
  it("does not indent a checkable submenu's rows past their header", () => {
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
      <IconMenu accessibilityLabel="More" sections={submenuSections}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("More"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });
    fireEvent.press(screen.getByText("Priority"));

    const rows = hostsStyled(
      screen,
      (style) =>
        style.paddingHorizontal === 16 && style.flexDirection === "row",
    );
    // Header and option row alike, inset only by the menu's own padding.
    expect(rows).toHaveLength(2);
    expect(
      hostsStyled(screen, (style) => style.paddingLeft !== undefined),
    ).toHaveLength(0);
  });

  it("omits the rule above a section that continues the one before it", () => {
    const joined: TIconMenuSection[] = [
      { options: [{ id: "a", title: "First", onSelect: jest.fn() }] },
      {
        hideDivider: true,
        options: [{ id: "b", title: "Second", onSelect: jest.fn() }],
      },
      { options: [{ id: "c", title: "Third", onSelect: jest.fn() }] },
    ];
    const screen = render(
      <IconMenu accessibilityLabel="Actions" sections={joined}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    fireEvent.press(screen.getByLabelText("Actions"), {
      nativeEvent: { clientX: 10, clientY: 10 },
    });

    // One rule for three sections: the first never draws one, the joined
    // section opts out, and only the third separates itself from what's above.
    expect(
      hostsStyled(screen, (style) => (style.borderTopWidth ?? 0) > 0),
    ).toHaveLength(1);
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
