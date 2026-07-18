import { Temporal } from "@js-temporal/polyfill";
import { act, renderHook } from "@testing-library/react-native";

import { TList } from "@/api/lists";
import { ETaskPriority } from "@/api/tasks";
import { useNewTaskForm } from "@/hooks/useNewTaskForm";

const homeList: TList = {
  id: "list-home",
  title: "Home",
  emoji: "🏠",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const today = () => Temporal.Now.plainDateISO();

describe("useNewTaskForm", () => {
  it("defaults to an unprioritized, unlisted task scheduled for today", () => {
    const { result } = renderHook(() => useNewTaskForm([]));

    expect(result.current.priority).toBe(ETaskPriority.UNPRIORITIZED);
    expect(result.current.listId).toBeNull();
    expect(result.current.dueOn).toBeNull();
    expect(result.current.scheduledFor).toBe(today().toString());
    expect(result.current.canSave).toBe(false);
  });

  it("schedules for the provided default date instead of today", () => {
    const { result } = renderHook(() => useNewTaskForm([], "2026-07-08"));

    expect(result.current.scheduledFor).toBe("2026-07-08");
    expect(result.current.task.scheduledFor).toBe("2026-07-08");
  });

  it("falls back to today when no default date is provided", () => {
    const { result } = renderHook(() => useNewTaskForm([], undefined));

    expect(result.current.scheduledFor).toBe(today().toString());
  });

  it("falls back to today when the default date is malformed", () => {
    // e.g. a deep link like /new-task?scheduledFor=garbage
    const { result } = renderHook(() => useNewTaskForm([], "not-a-date"));

    expect(result.current.scheduledFor).toBe(today().toString());
  });

  it("cannot save a whitespace-only title", () => {
    const { result } = renderHook(() => useNewTaskForm([]));

    act(() => result.current.setTitle("   "));

    expect(result.current.canSave).toBe(false);
  });

  it("live-updates priority, list, and deadline from shorthand tokens", () => {
    const { result } = renderHook(() => useNewTaskForm([homeList]));

    act(() => result.current.setTitle("!!! Ship the report #home due:3"));

    expect(result.current.priority).toBe(ETaskPriority.IMPORTANT_AND_URGENT);
    expect(result.current.listId).toBe(homeList.id);
    expect(result.current.dueOn).toBe(today().add({ days: 3 }).toString());
    expect(result.current.canSave).toBe(true);
    expect(result.current.task).toEqual({
      title: "Ship the report",
      priority: ETaskPriority.IMPORTANT_AND_URGENT,
      listId: homeList.id,
      scheduledFor: today().toString(),
      dueOn: today().add({ days: 3 }).toString(),
      alarmTime: null,
    });
  });

  it.each([
    ["!", ETaskPriority.URGENT],
    ["!!", ETaskPriority.IMPORTANT],
    ["!!!", ETaskPriority.IMPORTANT_AND_URGENT],
    ["!!!!", ETaskPriority.NEITHER],
  ])("maps the %s token to the right priority", (token, priority) => {
    const { result } = renderHook(() => useNewTaskForm([]));

    act(() => result.current.setTitle(`${token} Pay bills`));

    expect(result.current.priority).toBe(priority);
    expect(result.current.task.title).toBe("Pay bills");
  });

  it("ignores an unknown list slug", () => {
    const { result } = renderHook(() => useNewTaskForm([homeList]));

    act(() => result.current.setTitle("Pay bills #nonexistent"));

    expect(result.current.listId).toBeNull();
    // The unmatched token stays in the title rather than silently vanishing.
    expect(result.current.task.title).toBe("Pay bills #nonexistent");
  });

  it("reverts to defaults when tokens are deleted from the title", () => {
    const { result } = renderHook(() => useNewTaskForm([homeList]));

    act(() => result.current.setTitle("! Pay bills #home"));
    act(() => result.current.setTitle("Pay bills"));

    expect(result.current.priority).toBe(ETaskPriority.UNPRIORITIZED);
    expect(result.current.listId).toBeNull();
  });

  it("keeps a manual priority over a typed token", () => {
    const { result } = renderHook(() => useNewTaskForm([]));

    act(() => result.current.setTitle("! Pay bills"));
    act(() => result.current.setPriority(ETaskPriority.IMPORTANT));
    act(() => result.current.setTitle("!!! Pay bills"));

    expect(result.current.priority).toBe(ETaskPriority.IMPORTANT);
    expect(result.current.task.priority).toBe(ETaskPriority.IMPORTANT);
  });

  it("keeps a manually cleared list over a typed token", () => {
    const { result } = renderHook(() => useNewTaskForm([homeList]));

    act(() => result.current.setTitle("Pay bills #home"));
    act(() => result.current.setListId(null));

    expect(result.current.listId).toBeNull();
  });

  it("keeps a manual deadline over a typed due token", () => {
    const { result } = renderHook(() => useNewTaskForm([]));
    const manualDate = today().add({ days: 10 }).toString();

    act(() => result.current.setTitle("Pay bills due:2"));
    act(() => result.current.setDueOn(manualDate));

    expect(result.current.dueOn).toBe(manualDate);
    expect(result.current.task.dueOn).toBe(manualDate);
  });

  it("uses the schedule control's value in the payload", () => {
    const { result } = renderHook(() => useNewTaskForm([]));
    const nextWeek = today().add({ days: 7 }).toString();

    act(() => result.current.setTitle("Plan sprint"));
    act(() => result.current.setScheduledFor(nextWeek));

    expect(result.current.task.scheduledFor).toBe(nextWeek);
  });

  it("defaults to no alarm", () => {
    const { result } = renderHook(() => useNewTaskForm([]));

    expect(result.current.alarmTime).toBeNull();
    expect(result.current.task.alarmTime).toBeNull();
  });

  it("carries a set alarm time into the payload, and clears it back to null", () => {
    const { result } = renderHook(() => useNewTaskForm([]));

    act(() => result.current.setAlarmTime("09:00"));
    expect(result.current.alarmTime).toBe("09:00");
    expect(result.current.task.alarmTime).toBe("09:00");

    act(() => result.current.setAlarmTime(null));
    expect(result.current.task.alarmTime).toBeNull();
  });
});
