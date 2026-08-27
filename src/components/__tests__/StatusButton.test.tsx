import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ETaskStatus } from "@/api/tasks";

import { getStatusSections, StatusButton } from "../StatusButton";

const mockIconMenu = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

describe("getStatusSections", () => {
  it("lists all 5 statuses with icons and no selection checkmark", () => {
    const onChangeStatus = jest.fn();
    const [section] = getStatusSections(onChangeStatus);

    expect(section.options.map((option) => option.title)).toEqual([
      "To Do",
      "In Progress",
      "Done",
      "Won't Do",
      "Delegated",
    ]);
    expect(section.options.every((option) => option.icon)).toBe(true);
    expect(
      section.options.every((option) => option.isSelected === undefined),
    ).toBe(true);
  });

  it("calls onChangeStatus with the selected status", () => {
    const onChangeStatus = jest.fn();
    const [section] = getStatusSections(onChangeStatus);

    section.options.find((option) => option.title === "Done")?.onSelect();

    expect(onChangeStatus).toHaveBeenCalledWith(ETaskStatus.DONE);
  });

  it("tints each icon from the theme, leaving To Do neutral", () => {
    // Sentinels, not real hex values — pins which token each status reads,
    // not the literal color, which is the theme's business.
    const colors = {
      success: "GREEN",
      error: "RED",
      // Indexed by ETaskPriority — daisyUI [warning, error, info, ...].
      priority: ["YELLOW", "RED", "BLUE", "BASE", "NEUTRAL"],
    } as unknown as Parameters<typeof getStatusSections>[1];

    const [section] = getStatusSections(jest.fn(), colors);
    const tint = Object.fromEntries(
      section.options.map((option) => [option.title, option.iconColor]),
    );

    expect(tint).toEqual({
      "To Do": undefined,
      "In Progress": "YELLOW",
      Done: "GREEN",
      "Won't Do": "RED",
      Delegated: "BLUE",
    });
  });

  it("omits tints when no theme is supplied", () => {
    const [section] = getStatusSections(jest.fn());

    expect(
      section.options.every((option) => option.iconColor === undefined),
    ).toBe(true);
  });
});

describe("StatusButton", () => {
  // The trigger draws text, not the menu's SF Symbols, so every status needs a
  // glyph of its own — a missing case silently falls through to TODO's "○".
  it.each([
    [ETaskStatus.TODO, "○"],
    [ETaskStatus.IN_PROGRESS, "◐"],
    [ETaskStatus.DONE, "✓"],
    [ETaskStatus.WONT_DO, "✕"],
    [ETaskStatus.DELEGATED, "→"],
  ])("renders status %i as %s", (status, glyph) => {
    const screen = render(
      <StatusButton
        status={status}
        contentColor="#000000"
        onChangeStatus={jest.fn()}
      />,
    );

    expect(screen.getByText(glyph)).toBeTruthy();
  });

  it("pins the menu trigger to the button's 32×32 size", () => {
    // The trigger wrapper must never influence the task card row's height.
    render(
      <StatusButton
        status={ETaskStatus.TODO}
        contentColor="#000000"
        onChangeStatus={jest.fn()}
      />,
    );

    expect(mockIconMenu).toHaveBeenCalledWith(
      expect.objectContaining({ style: { height: 32, width: 32 } }),
    );
  });
});
