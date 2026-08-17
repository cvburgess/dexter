import { fireEvent, render } from "@testing-library/react-native";
import { ScrollView } from "react-native";

import RitualScreen from "@/app/(app)/(tabs)/settings/ritual";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  pickerOptionsFor,
  pickerPropsFor,
  resetPicker,
} from "@/testUtils/mockExpoUiPicker";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

// The global @expo/ui mock renders Picker as null; this one captures its props
// so the sun sign field can be inspected and driven.
jest.mock("@expo/ui", () =>
  jest
    .requireActual<typeof import("@/testUtils/mockExpoUiPicker")>(
      "@/testUtils/mockExpoUiPicker",
    )
    .mockExpoUiPicker(),
);

const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;
const mockUpdate = jest.fn();

const renderWith = (
  overrides: {
    enableJournal?: boolean;
    enableHoroscope?: boolean;
    templatePrompts?: string[];
    sunSign?: string | null;
    breathCount?: number;
    breathingTechnique?: string;
  } = {},
) => {
  mockUsePreferences.mockReturnValue([
    {
      enableJournal: true,
      enableHoroscope: true,
      templatePrompts: [],
      sunSign: null,
      breathCount: 3,
      breathingTechnique: "shuffle",
      ...overrides,
    } as never,
    { updatePreferences: mockUpdate },
  ]);
  return render(<RitualScreen />);
};

// The "Add prompt" affordance lives in the navigation header (set via
// setOptions), so it isn't in the screen's own tree. Render the latest
// headerRight to inspect/press it.
const renderHeader = () => {
  const options = mockSetOptions.mock.calls.at(-1)?.[0];
  return render(options.headerRight());
};

describe("RitualScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPicker();
    mockUseIsLargeDevice.mockReturnValue(false);
  });

  describe("the sun sign picker", () => {
    it("offers every sign in astrological order behind an unset option", () => {
      renderWith();

      const options = pickerOptionsFor("sun-sign-picker");

      expect(options[0]).toEqual({ label: "Not set", value: "" });
      expect(options).toHaveLength(13);
      // Astrological, not alphabetical — which is why the DB enum declares the
      // labels in this order and the options are built from it.
      expect(options.slice(1, 4).map((o) => o.value)).toEqual([
        "aries",
        "taurus",
        "gemini",
      ]);
      expect(options.at(-1)).toEqual({ label: "Pisces", value: "pisces" });
    });

    it("selects the stored sign", () => {
      renderWith({ sunSign: "leo" });

      expect(pickerPropsFor("sun-sign-picker")?.selectedValue).toBe("leo");
    });

    // A null sign has no matching item of its own, and a Picker given a value
    // none of its items carry renders with nothing selected — so it has to
    // land on the sentinel instead.
    it("falls back to the unset sentinel when no sign is stored", () => {
      renderWith({ sunSign: null });

      expect(pickerPropsFor("sun-sign-picker")?.selectedValue).toBe("");
    });

    it("saves a chosen sign", () => {
      renderWith({ sunSign: null });

      (
        pickerPropsFor("sun-sign-picker")?.onValueChange as (
          value: string,
        ) => void
      )("scorpio");

      expect(mockUpdate).toHaveBeenCalledWith({ sunSign: "scorpio" });
    });

    // The sentinel is a UI-only value: `preferences.sun_sign` is a real enum
    // column, so "" would be rejected by Postgres. Clearing writes null.
    it("clears the sign back to null when the unset option is chosen", () => {
      renderWith({ sunSign: "leo" });

      (
        pickerPropsFor("sun-sign-picker")?.onValueChange as (
          value: string,
        ) => void
      )("");

      expect(mockUpdate).toHaveBeenCalledWith({ sunSign: null });
    });

    // The sign is not part of the Journal, so turning the Journal off must not
    // take it with them — both live on this one screen now.
    it("stays visible when the Journal is disabled", () => {
      renderWith({ enableJournal: false, sunSign: "leo" });

      expect(pickerPropsFor("sun-sign-picker")?.selectedValue).toBe("leo");
    });

    // The Horoscope is the other story: the sign feeds that step and nothing
    // else, so with the step off the picker would offer a choice that changes
    // nothing (DEX-142). `pickerProps` is null rather than stale because
    // `resetPicker` runs in `beforeEach`.
    it("hides when the Horoscope is disabled", () => {
      renderWith({ enableHoroscope: false, sunSign: "leo" });

      expect(pickerPropsFor("sun-sign-picker")).toBeNull();
    });

    // Hiding the picker must not clear the stored sign: turning the Horoscope
    // back on has to restore the horoscope rather than re-ask for a sign.
    it("comes back with the stored sign when the Horoscope is re-enabled", () => {
      renderWith({ enableHoroscope: true, sunSign: "leo" });

      expect(pickerPropsFor("sun-sign-picker")?.selectedValue).toBe("leo");
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  it("reflects the Horoscope enabled state and toggles it", () => {
    const screen = renderWith({ enableHoroscope: true });

    expect(screen.getByLabelText("Horoscope").props.value).toBe(true);

    fireEvent(screen.getByLabelText("Horoscope"), "valueChange", false);

    expect(mockUpdate).toHaveBeenCalledWith({ enableHoroscope: false });
  });

  // Each toggle owns its own section: turning one off must leave the other's
  // settings on screen, since they are independent steps of the same ritual.
  it("keeps the Journal prompts when the Horoscope is disabled", () => {
    const screen = renderWith({
      enableHoroscope: false,
      templatePrompts: ["Highlight"],
    });

    expect(screen.getByLabelText("Journal prompt 1")).toBeTruthy();
    expect(renderHeader().getByLabelText("Add prompt")).toBeTruthy();
  });

  // Without this, a focused prompt low on the screen stays under the keyboard:
  // the wrapper this replaced padded the scroller's frame, which gave scroll
  // room but never moved content to the field (DEX-92).
  it("lets iOS inset the scroll content by the keyboard", () => {
    const screen = renderWith({ enableJournal: true });

    expect(
      screen.UNSAFE_getByType(ScrollView).props
        .automaticallyAdjustKeyboardInsets,
    ).toBe(true);
  });

  it("reflects the enabled state and toggles it", () => {
    const screen = renderWith({ enableJournal: true });

    expect(screen.getByLabelText("Journal").props.value).toBe(true);

    fireEvent(screen.getByLabelText("Journal"), "valueChange", false);

    expect(mockUpdate).toHaveBeenCalledWith({ enableJournal: false });
  });

  it("hides the prompts editor and header add button when Journal is disabled", () => {
    const screen = renderWith({
      enableJournal: false,
      templatePrompts: ["Highlight"],
    });

    expect(screen.queryByLabelText("Journal prompt 1")).toBeNull();
    expect(renderHeader().queryByLabelText("Add prompt")).toBeNull();
  });

  it("shows the header add button when Journal is enabled", () => {
    renderWith({ enableJournal: true });

    expect(renderHeader().getByLabelText("Add prompt")).toBeTruthy();
  });

  it("commits an edited prompt on blur, replacing it by index", () => {
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight", "Grateful for"],
    });

    const input = screen.getByLabelText("Journal prompt 1");
    fireEvent.changeText(input, "What went well?");
    fireEvent(input, "blur");

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["What went well?", "Grateful for"],
    });
  });

  it("does not write a prompt on blur when it is unchanged", () => {
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight"],
    });

    fireEvent(screen.getByLabelText("Journal prompt 1"), "blur");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("appends an empty prompt when the header add button is pressed", () => {
    renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight"],
    });

    fireEvent.press(renderHeader().getByLabelText("Add prompt"));

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["Highlight", ""],
    });
  });

  it("preserves an in-progress edit when a prompt is added", () => {
    // Add derives the new array from local drafts, not the (optimistically
    // lagging) stored preference — so a typed-but-not-yet-blurred edit survives.
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight"],
    });

    fireEvent.changeText(
      screen.getByLabelText("Journal prompt 1"),
      "What went well?",
    );
    // Re-read the header after the edit so it closes over the latest drafts.
    fireEvent.press(renderHeader().getByLabelText("Add prompt"));

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["What went well?", ""],
    });
  });

  it("removes a prompt by index when its delete control is pressed", () => {
    const screen = renderWith({
      enableJournal: true,
      templatePrompts: ["Highlight", "Grateful for"],
    });

    fireEvent.press(screen.getByTestId("delete-prompt-0"));

    expect(mockUpdate).toHaveBeenCalledWith({
      templatePrompts: ["Grateful for"],
    });
  });

  describe("the Breathe settings", () => {
    it("offers the three techniques plus shuffle", () => {
      renderWith();

      expect(
        pickerOptionsFor("breathing-technique-picker").map((o) => o.value),
      ).toEqual(["simple", "relax", "box", "shuffle"]);
    });

    it("selects the stored technique", () => {
      renderWith({ breathingTechnique: "box" });

      expect(pickerPropsFor("breathing-technique-picker")?.selectedValue).toBe(
        "box",
      );
    });

    // The column carries no CHECK, so a technique a later build stored would
    // otherwise leave the picker showing nothing selected.
    it("falls back to shuffle for a technique this build does not know", () => {
      renderWith({ breathingTechnique: "coherent" });

      expect(pickerPropsFor("breathing-technique-picker")?.selectedValue).toBe(
        "shuffle",
      );
    });

    it("saves a chosen technique", () => {
      renderWith();

      (
        pickerPropsFor("breathing-technique-picker")?.onValueChange as (
          value: string,
        ) => void
      )("relax");

      expect(mockUpdate).toHaveBeenCalledWith({ breathingTechnique: "relax" });
    });

    it("offers every count the step can run", () => {
      renderWith();

      expect(
        pickerOptionsFor("breath-count-picker").map((o) => o.value),
      ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
      // The unit rides on the label, and the singular reads as a sentence.
      expect(pickerOptionsFor("breath-count-picker")[0].label).toBe("1 breath");
      expect(pickerOptionsFor("breath-count-picker")[1].label).toBe(
        "2 breaths",
      );
    });

    it("selects the stored breath count", () => {
      renderWith({ breathCount: 6 });

      expect(pickerPropsFor("breath-count-picker")?.selectedValue).toBe("6");
    });

    // Clamped rather than defaulted, so a count a later build stored still lands
    // on an option this one lists.
    it("narrows a stored count outside the range", () => {
      renderWith({ breathCount: 0 });

      expect(pickerPropsFor("breath-count-picker")?.selectedValue).toBe("1");
    });

    it("saves a chosen breath count as a number", () => {
      renderWith({ breathCount: 3 });

      (
        pickerPropsFor("breath-count-picker")?.onValueChange as (
          value: string,
        ) => void
      )("7");

      expect(mockUpdate).toHaveBeenCalledWith({ breathCount: 7 });
    });

    // Breathe is unconditional, unlike the Horoscope and Journal steps — there
    // is no toggle above it and nothing hides it.
    it("stays visible with both other steps turned off", () => {
      renderWith({
        enableHoroscope: false,
        enableJournal: false,
      });

      expect(pickerPropsFor("breath-count-picker")).not.toBeNull();
      expect(pickerPropsFor("breathing-technique-picker")).not.toBeNull();
    });
  });
});
