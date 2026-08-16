import { fireEvent, render, screen } from "@testing-library/react-native";

import { Slider, valueAtPosition } from "@/components/Slider";

const RANGE = { min: 1, max: 10, step: 1 };

describe("valueAtPosition", () => {
  it("maps the ends of the track to the ends of the range", () => {
    expect(valueAtPosition(0, 90, RANGE)).toBe(1);
    expect(valueAtPosition(90, 90, RANGE)).toBe(10);
  });

  it("snaps to the nearest step rather than resting between two", () => {
    // 1–10 is nine intervals, so on a 90px track the stops are 10px apart and
    // value 5 sits at 40px.
    expect(valueAtPosition(40, 90, RANGE)).toBe(5);
    expect(valueAtPosition(44, 90, RANGE)).toBe(5);
    expect(valueAtPosition(46, 90, RANGE)).toBe(6);
    expect(valueAtPosition(50, 90, RANGE)).toBe(6);
  });

  it("clamps a position dragged past either end", () => {
    expect(valueAtPosition(-200, 90, RANGE)).toBe(1);
    expect(valueAtPosition(400, 90, RANGE)).toBe(10);
  });

  it("honours a step coarser than one", () => {
    expect(valueAtPosition(50, 100, { min: 0, max: 60, step: 15 })).toBe(30);
    expect(valueAtPosition(60, 100, { min: 0, max: 60, step: 15 })).toBe(30);
  });

  it("returns the minimum before the track has been measured", () => {
    // Otherwise the division yields NaN, which would travel out through
    // onValueChange and into a stored preference.
    expect(valueAtPosition(40, 0, RANGE)).toBe(1);
  });
});

describe("Slider", () => {
  const setup = (value = 3) => {
    const onValueChange = jest.fn();
    render(
      <Slider
        accessibilityLabel="Breaths"
        max={10}
        min={1}
        onValueChange={onValueChange}
        step={1}
        testID="breaths-slider"
        value={value}
      />,
    );
    return { onValueChange, slider: screen.getByTestId("breaths-slider") };
  };

  it("reports its range and current value to a screen reader", () => {
    const { slider } = setup(4);
    expect(slider.props.accessibilityRole).toBe("adjustable");
    expect(slider.props.accessibilityValue).toEqual({ max: 10, min: 1, now: 4 });
  });

  it("steps up and down through the accessibility actions", () => {
    const { onValueChange, slider } = setup(4);

    fireEvent(slider, "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    expect(onValueChange).toHaveBeenCalledWith(5);

    fireEvent(slider, "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });
    expect(onValueChange).toHaveBeenCalledWith(3);
  });

  it("does not step past either end", () => {
    const { onValueChange, slider } = setup(10);
    fireEvent(slider, "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    // Already at the maximum, so the value is unchanged and nothing is written.
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
