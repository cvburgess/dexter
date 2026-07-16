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

  it("emits `state` only for checkable options, so action items stay buttons", () => {
    const mixedSections: TIconMenuSection[] = [
      {
        options: [
          // Checkable options declare `isSelected` (renders as a toggle).
          { id: "on", title: "On", isSelected: true, onSelect: jest.fn() },
          { id: "off", title: "Off", isSelected: false, onSelect: jest.fn() },
          // Action item: no `isSelected` -> must not become a stateful toggle.
          { id: "action", title: "Action", onSelect: jest.fn() },
        ],
      },
    ];

    render(
      <IconMenu accessibilityLabel="Menu" sections={mixedSections}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    const { actions } = mockMenuView.mock.calls.at(-1)![0] as {
      actions: { subactions: { id: string; state?: string }[] }[];
    };
    const stateById = Object.fromEntries(
      actions[0].subactions.map((a) => [a.id, a.state]),
    );

    expect(stateById).toEqual({ on: "on", off: "off", action: undefined });
  });
});
