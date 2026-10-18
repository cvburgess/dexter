import { Temporal } from "@js-temporal/polyfill";
import { act, render } from "@testing-library/react-native";
import type { RenderResult } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { BacklogStep } from "@/components/BacklogStep";
import { useTasks } from "@/hooks/useTasks";
import { TFilterId } from "@/utils/taskFilters";
import { themes } from "@/utils/theme";

jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));

// The drawer has its own suite and a native menu host a unit test can't
// drive; a marker keeps this file about the hero and the filter it seeds.
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

const renderStep = async (tasks: TTask[] = [], isLoading = false) => {
  mockUseTasks.mockReturnValue(tasksResult(tasks, isLoading));
  return await render(<BacklogStep date={TODAY} />);
};

/** The color a rendered `<Text>` resolves to, for the hero's ink assertions. */
const colorOf = (node: TestInstance) =>
  StyleSheet.flatten(node.props.style)!.color;

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
    // Placeholder array makes every count zero — the all-clear hero here
    // would congratulate someone whose backlog is full.
    it("renders nothing rather than a premature all-clear", async () => {
      const screen = await renderStep([], true);

      expect(screen.toJSON()).toBeNull();
    });
  });

  describe("with nothing needing attention", () => {
    it("centers the counts and drops the backlog", async () => {
      const screen = await renderStep([]);

      expect(screen.getByTestId("backlog-step-clear")).toBeTruthy();
      expect(screen.queryByText(/^drawer:/)).toBeNull();
    });

    it("states all three zeroes in the success color", async () => {
      const screen = await renderStep([]);

      expect(screen.getByLabelText("0 tasks left behind")).toBeTruthy();
      expect(screen.getByLabelText("0 tasks overdue")).toBeTruthy();
      expect(screen.getByLabelText("0 tasks due soon")).toBeTruthy();
      for (const key of ["leftBehind", "overdue", "dueSoon"]) {
        expect(colorOf(screen.getByTestId(`hero-figure-${key}`))).toBe(
          colors.success,
        );
      }
    });

    // A backlog full of undated tasks can still have nothing slipping — the
    // step is about what's slipping (DEX-141), not browsing the rest.
    it("stays clear for a backlog of undated, unscheduled tasks", async () => {
      const screen = await renderStep([task({ id: "1" }), task({ id: "2" })]);

      expect(screen.getByTestId("backlog-step-clear")).toBeTruthy();
      expect(screen.queryByText(/^drawer:/)).toBeNull();
    });
  });

  describe("with a backlog that needs attention", () => {
    it("counts each bucket and shows the drawer beneath", async () => {
      const screen = await renderStep([
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

    // Figures carry color, words stay ink (CalendarStep's convention); due
    // soon takes the warning token, not `error` — it's a heads-up, not a failure.
    it("colors the figures by what they mean", async () => {
      const screen = await renderStep([
        leftBehind("1"),
        overdue("2"),
        dueSoon("3"),
      ]);

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

    it("still colors an empty bucket as success", async () => {
      const screen = await renderStep([leftBehind("1")]);

      expect(colorOf(screen.getByTestId("hero-figure-leftBehind"))).toBe(
        colors.error,
      );
      expect(colorOf(screen.getByTestId("hero-figure-overdue"))).toBe(
        colors.success,
      );
    });

    // The step walks a short list of what is slipping; it is not where you go
    // to hunt for a task you already have in mind.
    it("hides the drawer's search field", async () => {
      await renderStep([leftBehind("1")]);

      expect(drawerProps().showSearch).toBe(false);
    });

    // The drawer sits under two fades glass can't sample through (DEX-150);
    // the rendering is device-only, this just covers the step declaring it.
    it("tells the drawer it is under an animated opacity", async () => {
      await renderStep([leftBehind("1")]);

      expect(drawerProps().solid).toBe(true);
    });

    it("hands the drawer the ritual's day rather than today's", async () => {
      const other = TODAY.add({ days: 4 });
      mockUseTasks.mockReturnValue(tasksResult([leftBehind("1")]));

      await render(<BacklogStep date={other} />);

      expect(drawerProps().date.toString()).toBe(other.toString());
    });
  });

  describe("the opening filter", () => {
    it("opens on Left Behind ahead of everything else", async () => {
      await renderStep([leftBehind("1"), overdue("2"), dueSoon("3")]);

      expect(drawerProps().filterId).toBe("leftBehind");
    });

    it("falls to Overdue when nothing is left behind", async () => {
      await renderStep([overdue("1"), dueSoon("2")]);

      expect(drawerProps().filterId).toBe("overdue");
    });

    it("falls to Due Soon when nothing is left behind or overdue", async () => {
      await renderStep([dueSoon("1")]);

      expect(drawerProps().filterId).toBe("dueSoon");
    });

    it("keeps the reader's own choice", async () => {
      await renderStep([leftBehind("1"), dueSoon("2")]);

      await act(() => drawerProps().onFilterChange?.("unscheduled"));

      expect(drawerProps().filterId).toBe("unscheduled");
    });
  });

  // Working down what is slipping is the whole step, so emptying one bucket
  // hands the reader the next rather than leaving them looking at nothing.
  describe("as a bucket is cleared out", () => {
    /** Re-renders with a new set of tasks, as a schedule change would. */
    const withTasks = async (screen: RenderResult, tasks: TTask[]) => {
      mockUseTasks.mockReturnValue(tasksResult(tasks));
      await screen.rerender(<BacklogStep date={TODAY} />);
    };

    it("moves on to the next bucket that still has tasks", async () => {
      const screen = await renderStep([leftBehind("1"), dueSoon("2")]);
      expect(drawerProps().filterId).toBe("leftBehind");

      await withTasks(screen, [dueSoon("2")]);

      expect(screen.getByLabelText("0 tasks left behind")).toBeTruthy();
      expect(drawerProps().filterId).toBe("dueSoon");
    });

    it("follows the hero's order when more than one is left", async () => {
      const screen = await renderStep([
        leftBehind("1"),
        overdue("2"),
        dueSoon("3"),
      ]);

      await withTasks(screen, [overdue("2"), dueSoon("3")]);

      expect(drawerProps().filterId).toBe("overdue");
    });

    // Emptiness licenses the move — derived from counts alone, the filter
    // would jump the moment a different bucket changed.
    it("stays put while the reader's bucket still has tasks", async () => {
      const screen = await renderStep([
        leftBehind("1"),
        leftBehind("2"),
        overdue("3"),
      ]);
      expect(drawerProps().filterId).toBe("leftBehind");

      await withTasks(screen, [leftBehind("2")]);

      expect(screen.getByLabelText("1 task left behind")).toBeTruthy();
      expect(drawerProps().filterId).toBe("leftBehind");
    });

    // Must be recorded, not just derived — left alone, refilling the emptied
    // bucket would yank the list back off whatever the reader moved on to.
    it("does not snap back when a cleared bucket refills", async () => {
      const screen = await renderStep([leftBehind("1"), overdue("2")]);
      expect(drawerProps().filterId).toBe("leftBehind");

      await withTasks(screen, [overdue("2")]);
      expect(drawerProps().filterId).toBe("overdue");

      await withTasks(screen, [leftBehind("3"), overdue("2")]);

      expect(screen.getByLabelText("1 task left behind")).toBeTruthy();
      expect(drawerProps().filterId).toBe("overdue");
    });

    // A preset outside the hero's three is a detour the reader chose; the step
    // has no opinion about it, empty or not.
    it("leaves a preset the hero does not count alone", async () => {
      const screen = await renderStep([leftBehind("1"), overdue("2")]);
      await act(() => drawerProps().onFilterChange?.("unscheduled"));

      await withTasks(screen, [overdue("2")]);

      expect(drawerProps().filterId).toBe("unscheduled");
    });
  });
});
