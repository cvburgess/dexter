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

// And the open tasks step: it owns the tasks query, two schedule prompts and a
// list of cards.
jest.mock("@/components/OpenTasksStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    OpenTasksStep: function MockOpenTasksStep({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`open-tasks:${date.toString()}`}</RNText>;
    },
  };
});

// And the summary step: it owns three queries, a reveal and a router push.
jest.mock("@/components/SummaryStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SummaryStep: function MockSummaryStep({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`summary:${date.toString()}`}</RNText>;
    },
  };
});

// And the review step: it owns three queries, a four-figure hero, the habit
// rings and a list of cards.
jest.mock("@/components/ReviewStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ReviewStep: function MockReviewStep({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`review:${date.toString()}`}</RNText>;
    },
  };
});

// And the preview tomorrow step: it owns five calendar reads, the tasks query
// and a scroll-driven reveal.
const mockPreviewTomorrowStep = jest.fn();
jest.mock("@/components/PreviewTomorrowStep", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    PreviewTomorrowStep: function MockPreviewTomorrowStep(props: {
      date: Temporal.PlainDate;
    }) {
      mockPreviewTomorrowStep(props);
      return <RNText>{`preview-tomorrow:${props.date.toString()}`}</RNText>;
    },
  };
});

const DATE = Temporal.PlainDate.from("2026-08-09");

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

  // The evening ritual's first step, and the only built one it reaches before
  // the journal. Like the backlog, no preference gates it.
  it("renders the open tasks step for the ritual's day", () => {
    renderStep({ id: "open-tasks", title: "Open tasks" });

    expect(screen.getByText("open-tasks:2026-08-09")).toBeTruthy();
  });

  // The other half of the evening's task pass. It takes no `onEditingChange` —
  // a completed card renames nothing — which is why this branch passes only the
  // date.
  it("renders the review step for the ritual's day", () => {
    renderStep({ id: "review", title: "Review" });

    expect(screen.getByText("review:2026-08-09")).toBeTruthy();
  });

  // The one step that renders a day other than the ritual's own — it takes the
  // ritual's date here and adds the day itself, so this branch looks like every
  // other one.
  it("renders the preview tomorrow step with the ritual's own day", () => {
    renderStep({ id: "preview-tomorrow", title: "Preview tomorrow" });

    expect(screen.getByText("preview-tomorrow:2026-08-09")).toBeTruthy();
  });

  // Unlike `review` two steps back, this one lists *open* tasks, so its cards
  // rename and the swipe has to be suspendable — passed unwrapped for the same
  // reason the journal's is.
  it("hands the preview tomorrow step the editing callback, unwrapped", () => {
    const onEditingChange = jest.fn();
    render(
      <RitualStepView
        date={DATE}
        onEditingChange={onEditingChange}
        step={{ id: "preview-tomorrow", title: "Preview tomorrow" }}
      />,
    );

    expect(mockPreviewTomorrowStep).toHaveBeenCalledWith(
      expect.objectContaining({ onEditingChange }),
    );
  });

  // The one built step both rituals reach, and the last of each.
  it("renders the summary step for the summary id", () => {
    renderStep({ id: "summary", title: "Summary" });

    expect(screen.getByText("summary:2026-08-09")).toBeTruthy();
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

  // DEX-149 filled the last of them, so the placeholder branch is no longer
  // reachable from either flow — which is exactly what this now guards. The
  // default still exists, and an id added to `RITUAL_STEPS` without a branch
  // here would quietly render its own bare title in the ritual rather than
  // failing anywhere; a step showing nothing but its name reads as an empty
  // screen, not as unfinished work.
  it.each([...RITUAL_STEPS.am, ...RITUAL_STEPS.pm])(
    "renders $title as a built step rather than its own name",
    (step) => {
      renderStep(step);

      expect(screen.queryByText(step.title)).toBeNull();
    },
  );
});
