import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { FormRow } from "../FormRow";

describe("FormRow", () => {
  it("renders the label and children", () => {
    render(
      <FormRow label="Priority">
        <Text>High</Text>
      </FormRow>,
    );

    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
  });

  it("defaults to a 40px minimum height", () => {
    render(
      <FormRow label="List">
        <Text>None</Text>
      </FormRow>,
    );

    const row = screen.UNSAFE_getByType(View);
    const flatStyle = [row.props.style].flat(Infinity);
    expect(flatStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ minHeight: 40 })]),
    );
  });

  it("accepts a custom minHeight", () => {
    render(
      <FormRow label="Schedule" minHeight={32}>
        <Text>Today</Text>
      </FormRow>,
    );

    const row = screen.UNSAFE_getByType(View);
    const flatStyle = [row.props.style].flat(Infinity);
    expect(flatStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ minHeight: 32 })]),
    );
  });
});
