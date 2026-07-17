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

    const { actions } = mockMenuView.mock.calls.at(-1)![0] as unknown as {
      actions: { subactions: { id: string; state?: string }[] }[];
    };
    const stateById = Object.fromEntries(
      actions[0].subactions.map((a) => [a.id, a.state]),
    );

    expect(stateById).toEqual({ on: "on", off: "off", action: undefined });
  });

  it("forwards a colored action item's icon tint without making it a toggle", () => {
    // The colored Backlog action stays a plain button (no `state`); its icon is
    // tinted natively via the patched @expo/ui menu (see patches/@expo+ui).
    const coloredSections: TIconMenuSection[] = [
      {
        options: [
          {
            id: "backlog",
            title: "Backlog",
            icon: "tray.full",
            iconColor: "#fcb700",
            onSelect: jest.fn(),
          },
        ],
      },
    ];

    render(
      <IconMenu accessibilityLabel="Menu" sections={coloredSections}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    const { actions } = mockMenuView.mock.calls.at(-1)![0] as unknown as {
      actions: {
        subactions: { id: string; state?: string; imageColor?: string }[];
      }[];
    };
    const backlog = actions[0].subactions.find((a) => a.id === "backlog");

    expect(backlog?.imageColor).toBe("#fcb700");
    expect(backlog?.state).toBeUndefined();
  });
});
