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

  it("pins the native menu host to the trigger's 32×32 size", () => {
    // Without explicit dimensions the @expo/ui Host sizes asynchronously and
    // can transiently collapse or balloon the task card row it sits in.
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
