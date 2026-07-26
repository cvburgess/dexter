import { render, screen } from "@testing-library/react-native";

import {
  pickerOptions,
  pickerProps,
  resetPicker,
} from "@/testUtils/mockExpoUiPicker";

import { PickerField } from "../PickerField";

// The global jest.setup.js mock renders Picker as null, so it can't be driven
// from a test. Locally override with a capturing mock instead.
jest.mock("@expo/ui", () =>
  jest
    .requireActual<typeof import("@/testUtils/mockExpoUiPicker")>(
      "@/testUtils/mockExpoUiPicker",
    )
    .mockExpoUiPicker(),
);

describe("PickerField", () => {
  beforeEach(() => {
    resetPicker();
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

    expect(pickerOptions()).toEqual(options);
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

    expect(pickerProps()?.selectedValue).toBe("list-1");
    expect(pickerProps()?.testID).toBe("new-task-list");
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

    const handler = pickerProps()?.onValueChange as (v: string) => void;
    handler("list-1");

    expect(onValueChange).toHaveBeenCalledWith("list-1");
  });
});
