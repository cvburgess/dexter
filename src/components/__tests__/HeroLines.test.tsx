import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, TextStyle, ViewStyle } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { HeroLines, type THeroLine } from "@/components/HeroLines";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { ritualStepInsetTop } from "@/utils/ritualSteps";
import { DENSITY, themes } from "@/utils/theme";

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

// The scale `useTheme` resolves to outside a provider — `DENSITY` is where it
// reads them from, so this is the same object the component sees.
const { space } = DENSITY.comfortable;

/** Stands in for a step: `HeroLines` takes a shared value it does not own. */
function Host({
  lines = LINES,
  bodyInsetTop,
}: {
  lines?: THeroLine[];
  bodyInsetTop?: number;
}) {
  const reveal = useSharedValue(1);
  return (
    <HeroLines
      bodyInsetTop={bodyInsetTop}
      lines={lines}
      reveal={reveal}
      testID="hero-block"
    />
  );
}

/** The hero block's own vertical padding. */
const paddingOf = (screen: ReturnType<typeof render>) => {
  const style = StyleSheet.flatten(
    screen.getByTestId("hero-block").props.style as ViewStyle[],
  );
  return {
    top: style.paddingTop as number,
    bottom: style.paddingBottom as number,
  };
};

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

// The ritual layout puts its step inset above the block, so equal padding on
// both sides left the hero sitting visibly low. What has to match is the
// *total*: `inset + paddingTop` above, `paddingBottom + bodyInsetTop` below.
describe("its vertical spacing", () => {
  const isEven = (
    screen: ReturnType<typeof render>,
    {
      isLargeDevice,
      bodyInsetTop = 0,
    }: {
      isLargeDevice: boolean;
      bodyInsetTop?: number;
    },
  ) => {
    const { top, bottom } = paddingOf(screen);
    const inset = ritualStepInsetTop(space, isLargeDevice);
    expect(inset + top).toBe(bottom + bodyInsetTop);
  };

  it.each([false, true])(
    "leaves the same room above and below the hero (large: %s)",
    (isLargeDevice) => {
      mockUseIsLargeDevice.mockReturnValue(isLargeDevice);

      isEven(render(<Host />), { isLargeDevice });
    },
  );

  // The Backlog step's drawer pads itself, and that padding lands under the
  // hero; stacked rather than absorbed, the gap below would outgrow the space
  // above by exactly it.
  it.each([false, true])(
    "absorbs padding the body brings itself (large: %s)",
    (isLargeDevice) => {
      mockUseIsLargeDevice.mockReturnValue(isLargeDevice);
      const bodyInsetTop = 16;

      const screen = render(<Host bodyInsetTop={bodyInsetTop} />);

      isEven(screen, { isLargeDevice, bodyInsetTop });
      expect(paddingOf(screen).bottom).toBe(
        paddingOf(render(<Host />)).bottom - bodyInsetTop,
      );
    },
  );
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
