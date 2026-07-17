import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { IconMenu } from "../IconMenu.web";
import { TIconMenuSection } from "../IconMenu.types";

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
