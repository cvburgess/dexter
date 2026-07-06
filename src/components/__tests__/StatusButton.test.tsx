import { render } from "@testing-library/react-native";

import { ETaskStatus } from "@/api/tasks";

import { getStatusSections, StatusButton } from "../StatusButton";

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
});
