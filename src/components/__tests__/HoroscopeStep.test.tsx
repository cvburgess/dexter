import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, useColorScheme } from "react-native";

import { THoroscope, TSunSign } from "@/api/horoscopes";
import { HoroscopeStep } from "@/components/HoroscopeStep";
import { useHoroscope } from "@/hooks/useHoroscope";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { useSunSignPreference } from "@/hooks/usePreferences";
import { LIFE_AREAS, RATING_BUCKETS, SUN_SIGNS } from "@/utils/horoscope";
import { SERIF } from "@/utils/theme";

jest.mock("@/hooks/usePreferences", () => ({
  useSunSignPreference: jest.fn(),
}));
jest.mock("@/hooks/useHoroscope", () => ({ useHoroscope: jest.fn() }));
// Mocked rather than driven through `useWindowDimensions` — jest-expo doesn't
// mock RN's hook cleanly; that is why `useIsLargeDevice` is a thin wrapper.
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

// With no ThemeProvider, `useTheme` resolves the scheme from this submodule —
// same mock as `utils/__tests__/theme.test.ts`, for the same reason.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(() => "light"),
}));

const mockPush = jest.fn();
// `useFocusEffect` stands in as mount/unmount for `useHoroscopeAudio`; the
// player is inert here (jest.setup.js), so nothing in this file hears anything.
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => effect(), [effect]);
    },
    useRouter: () => ({ push: mockPush }),
  };
});

const mockUseSunSign = useSunSignPreference as jest.MockedFunction<
  typeof useSunSignPreference
>;
const mockUseHoroscope = useHoroscope as jest.MockedFunction<
  typeof useHoroscope
>;
const mockUseColorScheme = jest.mocked(useColorScheme);
const mockUseIsLargeDevice = jest.mocked(useIsLargeDevice);

const DATE = Temporal.PlainDate.from("2026-08-09");

const HOROSCOPE: THoroscope = {
  sunSign: "leo",
  date: "2026-08-09",
  text: "A day that rewards saying the thing out loud.",
  overallRating: 4,
  sentiment: "positive",
  tips: ["Say the thing.", "Sleep on the rest.", "Take the short trip."],
  // Spread across all three buckets so the columns each have something to draw.
  ratingIdentity: 5,
  ratingHealth: 1,
  ratingFinance: 3,
  ratingCareer: 4,
  ratingLove: 2,
  ratingRelationships: 3,
  ratingCreativity: 5,
  ratingSpirituality: 3,
  ratingHome: 3,
  ratingLearning: 3,
  ratingCommunication: 3,
  ratingTravel: 3,
};

const renderStep = ({
  sunSign = "leo",
  isLoadingSign = false,
  horoscope = HOROSCOPE,
  isLoading = false,
  largeScreen = false,
}: {
  sunSign?: TSunSign | null;
  isLoadingSign?: boolean;
  horoscope?: THoroscope | null;
  isLoading?: boolean;
  largeScreen?: boolean;
} = {}) => {
  mockUseSunSign.mockReturnValue({ sunSign, isLoading: isLoadingSign });
  mockUseHoroscope.mockReturnValue([horoscope, { isLoading }]);
  mockUseIsLargeDevice.mockReturnValue(largeScreen);
  return render(<HoroscopeStep date={DATE} />);
};

/** The scroller's horizontal padding — the gutter under test below. */
const gutterOf = (screen: ReturnType<typeof renderStep>) =>
  StyleSheet.flatten(
    screen.getByTestId("horoscope-scroll").props.contentContainerStyle,
  ).paddingHorizontal;

describe("HoroscopeStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` drops the factory's default too; a test that cares about
    // the scheme must set it explicitly rather than inherit a blank.
    mockUseColorScheme.mockReturnValue("light");
  });

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

  // A day the generator never covered is an empty state, not an error —
  // DayNav can walk to dates before the cron job existed.
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

  // An unread sign is `null`, exactly like a never-picked one — hence
  // `useSunSignPreference`, whose loading flag `usePreferences`' placeholder lacks.
  it("does not prompt for a sign while the preference is still loading", () => {
    const screen = renderStep({
      sunSign: null,
      isLoadingSign: true,
      horoscope: null,
    });

    expect(screen.queryByText(/Pick your sun sign/)).toBeNull();
    expect(screen.queryByText("Choose your sign")).toBeNull();
  });

  describe("with the day's horoscope", () => {
    it("leads with the sign's glyph and the day's first tip", () => {
      const screen = renderStep();

      expect(screen.getByText(SUN_SIGNS.leo.glyph)).toBeTruthy();
      expect(screen.getByText(HOROSCOPE.tips[0])).toBeTruthy();
    });

    // The resets are the real assertion: the loaded file is already bold and
    // italic, so a leftover weight/slant stacks a synthetic one — invisibly.
    it("sets every tip in the serif, with no synthetic weight or slant", () => {
      const screen = renderStep();

      for (const tip of HOROSCOPE.tips) {
        const style = StyleSheet.flatten(screen.getByText(tip).props.style);

        expect(style.fontFamily).toBe(SERIF.displayItalic);
        expect(style.fontWeight).toBe("normal");
        expect(style.fontStyle).toBe("normal");
      }
    });

    // The upstream prose stays stored but deliberately off screen; asserted so
    // "keep it in the DB" cannot quietly become "put it back on screen".
    it("never renders the upstream's own text", () => {
      const screen = renderStep();

      expect(screen.queryByText(HOROSCOPE.text)).toBeNull();
    });

    // DEX-138. A comparison, not literals: the point is the roomier screen gets
    // the wider gutter — which a doubled density token got backwards on web.
    it("keeps a wider gutter on a large screen than on a phone", () => {
      const phone = gutterOf(renderStep());
      const large = gutterOf(renderStep({ largeScreen: true }));

      expect(large).toBeGreaterThan(phone);
    });

    // The glyph says which sign this is; the name restated the settings row
    // and pushed the summary down the screen to do it.
    it("does not name the sign", () => {
      const screen = renderStep();

      expect(screen.queryByText("Leo")).toBeNull();
    });

    // Zodiac code points default to emoji presentation; U+FE0E is what makes
    // the mark take `colors.text` like any other type.
    it("draws the glyph in text presentation, not as emoji", () => {
      renderStep();

      expect(SUN_SIGNS.leo.glyph).toContain("︎");
    });

    // The sky belongs to the horoscope, not the panel: an empty or loading
    // step is a plain surface, not a starfield with nothing on it.
    it("lays a starfield behind it, and only once there is one", () => {
      expect(renderStep().getByTestId("horoscope-sky")).toBeTruthy();

      expect(
        renderStep({ horoscope: null }).queryByTestId("horoscope-sky"),
      ).toBeNull();
      expect(
        renderStep({ sunSign: null, horoscope: null }).queryByTestId(
          "horoscope-sky",
        ),
      ).toBeNull();
    });

    // The panel is a night sky on every scheme — the stars used to be
    // dark-scheme only, back when light themes got a pale panel.
    it("draws stars on a light scheme as well", () => {
      mockUseColorScheme.mockReturnValue("light");

      expect(renderStep().getByTestId("horoscope-sky")).toBeTruthy();
    });

    it("renders the remaining tips below it, and the first one only once", () => {
      const screen = renderStep();

      for (const tip of HOROSCOPE.tips.slice(1)) {
        expect(screen.getByText(tip)).toBeTruthy();
      }
      // The hero took the first one, so repeating it below would show it twice.
      expect(screen.getAllByText(HOROSCOPE.tips[0])).toHaveLength(1);
    });

    it("draws a mark for each of the three rating bands", () => {
      const screen = renderStep();

      for (const bucket of RATING_BUCKETS) {
        expect(screen.getByText(bucket.glyph)).toBeTruthy();
      }
    });

    // Written out rather than derived from `lifeAreasInBucket` (which renders
    // them) — a derived expectation passes when both sides share a mistake.
    it("files each life area under the mark matching its rating", () => {
      const screen = renderStep();

      // ratingHealth: 1, ratingLove: 2
      expect(screen.getByText("Health, Love")).toBeTruthy();
      // ratingIdentity: 5, ratingCareer: 4, ratingCreativity: 5
      expect(screen.getByText("Identity, Career, Creativity")).toBeTruthy();
      // Everything else sits at 3.
      expect(
        screen.getByText(
          "Finance, Relationships, Spirituality, Home, Learning, Communication, Travel",
        ),
      ).toBeTruthy();
    });

    // An empty band still draws its row (the legend keeps its shape), but a
    // mark with nothing beside it reads as a bug rather than an absence.
    it("shows a dash for a band with no areas in it", () => {
      const allNeutral = Object.fromEntries(
        LIFE_AREAS.map((area) => [area.key, 3]),
      ) as unknown as THoroscope;
      const screen = renderStep({
        horoscope: { ...HOROSCOPE, ...allNeutral },
      });

      // Both ends are empty, so the dash is drawn twice.
      expect(screen.getAllByText("—")).toHaveLength(2);
    });

    // The hero is sized to the scroller, not its content — otherwise the
    // scroll-to-reveal reads as a list that merely happens to be long.
    it("sizes the hero to the measured viewport", () => {
      const screen = renderStep();

      fireEvent(screen.getByTestId("horoscope-scroll"), "layout", {
        nativeEvent: { layout: { height: 600 } },
      });

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
