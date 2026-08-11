import { Temporal } from "@js-temporal/polyfill";
import { render, screen } from "@testing-library/react-native";

import { RitualStepView } from "@/components/RitualStepView";
import { RITUAL_STEPS, type TRitualStep } from "@/utils/ritualSteps";

// The real view needs `useJournals` (and so a query client and a session); this
// test is about which branch the seam picks, not what the journal renders.
const mockJournalView = jest.fn();
jest.mock("@/components/JournalView", () => ({
  JournalView: (props: { date: string }) => {
    mockJournalView(props);
    const { Text: RNText } = jest.requireActual("react-native");
    return <RNText>{`journal-view:${props.date}`}</RNText>;
  },
}));

// Likewise: the horoscope step owns a query, a preference and a breathing
// animation, none of which this file is about.
jest.mock("@/components/HoroscopeStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    HoroscopeStep: function MockHoroscopeStep({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`horoscope:${date.toString()}`}</RNText>;
    },
  };
});

// And the calendar step: it owns the events query, the preferences read and the
// timeline underneath it.
jest.mock("@/components/CalendarStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CalendarStep: function MockCalendarStep({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`calendar:${date.toString()}`}</RNText>;
    },
  };
});

// And the backlog step: it owns the tasks query, the counts hero and the
// drawer underneath it.
jest.mock("@/components/BacklogStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    BacklogStep: function MockBacklogStep({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`backlog:${date.toString()}`}</RNText>;
    },
  };
});

// And the tasks step: it owns the tasks query and the day's card list.
jest.mock("@/components/TasksStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    TasksStep: function MockTasksStep({ date }: { date: Temporal.PlainDate }) {
      return <RNText>{`tasks:${date.toString()}`}</RNText>;
    },
  };
});

const DATE = Temporal.PlainDate.from("2026-08-09");

/** The step ids that no longer fall through to the placeholder branch. */
const BUILT_STEP_IDS = ["horoscope", "journal", "calendar", "backlog", "tasks"];

const renderStep = (step: TRitualStep) =>
  render(
    <RitualStepView date={DATE} onEditingChange={jest.fn()} step={step} />,
  );

beforeEach(() => {
  mockJournalView.mockClear();
});

describe("RitualStepView", () => {
  it("renders the horoscope for the horoscope id", () => {
    renderStep({ id: "horoscope", title: "Horoscope" });

    expect(screen.getByText("horoscope:2026-08-09")).toBeTruthy();
  });

  it("renders the journal for the ritual's day", () => {
    renderStep({ id: "journal", title: "Journal" });

    expect(screen.getByText("journal-view:2026-08-09")).toBeTruthy();
  });

  it("hands the journal the editing callback, unwrapped", () => {
    // `JournalView`'s reset-on-unmount effect keys on this callback's identity,
    // so wrapping it anywhere in the chain would clear the editing flag on
    // every render and leave the step swipe fighting the caret.
    const onEditingChange = jest.fn();
    render(
      <RitualStepView
        date={DATE}
        onEditingChange={onEditingChange}
        step={{ id: "journal", title: "Journal" }}
      />,
    );

    expect(mockJournalView).toHaveBeenCalledWith(
      expect.objectContaining({ onEditingChange }),
    );
  });

  // Only reachable while the calendar preference is on — `stepsFor` drops the
  // step from the flow entirely otherwise.
  it("renders the calendar for the ritual's day", () => {
    renderStep({ id: "calendar", title: "Calendar" });

    expect(screen.getByText("calendar:2026-08-09")).toBeTruthy();
  });

  // Unlike the calendar, this one has no preference gating it — every user has
  // a backlog, so the branch is always reachable.
  it("renders the backlog for the ritual's day", () => {
    renderStep({ id: "backlog", title: "Backlog" });

    expect(screen.getByText("backlog:2026-08-09")).toBeTruthy();
  });

  // Unconditional too, and the step the backlog hands off to.
  it("renders the day's task list for the tasks id", () => {
    renderStep({ id: "tasks", title: "Tasks" });

    expect(screen.getByText("tasks:2026-08-09")).toBeTruthy();
  });

  it("hands a step the ritual's date rather than today's", () => {
    const other = Temporal.PlainDate.from("2026-01-02");

    render(
      <RitualStepView
        date={other}
        onEditingChange={jest.fn()}
        step={{ id: "horoscope", title: "Horoscope" }}
      />,
    );

    expect(screen.getByText("horoscope:2026-01-02")).toBeTruthy();
  });

  // The default branch is what lets the remaining DEX-34 sub-issues fill steps
  // in one at a time, so every id that isn't built yet has to keep working. A
  // step that quietly stopped rendering anything would look like an empty
  // screen rather than a failure.
  it.each(
    [...RITUAL_STEPS.am, ...RITUAL_STEPS.pm].filter(
      (step) => !BUILT_STEP_IDS.includes(step.id),
    ),
  )("renders $title as a placeholder", (step) => {
    renderStep(step);

    expect(screen.getByText(step.title)).toBeTruthy();
    expect(mockJournalView).not.toHaveBeenCalled();
  });
});
