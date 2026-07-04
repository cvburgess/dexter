import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { IconMenu } from "../IconMenu.native";
import { TIconMenuSection } from "../IconMenu.types";

const mockMenuView = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("@expo/ui/community/menu", () => ({
  MenuView: (props: Parameters<typeof mockMenuView>[0]) => mockMenuView(props),
}));

const sections: TIconMenuSection[] = [
  {
    options: [
      { id: "todo", title: "To Do", isSelected: false, onSelect: jest.fn() },
    ],
  },
];

describe("IconMenu (native)", () => {
  it("opens on tap by default, with the given menu title", () => {
    render(
      <IconMenu
        accessibilityLabel="Status"
        menuTitle="Status"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(mockMenuView).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldOpenOnLongPress: false,
        title: "Status",
      }),
    );
  });

  it("opens on long-press with no title when configured for it", () => {
    render(
      <IconMenu
        accessibilityLabel="More"
        trigger="longPress"
        sections={sections}
      >
        <Text>Trigger</Text>
      </IconMenu>,
    );

    expect(mockMenuView).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldOpenOnLongPress: true,
        title: undefined,
      }),
    );
  });
});
