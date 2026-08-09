import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { createRitualState, RITUAL_STEPS } from "@/utils/ritualSteps";

import type { TIconMenuSection } from "../IconMenu.types";
import { RitualStepSwitcher as NativeSwitcher } from "../RitualStepSwitcher.native";
import { ritualStepOptions, STEP_ICONS } from "../RitualStepSwitcher.shared";
import { RitualStepSwitcher as WebSwitcher } from "../RitualStepSwitcher.web";

// The circular button wraps native glass/SF-symbol views; stub it so each one
// renders its SF Symbol name and stays pressable.
const mockGlassIconButton = jest.fn(
  ({
    sfSymbol,
    accessibilityLabel,
    active,
    onPress,
  }: {
    sfSymbol: string;
    accessibilityLabel: string;
    active?: boolean;
    onPress?: () => void;
  }) => (
    <Text accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {`${sfSymbol}${active ? ":active" : ""}`}
    </Text>
  ),
);
jest.mock("../GlassIconButton", () => ({
  GlassIconButton: (props: {
    sfSymbol: string;
    accessibilityLabel: string;
    active?: boolean;
    onPress?: () => void;
  }) => mockGlassIconButton(props),
}));

// The native menu host isn't driveable in a unit test; capture the sections it
// is handed and render its trigger, as `DayViewSwitcher.test` does.
const mockIconMenu = jest.fn(
  (props: { sections: TIconMenuSection[]; children: ReactNode }) => (
    <>{props.children}</>
  ),
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: { sections: TIconMenuSection[]; children: ReactNode }) =>
    mockIconMenu(props),
}));

const lastSections = () => mockIconMenu.mock.calls.at(-1)?.[0].sections ?? [];
const lastOptions = () => lastSections().flatMap((section) => section.options);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("STEP_ICONS", () => {
  // The `Record<TRitualStepId, …>` type already forces an entry per id; this
  // catches an entry that exists but is empty.
  it("gives every step of both rituals a real icon pair", () => {
    const ids = [...RITUAL_STEPS.am, ...RITUAL_STEPS.pm].map((step) => step.id);

    for (const id of ids) {
      expect(STEP_ICONS[id].sf).toBeTruthy();
      expect(STEP_ICONS[id].ionicon).toBeTruthy();
    }
  });
});

describe("ritualStepOptions", () => {
  it("lists the active ritual's steps in order, marking the current one", () => {
    const options = ritualStepOptions(
      { ...createRitualState(undefined, "am"), step: 2 },
      jest.fn(),
    );

    expect(options.map((option) => option.title)).toEqual([
      "Horoscope",
      "Journal",
      "Calendar",
      "Backlog",
      "Tasks",
      "Congrats",
    ]);
    expect(options.filter((option) => option.isCurrent)).toHaveLength(1);
    expect(options[2].isCurrent).toBe(true);
  });

  it("switches to the evening ritual's own steps", () => {
    const options = ritualStepOptions(
      createRitualState(undefined, "pm"),
      jest.fn(),
    );

    expect(options).toHaveLength(5);
    expect(options[0].title).toBe("Open tasks");
  });

  it("selects by index, which is what goToStep takes", () => {
    const onSelectStep = jest.fn();
    const options = ritualStepOptions(
      createRitualState(undefined, "am"),
      onSelectStep,
    );

    options[3].onSelect();

    expect(onSelectStep).toHaveBeenCalledWith(3);
  });
});

describe("RitualStepSwitcher on native", () => {
  it("offers a menu row per step, checking the current one", () => {
    render(
      <NativeSwitcher
        onSelectStep={jest.fn()}
        state={{ ...createRitualState(undefined, "am"), step: 1 }}
      />,
    );

    expect(lastOptions().map((option) => option.title)).toEqual([
      "Horoscope",
      "Journal",
      "Calendar",
      "Backlog",
      "Tasks",
      "Congrats",
    ]);
    expect(lastOptions().filter((option) => option.isSelected)).toHaveLength(1);
    expect(lastOptions()[1].isSelected).toBe(true);
  });

  it("jumps to the picked step", () => {
    const onSelectStep = jest.fn();
    render(
      <NativeSwitcher
        onSelectStep={onSelectStep}
        state={createRitualState(undefined, "am")}
      />,
    );

    lastOptions()[4].onSelect();

    expect(onSelectStep).toHaveBeenCalledWith(4);
  });

  // The trigger doubles as a "you are here" — there is no next button, so this
  // is the only thing on screen naming the step.
  it("wears the current step's icon on its trigger", () => {
    const screen = render(
      <NativeSwitcher
        onSelectStep={jest.fn()}
        state={{ ...createRitualState(undefined, "am"), step: 2 }}
      />,
    );

    expect(screen.getByText(STEP_ICONS.calendar.sf)).toBeTruthy();
  });

  // A menu is navigation, not progression: swiping is what moves the ritual on.
  it("offers no next action", () => {
    render(
      <NativeSwitcher
        onSelectStep={jest.fn()}
        state={createRitualState(undefined, "am")}
      />,
    );

    expect(
      lastOptions().filter((option) => /next/i.test(option.title)),
    ).toHaveLength(0);
  });
});

describe("RitualStepSwitcher on web", () => {
  it("renders one button per step rather than a menu", () => {
    const screen = render(
      <WebSwitcher
        onSelectStep={jest.fn()}
        state={createRitualState(undefined, "pm")}
      />,
    );

    expect(mockIconMenu).not.toHaveBeenCalled();
    expect(mockGlassIconButton).toHaveBeenCalledTimes(RITUAL_STEPS.pm.length);
    expect(screen.getByLabelText("Go to preview tomorrow")).toBeTruthy();
  });

  it("tints the step on screen", () => {
    const screen = render(
      <WebSwitcher
        onSelectStep={jest.fn()}
        state={{ ...createRitualState(undefined, "am"), step: 3 }}
      />,
    );

    expect(screen.getByText(`${STEP_ICONS.backlog.sf}:active`)).toBeTruthy();
    expect(screen.getAllByText(/:active$/)).toHaveLength(1);
  });

  it("jumps to the pressed step", () => {
    const onSelectStep = jest.fn();
    const screen = render(
      <WebSwitcher
        onSelectStep={onSelectStep}
        state={createRitualState(undefined, "am")}
      />,
    );

    fireEvent.press(screen.getByLabelText("Go to tasks"));

    expect(onSelectStep).toHaveBeenCalledWith(4);
  });
});
