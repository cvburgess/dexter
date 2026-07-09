import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

import { ETaskStatus } from "@/api/tasks";

import { getStatusSections, StatusButton } from "../StatusButton";

const mockIconMenu = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

describe("getStatusSections", () => {
  it("lists all 4 statuses with icons and no selection checkmark", () => {
    const onChangeStatus = jest.fn();
    const [section] = getStatusSections(onChangeStatus);

    expect(section.options.map((option) => option.title)).toEqual([
      "To Do",
      "In Progress",
      "Done",
      "Won't Do",
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
});

describe("StatusButton", () => {
  it("renders a glyph representing the current status", () => {
    const screen = render(
      <StatusButton
        status={ETaskStatus.DONE}
        contentColor="#000000"
        onChangeStatus={jest.fn()}
      />,
    );

    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("cages the native menu host in a fixed 32×32 frame", () => {
    // The @expo/ui Host writes its async SwiftUI measurement back into its own
    // layout node, overriding any style passed to it — only a plain fixed-size
    // wrapper View keeps it from collapsing or ballooning the task card row.
    const screen = render(
      <StatusButton
        status={ETaskStatus.TODO}
        contentColor="#000000"
        onChangeStatus={jest.fn()}
      />,
    );

    const frame = screen.getByTestId("status-menu-frame");
    expect(StyleSheet.flatten(frame.props.style)).toMatchObject({
      height: 32,
      width: 32,
      overflow: "hidden",
    });
    expect(mockIconMenu).toHaveBeenCalledWith(
      expect.objectContaining({ style: { height: 32, width: 32 } }),
    );
  });
});
