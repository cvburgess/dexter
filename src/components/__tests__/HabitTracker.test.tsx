import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";

import { THabit } from "@/api/habits";
import { useDailyHabits, useHabits } from "@/hooks/useHabits";

import { HabitTracker } from "../HabitTracker";

// useHabits imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useHabits", () => ({
  ...jest.requireActual<typeof import("@/hooks/useHabits")>(
    "@/hooks/useHabits",
  ),
  useDailyHabits: jest.fn(),
  useHabits: jest.fn(),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockUseHabits = useHabits as jest.MockedFunction<typeof useHabits>;
const mockUseDailyHabits = useDailyHabits as jest.MockedFunction<
  typeof useDailyHabits
>;

const habitsResult = (habits: THabit[] = [], isLoading = false) =>
  [habits, { isLoading }] as never as ReturnType<typeof useHabits>;

const dailyHabitsResult = (createDailyHabits: jest.Mock = jest.fn()) =>
  [
    [],
    {
      createDailyHabits,
      incrementDailyHabit: jest.fn(),
      isLoading: false,
    },
  ] as never as ReturnType<typeof useDailyHabits>;

const habit = { id: "habit-1", steps: 1 } as THabit;

const date = Temporal.Now.plainDateISO();

beforeEach(() => {
  jest.clearAllMocks();
  // No habits at all — the state the first-run nudge exists for.
  mockUseHabits.mockReturnValue(habitsResult([]));
  mockUseDailyHabits.mockReturnValue(dailyHabitsResult());
});

describe("HabitTracker", () => {
  it("offers the create-a-habit nudge by default", () => {
    const screen = render(<HabitTracker date={date} />);

    expect(screen.getByText("Create a habit")).toBeTruthy();
  });

  describe("showCreateNudge={false} (DEX-96)", () => {
    it("suppresses the nudge", () => {
      // The Week tab mounts one tracker per column; seven copies of the same
      // call-to-action reads as noise.
      const screen = render(
        <HabitTracker date={date} showCreateNudge={false} />,
      );

      expect(screen.queryByText("Create a habit")).toBeNull();
    });

    it("skips the all-habits query that only the nudge reads", () => {
      render(<HabitTracker date={date} showCreateNudge={false} />);

      expect(mockUseHabits).toHaveBeenCalledWith({ skipQuery: true });
    });

    it("still runs the query when the nudge is enabled", () => {
      render(<HabitTracker date={date} />);

      expect(mockUseHabits).toHaveBeenCalledWith({ skipQuery: false });
    });

    it("renders the row rather than stalling on the skipped query", () => {
      // Regression guard for the skip above: `isLoading` must not stay true
      // for a query that will never run, or the tracker would render its
      // loading branch forever.
      const screen = render(
        <HabitTracker date={date} showCreateNudge={false} />,
      );

      expect(screen.toJSON()).not.toBeNull();
      expect(screen.queryByText("Create a habit")).toBeNull();
    });
  });

  // Bootstrapping is a write. Old days became routine to visit once they load
  // their tasks (DEX-162), and the Week tab mounts seven trackers at once, so an
  // unbounded bootstrap would persist habit history that never happened.
  describe("bootstrapping a day's rows", () => {
    const renderOn = (on: Temporal.PlainDate) => {
      const createDailyHabits = jest.fn();
      mockUseHabits.mockReturnValue(habitsResult([habit]));
      mockUseDailyHabits.mockReturnValue(dailyHabitsResult(createDailyHabits));
      render(<HabitTracker date={on} showCreateNudge={false} />);
      return createDailyHabits;
    };

    it("creates missing rows for a day inside the window", () => {
      expect(renderOn(date.subtract({ days: 2 }))).toHaveBeenCalled();
    });

    it("creates nothing for a long-past day", () => {
      expect(renderOn(date.subtract({ days: 200 }))).not.toHaveBeenCalled();
    });

    it("creates nothing for a future day", () => {
      expect(renderOn(date.add({ days: 1 }))).not.toHaveBeenCalled();
    });
  });
});
