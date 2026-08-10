import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { THoroscope } from "@/api/horoscopes";
import { HoroscopeStep } from "@/components/HoroscopeStep";
import { useHoroscope } from "@/hooks/useHoroscope";
import { usePreferences } from "@/hooks/usePreferences";
import { HOROSCOPE_FACETS, SUN_SIGNS } from "@/utils/horoscope";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useHoroscope", () => ({ useHoroscope: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseHoroscope = useHoroscope as jest.MockedFunction<
  typeof useHoroscope
>;

const DATE = Temporal.PlainDate.from("2026-08-09");

const HOROSCOPE: THoroscope = {
  sunSign: "leo",
  date: "2026-08-09",
  summary: "A day that rewards saying the thing out loud.",
  sentiment: "positive",
  personalLife: "An old thread picks back up.",
  profession: "Momentum on the work you left half-done.",
  health: "Sleep is the whole strategy today.",
  emotions: "Steadier than yesterday, and you can tell.",
  travel: "Nothing far, but the short trip is worth it.",
  luck: "Favors the second attempt.",
};

const renderStep = ({
  sunSign = "leo",
  horoscope = HOROSCOPE,
  isLoading = false,
}: {
  sunSign?: string | null;
  horoscope?: THoroscope | null;
  isLoading?: boolean;
} = {}) => {
  mockUsePreferences.mockReturnValue([
    { sunSign } as never,
    { updatePreferences: jest.fn() },
  ]);
  mockUseHoroscope.mockReturnValue([horoscope, { isLoading }]);
  return render(<HoroscopeStep date={DATE} />);
};

describe("HoroscopeStep", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("with no sign chosen", () => {
    it("prompts for one instead of querying", () => {
      const screen = renderStep({ sunSign: null, horoscope: null });

      expect(screen.getByText(/Pick your sun sign/)).toBeTruthy();
      // The hook is still called (rules of hooks), but with no sign — which is
      // what gates the query off.
      expect(mockUseHoroscope).toHaveBeenCalledWith(null, "2026-08-09");
    });

    it("sends the user to the setting that fixes it", () => {
      const screen = renderStep({ sunSign: null, horoscope: null });

      fireEvent.press(screen.getByText("Choose your sign"));

      expect(mockPush).toHaveBeenCalledWith("/settings/ritual");
    });
  });

  // A day the generator never covered is an empty state, not an error — the
  // ritual's DayNav can walk to any date, including ones before the cron job
  // existed.
  it("says so when the day has no row", () => {
    const screen = renderStep({ horoscope: null });

    expect(screen.getByText("No horoscope for Aug 9, 2026 yet.")).toBeTruthy();
  });

  it("shows nothing rather than a spinner while loading", () => {
    const screen = renderStep({ horoscope: null, isLoading: true });

    expect(screen.queryByText(/No horoscope/)).toBeNull();
    expect(screen.queryByText(/Pick your sun sign/)).toBeNull();
    expect(screen.getByTestId("horoscope-panel")).toBeTruthy();
  });

  describe("with the day's horoscope", () => {
    it("leads with the sign and its summary", () => {
      const screen = renderStep();

      expect(screen.getByText(SUN_SIGNS.leo.glyph)).toBeTruthy();
      expect(screen.getByText("Leo")).toBeTruthy();
      expect(screen.getByText(HOROSCOPE.summary)).toBeTruthy();
    });

    it("renders every facet below it", () => {
      const screen = renderStep();

      for (const facet of HOROSCOPE_FACETS) {
        expect(screen.getByText(facet.label)).toBeTruthy();
        expect(screen.getByText(HOROSCOPE[facet.key])).toBeTruthy();
      }
    });

    // The facets are meant to start below the fold, so the hero is sized to the
    // scroller rather than to its own content — otherwise the "scroll to
    // reveal" reads as a list that merely happens to be long.
    it("sizes the hero to the measured viewport", () => {
      const screen = renderStep();

      fireEvent(screen.getByTestId("horoscope-scroll"), "layout", {
        nativeEvent: { layout: { height: 600 } },
      });

      expect(screen.getByText("Leo").parent).toBeTruthy();
      expect(
        screen.UNSAFE_root.findAll(
          (node) =>
            Array.isArray(node.props.style) &&
            node.props.style.some(
              (style: { minHeight?: number } | undefined) =>
                style?.minHeight === 600,
            ),
        ).length,
      ).toBeGreaterThan(0);
    });
  });
});
