import { Temporal } from "@js-temporal/polyfill";
import { act, render } from "@testing-library/react-native";
import { StyleSheet, TextStyle } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { BacklogStep } from "@/components/BacklogStep";
import { useTasks } from "@/hooks/useTasks";
import { TFilterId } from "@/utils/taskFilters";
import { themes } from "@/utils/theme";

jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));

// The drawer has its own suite (`TaskDrawer.test.tsx`) and a native menu host
// that can't be driven from a unit test; standing it in as a marker keeps this
// file about the hero and the filter it seeds.
const mockTaskDrawer = jest.fn();
jest.mock("@/components/TaskDrawer", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    TaskDrawer: function MockTaskDrawer(props: {
      date: Temporal.PlainDate;
      filterId?: TFilterId;
      onFilterChange?: (id: TFilterId) => void;
      showSearch?: boolean;
      solid?: boolean;
    }) {
      mockTaskDrawer(props);
      return <RNText>{`drawer:${props.date.toString()}`}</RNText>;
    },
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;

// Anchored to the real today, the way `TaskDrawer.test` does: the component
// reads `Temporal.Now` for its own boundary and the fixtures have to agree.
const TODAY = Temporal.Now.plainDateISO();
const iso = (days: number) => TODAY.add({ days }).toString();

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

const leftBehind = (id: string) => task({ id, scheduledFor: iso(-3) });
const overdue = (id: string) => task({ id, dueOn: iso(-1) });
const dueSoon = (id: string) => task({ id, dueOn: iso(2) });

const tasksResult = (
  tasks: TTask[],
  isLoading = false,
): ReturnType<typeof useTasks> =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading,
      refetch: jest.fn(),
      updateTask: jest.fn(),
      updateTasks: jest.fn(),
    },
  ] as never;

const renderStep = (tasks: TTask[] = [], isLoading = false) => {
  mockUseTasks.mockReturnValue(tasksResult(tasks, isLoading));
  return render(<BacklogStep date={TODAY} />);
};

/** The color a rendered `<Text>` resolves to, for the hero's ink assertions. */
const colorOf = (node: ReactTestInstance) =>
  StyleSheet.flatten(node.props.style as TextStyle).color;

/** The props the drawer was last rendered with. */
const drawerProps = () =>
  mockTaskDrawer.mock.calls.at(-1)?.[0] as {
    date: Temporal.PlainDate;
    filterId?: TFilterId;
    onFilterChange?: (id: TFilterId) => void;
    showSearch?: boolean;
    solid?: boolean;
  };

// The palette `useTheme` falls back to outside a provider on a light scheme.
const { colors } = themes.dexter;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BacklogStep", () => {
  describe("while the tasks are loading", () => {
    // `useTasks` hands back an empty placeholder array until the query
    // resolves, so every count is zero — showing the all-clear hero here would
    // congratulate someone whose backlog is full.
    it("renders nothing rather than a premature all-clear", () => {
      const screen = renderStep([], true);

      expect(screen.toJSON()).toBeNull();
    });
  });

  describe("with nothing needing attention", () => {
    it("centers the counts and drops the backlog", () => {
      const screen = renderStep([]);

      expect(screen.getByTestId("backlog-step-clear")).toBeTruthy();
      expect(screen.queryByText(/^drawer:/)).toBeNull();
    });

    it("states all three zeroes in the success color", () => {
      const screen = renderStep([]);

      expect(screen.getByLabelText("0 tasks left behind")).toBeTruthy();
      expect(screen.getByLabelText("0 tasks overdue")).toBeTruthy();
      expect(screen.getByLabelText("0 tasks due soon")).toBeTruthy();
      for (const key of ["leftBehind", "overdue", "dueSoon"]) {
        expect(colorOf(screen.getByTestId(`hero-figure-${key}`))).toBe(
          colors.success,
        );
      }
    });

    // A backlog can be full of undated, unscheduled tasks and still have
    // nothing slipping. The step is about what is slipping (DEX-141); the
    // Today tab's drawer covers browsing the rest.
    it("stays clear for a backlog of undated, unscheduled tasks", () => {
      const screen = renderStep([task({ id: "1" }), task({ id: "2" })]);

      expect(screen.getByTestId("backlog-step-clear")).toBeTruthy();
      expect(screen.queryByText(/^drawer:/)).toBeNull();
    });
  });

  describe("with a backlog that needs attention", () => {
    it("counts each bucket and shows the drawer beneath", () => {
      const screen = renderStep([
        leftBehind("1"),
        leftBehind("2"),
        overdue("3"),
      ]);

      expect(screen.getByLabelText("2 tasks left behind")).toBeTruthy();
      expect(screen.getByLabelText("1 task overdue")).toBeTruthy();
      expect(screen.getByLabelText("0 tasks due soon")).toBeTruthy();
      expect(screen.queryByTestId("backlog-step-clear")).toBeNull();
      expect(screen.getByText(`drawer:${TODAY.toString()}`)).toBeTruthy();
    });

    // The figure carries the color and the words stay in ink, per
    // `CalendarStep`'s convention. Due soon is a heads-up rather than a
    // failure, so it takes the warning token the urgent+important priority
    // uses instead of `error`.
    it("colors the figures by what they mean", () => {
      const screen = renderStep([leftBehind("1"), overdue("2"), dueSoon("3")]);

      expect(colorOf(screen.getByTestId("hero-figure-leftBehind"))).toBe(
        colors.error,
      );
      expect(colorOf(screen.getByTestId("hero-figure-overdue"))).toBe(
        colors.error,
      );
      expect(colorOf(screen.getByTestId("hero-figure-dueSoon"))).toBe(
        colors.priority[ETaskPriority.IMPORTANT_AND_URGENT],
      );
    });

    it("still colors an empty bucket as success", () => {
      const screen = renderStep([leftBehind("1")]);

      expect(colorOf(screen.getByTestId("hero-figure-leftBehind"))).toBe(
        colors.error,
      );
      expect(colorOf(screen.getByTestId("hero-figure-overdue"))).toBe(
        colors.success,
      );
    });

    // The step walks a short list of what is slipping; it is not where you go
    // to hunt for a task you already have in mind.
    it("hides the drawer's search field", () => {
      renderStep([leftBehind("1")]);

      expect(drawerProps().showSearch).toBe(false);
    });

    // The drawer sits under this step's fade and `SwipeablePage`'s, which
    // liquid glass cannot sample through — each row's "+" would be a bare
    // glyph on iOS (DEX-150). The rendering is device-only; this is cover for
    // the step still declaring it.
    it("tells the drawer it is under an animated opacity", () => {
      renderStep([leftBehind("1")]);

      expect(drawerProps().solid).toBe(true);
    });

    it("hands the drawer the ritual's day rather than today's", () => {
      const other = TODAY.add({ days: 4 });
      mockUseTasks.mockReturnValue(tasksResult([leftBehind("1")]));

      render(<BacklogStep date={other} />);

      expect(drawerProps().date.toString()).toBe(other.toString());
    });
  });

  describe("the opening filter", () => {
    it("opens on Left Behind ahead of everything else", () => {
      renderStep([leftBehind("1"), overdue("2"), dueSoon("3")]);

      expect(drawerProps().filterId).toBe("leftBehind");
    });

    it("falls to Overdue when nothing is left behind", () => {
      renderStep([overdue("1"), dueSoon("2")]);

      expect(drawerProps().filterId).toBe("overdue");
    });

    it("falls to Due Soon when nothing is left behind or overdue", () => {
      renderStep([dueSoon("1")]);

      expect(drawerProps().filterId).toBe("dueSoon");
    });

    it("keeps the reader's own choice", () => {
      renderStep([leftBehind("1"), dueSoon("2")]);

      act(() => drawerProps().onFilterChange?.("unscheduled"));

      expect(drawerProps().filterId).toBe("unscheduled");
    });
  });

  // Working down what is slipping is the whole step, so emptying one bucket
  // hands the reader the next rather than leaving them looking at nothing.
  describe("as a bucket is cleared out", () => {
    /** Re-renders with a new set of tasks, as a schedule change would. */
    const withTasks = (screen: ReturnType<typeof render>, tasks: TTask[]) => {
      mockUseTasks.mockReturnValue(tasksResult(tasks));
      screen.rerender(<BacklogStep date={TODAY} />);
    };

    it("moves on to the next bucket that still has tasks", () => {
      const screen = renderStep([leftBehind("1"), dueSoon("2")]);
      expect(drawerProps().filterId).toBe("leftBehind");

      withTasks(screen, [dueSoon("2")]);

      expect(screen.getByLabelText("0 tasks left behind")).toBeTruthy();
      expect(drawerProps().filterId).toBe("dueSoon");
    });

    it("follows the hero's order when more than one is left", () => {
      const screen = renderStep([leftBehind("1"), overdue("2"), dueSoon("3")]);

      withTasks(screen, [overdue("2"), dueSoon("3")]);

      expect(drawerProps().filterId).toBe("overdue");
    });

    // The emptiness is what licenses the move. Derived from the counts alone,
    // the filter would jump the moment a *different* bucket changed and the
    // reader would lose their place mid-list.
    it("stays put while the reader's bucket still has tasks", () => {
      const screen = renderStep([
        leftBehind("1"),
        leftBehind("2"),
        overdue("3"),
      ]);
      expect(drawerProps().filterId).toBe("leftBehind");

      withTasks(screen, [leftBehind("2")]);

      expect(screen.getByLabelText("1 task left behind")).toBeTruthy();
      expect(drawerProps().filterId).toBe("leftBehind");
    });

    // The advance has to be *recorded*, not only derived: left in state, the
    // emptied bucket is still the one `nextBacklogFilter` reads, so refilling it
    // — un-completing a task from the drawer, or a change from another device —
    // would yank the list back off whatever the reader had moved on to.
    it("does not snap back when a cleared bucket refills", () => {
      const screen = renderStep([leftBehind("1"), overdue("2")]);
      expect(drawerProps().filterId).toBe("leftBehind");

      withTasks(screen, [overdue("2")]);
      expect(drawerProps().filterId).toBe("overdue");

      withTasks(screen, [leftBehind("3"), overdue("2")]);

      expect(screen.getByLabelText("1 task left behind")).toBeTruthy();
      expect(drawerProps().filterId).toBe("overdue");
    });

    // A preset outside the hero's three is a detour the reader chose; the step
    // has no opinion about it, empty or not.
    it("leaves a preset the hero does not count alone", () => {
      const screen = renderStep([leftBehind("1"), overdue("2")]);
      act(() => drawerProps().onFilterChange?.("unscheduled"));

      withTasks(screen, [overdue("2")]);

      expect(drawerProps().filterId).toBe("unscheduled");
    });
  });
});
