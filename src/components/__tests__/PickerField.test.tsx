import { render, screen } from "@testing-library/react-native";
import { Children, isValidElement } from "react";

import { PickerField } from "../PickerField";

// The global jest.setup.js mock renders Picker as null, so it can't be driven
// from a test. Locally override with a capturing mock instead.
let lastPickerProps: Record<string, unknown> | null = null;
jest.mock("@expo/ui", () => {
  const Host = ({ children }: { children: React.ReactNode }) => children;
  const Picker = (props: Record<string, unknown>) => {
    lastPickerProps = props;
    return null;
  };
  Picker.Item = function PickerItem() {
    return null;
  };
  return { Host, Picker };
});

type TItemProps = { label: string; value: string };

const capturedItems = (): TItemProps[] =>
  Children.toArray(lastPickerProps?.children as React.ReactNode)
    .filter(isValidElement)
    .map((child) => child.props as TItemProps);

describe("PickerField", () => {
  beforeEach(() => {
    lastPickerProps = null;
  });

  const options = [
    { label: "None", value: "" },
    { label: "Groceries", value: "list-1" },
  ];

  it("renders the label via FormRow", () => {
    render(
      <PickerField
        label="List"
        options={options}
        selectedValue=""
        onValueChange={jest.fn()}
      />,
    );

    expect(screen.getByText("List")).toBeTruthy();
  });

  it("builds Picker.Item children from options, in order", () => {
    render(
      <PickerField
        label="List"
        options={options}
        selectedValue=""
        onValueChange={jest.fn()}
      />,
    );

    expect(capturedItems()).toEqual(options);
  });

  it("forwards selectedValue and testID", () => {
    render(
      <PickerField
        label="List"
        options={options}
        selectedValue="list-1"
        testID="new-task-list"
        onValueChange={jest.fn()}
      />,
    );

    expect(lastPickerProps?.selectedValue).toBe("list-1");
    expect(lastPickerProps?.testID).toBe("new-task-list");
  });

  it("calls onValueChange with the selected value", () => {
    const onValueChange = jest.fn();
    render(
      <PickerField
        label="List"
        options={options}
        selectedValue=""
        onValueChange={onValueChange}
      />,
    );

    const handler = lastPickerProps?.onValueChange as (v: string) => void;
    handler("list-1");

    expect(onValueChange).toHaveBeenCalledWith("list-1");
  });
});
