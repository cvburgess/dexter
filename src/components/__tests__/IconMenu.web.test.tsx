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
});
