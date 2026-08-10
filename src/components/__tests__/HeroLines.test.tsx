import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, TextStyle } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { HeroLines, type THeroLine } from "@/components/HeroLines";
import { themes } from "@/utils/theme";

const { colors } = themes.dexter;

const LINES: THeroLine[] = [
  { key: "events", figure: "3", words: "events", color: colors.text },
  { key: "planned", figure: "5h 30m", words: "planned", color: colors.error },
  { key: "free", figure: "8h 30m", words: "free", color: colors.success },
];

/** Stands in for a step: `HeroLines` takes a shared value it does not own. */
function Host({ lines = LINES }: { lines?: THeroLine[] }) {
  const reveal = useSharedValue(1);
  return <HeroLines lines={lines} reveal={reveal} />;
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

  it("colors the figure and leaves the words in ink", () => {
    const screen = render(<Host />);

    expect(
      StyleSheet.flatten(figure(screen, "planned").props.style as TextStyle)
        .color,
    ).toBe(colors.error);
    expect(
      StyleSheet.flatten(screen.getByText("planned").props.style as TextStyle)
        .color,
    ).toBe(colors.text);
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
});
