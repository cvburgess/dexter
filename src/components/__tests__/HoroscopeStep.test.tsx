import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, useColorScheme } from "react-native";

import { THoroscope, TSunSign } from "@/api/horoscopes";
import { HoroscopeStep } from "@/components/HoroscopeStep";
import { useHoroscope } from "@/hooks/useHoroscope";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { useSunSignPreference } from "@/hooks/usePreferences";
import { HOROSCOPE_FACETS, SUN_SIGNS } from "@/utils/horoscope";

jest.mock("@/hooks/usePreferences", () => ({
  useSunSignPreference: jest.fn(),
}));
jest.mock("@/hooks/useHoroscope", () => ({ useHoroscope: jest.fn() }));
// Mocked rather than driven through `useWindowDimensions` — jest-expo doesn't
// mock RN's hook cleanly, which is the reason `useIsLargeDevice` is a thin
// wrapper in the first place (see its docstring and docs/design.md).
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

// The star field is dark-scheme only, and with no ThemeProvider `useTheme`
// resolves the scheme from here — see `utils/__tests__/theme.test.ts`, which
// mocks the same submodule for the same reason.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(() => "light"),
}));

const mockPush = jest.fn();
// `useFocusEffect` is here for `useHoroscopeAudio`, which owns the step's
// track: it runs on focus and cleans up on blur, and this stands that in as
// mount/unmount. Its own behaviour is asserted in
// `hooks/__tests__/useHoroscopeAudio.test.ts`; the player is inert here (see
// `jest.setup.js`), so nothing in this file hears anything.
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
    // `clearAllMocks` drops the factory's default too, and a scheme of
    // `undefined` resolves to light — stated here so a test that cares about
    // the starfield sets it explicitly rather than inheriting a blank.
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

  // An unread sign is `null`, exactly like a sign the user never picked — so
  // ordering the branches the other way flashes the prompt, and its button, at
  // every user who already has one, on every cold open. This is why the step
  // reads `useSunSignPreference` rather than `usePreferences`, whose
  // placeholder row cannot report that it is a placeholder.
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
    it("leads with the sign's glyph and the day's summary", () => {
      const screen = renderStep();

      expect(screen.getByText(SUN_SIGNS.leo.glyph)).toBeTruthy();
      expect(screen.getByText(HOROSCOPE.summary)).toBeTruthy();
    });

    // DEX-138: the panel is capped at a fixed width on a large screen, so the
    // gutter is the only thing left deciding how the card breathes. Asserted as
    // a comparison rather than against literals because `space.lg` is a density
    // token — the point is that the roomier screen gets the wider gutter, which
    // is what the doubled gutter got backwards on web, where `compact` shrinks
    // the token underneath it.
    it("keeps a wider gutter on a large screen than on a phone", () => {
      const phone = gutterOf(renderStep());
      const large = gutterOf(renderStep({ largeScreen: true }));

      expect(large).toBeGreaterThan(phone);
    });

    // The glyph says which sign this is; the name would only restate what the
    // settings row the user set it from already told them, and it pushed the
    // summary down the screen to do it.
    it("does not name the sign", () => {
      const screen = renderStep();

      expect(screen.queryByText("Leo")).toBeNull();
    });

    // The zodiac code points have `Emoji_Presentation=Yes`, so a bare one
    // renders as a full-color emoji in a palette no theme controls. U+FE0E is
    // what makes the mark take `colors.text` like any other type.
    it("draws the glyph in text presentation, not as emoji", () => {
      renderStep();

      expect(SUN_SIGNS.leo.glyph).toContain("︎");
    });

    // The sky belongs to the horoscope, not to the panel: an empty or
    // still-loading step is a plain surface rather than a starfield with
    // nothing on it.
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

    // The panel is a night sky whatever scheme the device is on, so the stars
    // are too — they used to be dark-scheme only, back when a light theme got a
    // pale panel to match its own ink.
    it("draws stars on a light scheme as well", () => {
      mockUseColorScheme.mockReturnValue("light");

      expect(renderStep().getByTestId("horoscope-sky")).toBeTruthy();
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
