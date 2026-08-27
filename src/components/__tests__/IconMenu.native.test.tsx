import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text, useColorScheme } from "react-native";

import { ThemeContext, type TThemePalette, themes } from "@/utils/theme";

import { IconMenu } from "../IconMenu.native";
import { TIconMenuSection } from "../IconMenu.types";

const mockMenuView = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("@expo/ui/community/menu", () => ({
  MenuView: (props: Parameters<typeof mockMenuView>[0]) => mockMenuView(props),
}));

// Controls the scheme useTheme resolves — see theme.test.ts's same note.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(useColorScheme).mockReturnValue("light");
});

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

  // The system draws a separator around every inline group, so a section that
  // continues the one before it can't be one — its options go up a level.
  it("flattens a continuing section into bare top-level actions", () => {
    const continuing: TIconMenuSection[] = [
      {
        title: "Priority",
        isSubmenu: true,
        options: [{ id: "urgent", title: "Urgent", onSelect: jest.fn() }],
      },
      {
        hideDivider: true,
        options: [{ id: "alarm", title: "Set alarm", onSelect: jest.fn() }],
      },
      { options: [{ id: "delete", title: "Delete", onSelect: jest.fn() }] },
    ];

    render(
      <IconMenu accessibilityLabel="More" sections={continuing}>
        <Text>Trigger</Text>
      </IconMenu>,
    );

    const { actions } = mockMenuView.mock.calls.at(-1)![0] as unknown as {
      actions: {
        id: string;
        title: string;
        displayInline?: boolean;
        subactions?: { id: string }[];
      }[];
    };

    expect(actions.map((action) => action.id)).toEqual([
      "section-0",
      "alarm",
      "section-2",
    ]);
    // The flattened action is a leaf, not a group of one.
    expect(actions[1].subactions).toBeUndefined();
    expect(actions[1].title).toBe("Set alarm");
    // The sections around it are untouched.
    expect(actions[0].displayInline).toBe(false);
    expect(actions[2].displayInline).toBe(true);
  });

  it("forwards a colored action item's icon tint without making it a toggle", () => {
    // The colored Backlog action stays a plain button (no `state`); its icon is
    // tinted natively via `.tint` in @expo/ui >= 57.0.8.
    const coloredSections: TIconMenuSection[] = [
      {
        options: [
          {
            id: "backlog",
            title: "Backlog",
            icon: { sf: "tray.full", ionicon: "file-tray-full-outline" },
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

  // Android themes its Compose menu from `colorScheme`; omitting it makes the
  // menu follow the device rather than the theme the user picked in-app.
  describe("colorScheme", () => {
    // `palette` omitted renders with no provider, the case `useTheme` serves
    // from the device scheme.
    const renderWith = (palette?: TThemePalette) => {
      const menu = (
        <IconMenu accessibilityLabel="Status" sections={sections}>
          <Text>Trigger</Text>
        </IconMenu>
      );

      render(
        palette ? (
          <ThemeContext.Provider value={palette}>{menu}</ThemeContext.Provider>
        ) : (
          menu
        ),
      );

      const { colorScheme } = mockMenuView.mock.calls.at(-1)![0] as unknown as {
        colorScheme: string;
      };

      return colorScheme;
    };

    it("follows a dark palette even when the device is light", () => {
      jest.mocked(useColorScheme).mockReturnValue("light");

      expect(renderWith(themes.abyss)).toBe("dark");
    });

    it("follows a light palette even when the device is dark", () => {
      jest.mocked(useColorScheme).mockReturnValue("dark");

      expect(renderWith(themes.dexter)).toBe("light");
    });

    it("falls back to the device scheme with no theme provider", () => {
      jest.mocked(useColorScheme).mockReturnValue("dark");

      expect(renderWith()).toBe("dark");
    });
  });
});
