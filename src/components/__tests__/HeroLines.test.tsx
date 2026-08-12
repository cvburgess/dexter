import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, TextStyle } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { HeroLines, stageWindow, type THeroLine } from "@/components/HeroLines";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { themes } from "@/utils/theme";

jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(() => false),
}));

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

const { colors } = themes.dexter;

const LINES: THeroLine[] = [
  { key: "events", figure: "3", words: "events", color: colors.text },
  { key: "planned", figure: "5h 30m", words: "planned", color: colors.error },
  { key: "free", figure: "8h 30m", words: "free", color: colors.success },
];

/** Stands in for a step: `HeroLines` takes a shared value it does not own. */
function Host({ lines = LINES }: { lines?: THeroLine[] }) {
  const reveal = useSharedValue(1);
  return <HeroLines lines={lines} reveal={reveal} testID="hero-block" />;
}

const figure = (screen: ReturnType<typeof render>, key: string) =>
  screen.getByTestId(`hero-figure-${key}`);

const minWidthOf = (screen: ReturnType<typeof render>, key: string) =>
  StyleSheet.flatten(figure(screen, key).props.style as TextStyle).minWidth;

/** Reports a measured width for a figure, as layout would. */
const layOut = (
  screen: ReturnType<typeof render>,
  widths: Record<string, number>,
) =>
  act(() => {
    for (const [key, width] of Object.entries(widths)) {
      fireEvent(figure(screen, key), "layout", {
        nativeEvent: { layout: { width, height: 30, x: 0, y: 0 } },
      });
    }
  });

beforeEach(() => {
  mockUseIsLargeDevice.mockReturnValue(false);
});

describe("HeroLines", () => {
  it("renders a figure and its words per line", () => {
    const screen = render(<Host />);

    expect(figure(screen, "events")).toBeTruthy();
    expect(screen.getByText("planned")).toBeTruthy();
    expect(screen.getByText("free")).toBeTruthy();
  });

  // Split across two `Text`s for the column, a line would otherwise be read as
  // a bare figure and then an orphaned fragment.
  it("reads each line as one phrase", () => {
    const screen = render(<Host />);

    expect(screen.getByLabelText("3 events")).toBeTruthy();
    expect(screen.getByLabelText("5h 30m planned")).toBeTruthy();
    expect(screen.getByLabelText("8h 30m free")).toBeTruthy();
  });

  describe("the figure column", () => {
    // Without a shared width the words would start at a different x on every
    // line whose figure is a different length, which is the whole point.
    it("gives every figure the widest figure's width", () => {
      const screen = render(<Host />);

      layOut(screen, { events: 11, planned: 64, free: 58 });

      for (const key of ["events", "planned", "free"]) {
        expect(minWidthOf(screen, key)).toBe(64);
      }
    });

    // The narrower figures re-measure at exactly the `minWidth` just applied,
    // so the second pass reports no change and the value settles.
    it("settles rather than oscillating as the narrower figures re-measure", () => {
      const screen = render(<Host />);

      layOut(screen, { events: 11, planned: 64, free: 58 });
      layOut(screen, { events: 64, planned: 64, free: 64 });

      expect(minWidthOf(screen, "events")).toBe(64);
    });

    // Monotonic on purpose: a figure shrinking leaves the column a little wide
    // rather than re-flowing the hero out from under the reader.
    it("does not narrow when a figure gets shorter", () => {
      const screen = render(<Host />);

      layOut(screen, { planned: 64 });
      layOut(screen, { planned: 20 });

      expect(minWidthOf(screen, "planned")).toBe(64);
    });
  });

  // The stage table's arithmetic, tested on this side of the worklet boundary —
  // past it the reanimated mock shows nothing, so a `NaN` window would render
  // as a body that simply never appears, on device only.
  describe("the stage windows", () => {
    // Four hero lines (the most `THeroLinesProps` allows) and then the body. A
    // step that draws four figures stages its body at 4, which is exactly the
    // index that did not exist before DEX-148.
    it.each([0, 1, 2, 3, 4])("stage %i lands inside the reveal", (stage) => {
      const [from, to] = stageWindow(stage);

      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(1);
    });

    // The invariant the module's doc block states: the last window closes as
    // the driver lands, so the tail of the sequence is not dead time.
    it("closes the last window exactly as the reveal completes", () => {
      expect(stageWindow(4)[1]).toBeCloseTo(1, 10);
    });

    // DEX-148 added a fifth stage by lengthening `REVEAL_MS`, not by respacing
    // the others. Scaled back to milliseconds, the first four still start where
    // they always did — 864ms apart — so no existing step's rhythm moved.
    it("leaves the first four stages where they were", () => {
      const totalMs = 4 * 864 + 1008;
      const startsMs = [0, 1, 2, 3].map((stage) =>
        Math.round(stageWindow(stage)[0] * totalMs),
      );

      expect(startsMs).toEqual([0, 864, 1728, 2592]);
    });
  });
});
