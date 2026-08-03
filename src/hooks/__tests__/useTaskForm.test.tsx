import { Temporal } from "@js-temporal/polyfill";
import { act, renderHook } from "@testing-library/react-native";

import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useTaskForm } from "@/hooks/useTaskForm";

const homeList: TList = {
  id: "list-home",
  title: "Home",
  emoji: "🏠",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const makeTask = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.NEITHER,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Saved task",
  url: null,
  ...overrides,
});

const today = () => Temporal.Now.plainDateISO();

describe("useTaskForm", () => {
  it("defaults to an unprioritized, unlisted task scheduled for today", () => {
    const { result } = renderHook(() => useTaskForm([]));

    expect(result.current.priority).toBe(ETaskPriority.UNPRIORITIZED);
    expect(result.current.listId).toBeNull();
    expect(result.current.dueOn).toBeNull();
    expect(result.current.scheduledFor).toBe(today().toString());
    expect(result.current.templateId).toBeNull();
    expect(result.current.task.templateId).toBeNull();
    expect(result.current.canSave).toBe(false);
  });

  it("schedules for the provided default date instead of today", () => {
    const { result } = renderHook(() =>
      useTaskForm([], { defaultScheduledFor: "2026-07-08" }),
    );

    expect(result.current.scheduledFor).toBe("2026-07-08");
    expect(result.current.task.scheduledFor).toBe("2026-07-08");
  });

  it("falls back to today when no default date is provided", () => {
    const { result } = renderHook(() => useTaskForm([]));

    expect(result.current.scheduledFor).toBe(today().toString());
  });

  it("falls back to today when the default date is malformed", () => {
    // e.g. a deep link like /new-task?scheduledFor=garbage
    const { result } = renderHook(() =>
      useTaskForm([], { defaultScheduledFor: "not-a-date" }),
    );

    expect(result.current.scheduledFor).toBe(today().toString());
  });

  it("carries a cleared schedule through to the payload as unscheduled", () => {
    const { result } = renderHook(() => useTaskForm([]));

    act(() => result.current.setScheduledFor(null));

    expect(result.current.scheduledFor).toBeNull();
    expect(result.current.task.scheduledFor).toBeNull();
  });

  it("cannot save a whitespace-only title", () => {
    const { result } = renderHook(() => useTaskForm([]));

    act(() => result.current.setTitle("   "));

    expect(result.current.canSave).toBe(false);
  });

  it("live-updates priority, list, and deadline from shorthand tokens", () => {
    const { result } = renderHook(() => useTaskForm([homeList]));

    act(() => result.current.setTitle("!!! Ship the report #home due:3"));

    expect(result.current.priority).toBe(ETaskPriority.IMPORTANT_AND_URGENT);
    expect(result.current.listId).toBe(homeList.id);
    expect(result.current.dueOn).toBe(today().add({ days: 3 }).toString());
    expect(result.current.canSave).toBe(true);
    expect(result.current.task).toEqual({
      templateId: null,
      title: "Ship the report",
      priority: ETaskPriority.IMPORTANT_AND_URGENT,
      listId: homeList.id,
      scheduledFor: today().toString(),
      dueOn: today().add({ days: 3 }).toString(),
      alarmTime: null,
      url: null,
      subtasks: [],
    });
  });

  it.each([
    ["!", ETaskPriority.URGENT],
    ["!!", ETaskPriority.IMPORTANT],
    ["!!!", ETaskPriority.IMPORTANT_AND_URGENT],
    ["!!!!", ETaskPriority.NEITHER],
  ])("maps the %s token to the right priority", (token, priority) => {
    const { result } = renderHook(() => useTaskForm([]));

    act(() => result.current.setTitle(`${token} Pay bills`));

    expect(result.current.priority).toBe(priority);
    expect(result.current.task.title).toBe("Pay bills");
  });

  it("ignores an unknown list slug", () => {
    const { result } = renderHook(() => useTaskForm([homeList]));

    act(() => result.current.setTitle("Pay bills #nonexistent"));

    expect(result.current.listId).toBeNull();
    // The unmatched token stays in the title rather than silently vanishing.
    expect(result.current.task.title).toBe("Pay bills #nonexistent");
  });

  it("reverts to defaults when tokens are deleted from the title", () => {
    const { result } = renderHook(() => useTaskForm([homeList]));

    act(() => result.current.setTitle("! Pay bills #home"));
    act(() => result.current.setTitle("Pay bills"));

    expect(result.current.priority).toBe(ETaskPriority.UNPRIORITIZED);
    expect(result.current.listId).toBeNull();
  });

  it("keeps a manual priority over a typed token", () => {
    const { result } = renderHook(() => useTaskForm([]));

    act(() => result.current.setTitle("! Pay bills"));
    act(() => result.current.setPriority(ETaskPriority.IMPORTANT));
    act(() => result.current.setTitle("!!! Pay bills"));

    expect(result.current.priority).toBe(ETaskPriority.IMPORTANT);
    expect(result.current.task.priority).toBe(ETaskPriority.IMPORTANT);
  });

  it("keeps a manually cleared list over a typed token", () => {
    const { result } = renderHook(() => useTaskForm([homeList]));

    act(() => result.current.setTitle("Pay bills #home"));
    act(() => result.current.setListId(null));

    expect(result.current.listId).toBeNull();
  });

  it("keeps a manual deadline over a typed due token", () => {
    const { result } = renderHook(() => useTaskForm([]));
    const manualDate = today().add({ days: 10 }).toString();

    act(() => result.current.setTitle("Pay bills due:2"));
    act(() => result.current.setDueOn(manualDate));

    expect(result.current.dueOn).toBe(manualDate);
    expect(result.current.task.dueOn).toBe(manualDate);
  });

  it("uses the schedule control's value in the payload", () => {
    const { result } = renderHook(() => useTaskForm([]));
    const nextWeek = today().add({ days: 7 }).toString();

    act(() => result.current.setTitle("Plan sprint"));
    act(() => result.current.setScheduledFor(nextWeek));

    expect(result.current.task.scheduledFor).toBe(nextWeek);
  });

  it("defaults to no alarm", () => {
    const { result } = renderHook(() => useTaskForm([]));

    expect(result.current.alarmTime).toBeNull();
    expect(result.current.task.alarmTime).toBeNull();
  });

  it("carries a set alarm time into the payload, and clears it back to null", () => {
    const { result } = renderHook(() => useTaskForm([]));

    act(() => result.current.setAlarmTime("09:00"));
    expect(result.current.alarmTime).toBe("09:00");
    expect(result.current.task.alarmTime).toBe("09:00");

    act(() => result.current.setAlarmTime(null));
    expect(result.current.task.alarmTime).toBeNull();
  });

  describe("subtasks", () => {
    it("starts with an empty checklist", () => {
      const { result } = renderHook(() => useTaskForm([]));

      expect(result.current.subtasks).toEqual([]);
      expect(result.current.task.subtasks).toEqual([]);
    });

    it("carries titled subtasks into the create payload, in order", () => {
      const { result } = renderHook(() => useTaskForm([]));

      act(() =>
        result.current.setSubtasks([
          { id: "s1", title: "First", status: ETaskStatus.TODO },
          { id: "s2", title: "Second", status: ETaskStatus.TODO },
        ]),
      );

      // A task and its checklist are created in one insert.
      expect(result.current.task.subtasks?.map(({ title }) => title)).toEqual([
        "First",
        "Second",
      ]);
    });

    it("omits an untitled row from the payload without discarding it from the form", () => {
      const { result } = renderHook(() => useTaskForm([]));

      act(() =>
        result.current.setSubtasks([
          { id: "s1", title: "Real", status: ETaskStatus.TODO },
          { id: "s2", title: "   ", status: ETaskStatus.TODO },
        ]),
      );

      // The row stays visible so it can be typed into, but a half-finished
      // edit is not a checklist item.
      expect(result.current.subtasks).toHaveLength(2);
      expect(result.current.task.subtasks?.map(({ title }) => title)).toEqual([
        "Real",
      ]);
    });
  });

  describe("applyTemplate", () => {
    const template = {
      id: "template-1",
      alarmTime: "07:30",
      createdAt: "2026-01-01T00:00:00Z",
      goalId: null,
      listId: "list-home",
      priority: ETaskPriority.IMPORTANT,
      schedule: null,
      subtasks: [
        { id: "s1", title: "Passport" },
        { id: "s2", title: "Charger" },
      ],
      title: "Trip packing",
      userId: "user-1",
    };

    it("fills the form from the template", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() => result.current.applyTemplate(template));

      expect(result.current.title).toBe("Trip packing");
      expect(result.current.priority).toBe(ETaskPriority.IMPORTANT);
      expect(result.current.listId).toBe("list-home");
    });

    // `template_id` means "this task came from that template", which is simply
    // true of a stamped task — so the payload records it. The picker only
    // offers scheduleless rows, so nothing recurs from the link.
    it("stamps the template's id onto the form and the payload", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() => result.current.applyTemplate(template));

      expect(result.current.templateId).toBe("template-1");
      expect(result.current.task.templateId).toBe("template-1");
    });

    // The seeded values survive an edit, so the provenance has to as well —
    // clearing it would produce a task whose contents came from a template but
    // which claims otherwise.
    it("keeps the id after the user edits a seeded field", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() => result.current.applyTemplate(template));
      act(() => result.current.setTitle("Trip packing (Berlin)"));

      expect(result.current.task.templateId).toBe("template-1");
    });

    // An alarm only rings once AlarmKit is authorized and the task has a day to
    // fire on. This path can promise neither, and the modal's "Add alarm" is
    // what asks for permission — so a copied alarm would silently never ring.
    it("does not carry the template's alarm across", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() => result.current.applyTemplate(template));

      expect(result.current.alarmTime).toBeNull();
      expect(result.current.task.alarmTime).toBeNull();
    });

    // A template's checklist is a blueprint with no status, so every item has
    // to start this task's own copy open.
    it("materializes the checklist blueprint as open subtasks", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() => result.current.applyTemplate(template));

      expect(result.current.task.subtasks).toEqual([
        { id: expect.any(String), title: "Passport", status: ETaskStatus.TODO },
        { id: expect.any(String), title: "Charger", status: ETaskStatus.TODO },
      ]);
    });

    // Every other copy-onto-a-different-row path re-keys (see `withFreshIds`),
    // so two tasks stamped from one template never share subtask ids.
    it("mints fresh subtask ids rather than reusing the template's", () => {
      const first = renderHook(() => useTaskForm([homeList]));
      const second = renderHook(() => useTaskForm([homeList]));

      act(() => first.result.current.applyTemplate(template));
      act(() => second.result.current.applyTemplate(template));

      const ids = (rows: { id: string }[] = []) => rows.map(({ id }) => id);
      const firstIds = ids(first.result.current.task.subtasks);
      const secondIds = ids(second.result.current.task.subtasks);

      expect(firstIds).not.toEqual(["s1", "s2"]);
      expect(firstIds).not.toEqual(secondIds);
    });

    // The template editor's title field does no shorthand parsing, so a title
    // containing `due:5` round-trips into storage verbatim and would otherwise
    // move the deadline when the template is applied.
    it("ignores a due: token in the template's own title", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() => result.current.setDueOn("2026-07-20"));
      act(() =>
        result.current.applyTemplate({ ...template, title: "Pay rent due:5" }),
      );

      expect(result.current.dueOn).toBe("2026-07-20");
    });

    // The template carries no dates, so the day the user was viewing has to
    // survive the moment they pick one.
    it("leaves the schedule and deadline alone", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], { defaultScheduledFor: "2026-07-08" }),
      );

      act(() => result.current.setDueOn("2026-07-20"));
      act(() => result.current.applyTemplate(template));

      expect(result.current.scheduledFor).toBe("2026-07-08");
      expect(result.current.dueOn).toBe("2026-07-20");
    });

    // The title arrives from the template, and it may well contain a `!` or a
    // `#list` that was only ever meant as text.
    it("keeps the template's own priority and list over its title's shorthand", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() =>
        result.current.applyTemplate({
          ...template,
          title: "!!!! Pack #home",
          priority: ETaskPriority.NEITHER,
          listId: null,
        }),
      );

      expect(result.current.priority).toBe(ETaskPriority.NEITHER);
      expect(result.current.listId).toBeNull();
    });
  });

  describe("link", () => {
    it("starts empty and saves as no link at all, not an empty one", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      expect(result.current.url).toBe("");
      expect(result.current.task.url).toBeNull();
    });

    it("seeds create mode from a shared link", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], { defaultUrl: "https://example.com/article" }),
      );

      expect(result.current.url).toBe("https://example.com/article");
      expect(result.current.task.url).toBe("https://example.com/article");
    });

    // Typing is left verbatim; the rule runs on the way into the payload, so a
    // half-typed host is never rewritten mid-keystroke.
    it("normalizes on save without touching what is being typed", () => {
      const { result } = renderHook(() => useTaskForm([homeList]));

      act(() => result.current.setUrl("  dexterplanner.com "));

      expect(result.current.url).toBe("  dexterplanner.com ");
      expect(result.current.task.url).toBe("https://dexterplanner.com");
    });

    it("clears a saved link back to null", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], {
          task: makeTask({ url: "https://example.com" }),
        }),
      );

      act(() => result.current.setUrl(""));

      expect(result.current.task.url).toBeNull();
    });

    // A link is not a task: it says nothing about whether there is one to save.
    it("does not make an untitled task saveable", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], { defaultUrl: "https://example.com" }),
      );

      expect(result.current.canSave).toBe(false);
    });

    // Editing is never the target of a share, so the two can't both be live.
    it("prefers the saved task's link over a shared one", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], {
          task: makeTask({ url: "https://saved.example.com" }),
          defaultUrl: "https://shared.example.com",
        }),
      );

      expect(result.current.url).toBe("https://saved.example.com");
    });
  });

  describe("edit mode", () => {
    it("seeds every field from the task rather than from create defaults", () => {
      const task = makeTask({
        alarmTime: "07:15",
        dueOn: "2026-08-01",
        listId: "list-home",
        priority: ETaskPriority.IMPORTANT,
        scheduledFor: "2026-07-20",
        subtasks: [{ id: "s1", title: "Passport", status: ETaskStatus.DONE }],
        templateId: "template-1",
        title: "Pack for Berlin",
        url: "https://example.com/packing",
      });

      const { result } = renderHook(() => useTaskForm([homeList], { task }));

      expect(result.current.title).toBe("Pack for Berlin");
      expect(result.current.priority).toBe(ETaskPriority.IMPORTANT);
      expect(result.current.listId).toBe("list-home");
      expect(result.current.scheduledFor).toBe("2026-07-20");
      expect(result.current.dueOn).toBe("2026-08-01");
      expect(result.current.alarmTime).toBe("07:15");
      expect(result.current.url).toBe("https://example.com/packing");
      expect(result.current.subtasks).toEqual(task.subtasks);
      expect(result.current.canSave).toBe(true);
    });

    // An unscheduled task stays unscheduled: `defaultScheduledFor` describes
    // where a *new* task should land, and applying it here would silently
    // reschedule a task the user only opened to rename.
    it("keeps an unscheduled task unscheduled, ignoring the create default", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], {
          task: makeTask({ scheduledFor: null }),
          defaultScheduledFor: "2026-07-08",
        }),
      );

      expect(result.current.scheduledFor).toBeNull();
      expect(result.current.task.scheduledFor).toBeNull();
    });

    // The whole point of gating the parser: a saved title is text, not input.
    it("leaves shorthand characters in a saved title alone", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], {
          task: makeTask({ title: "Ship it!! #home due:3" }),
        }),
      );

      expect(result.current.title).toBe("Ship it!! #home due:3");
      expect(result.current.task.title).toBe("Ship it!! #home due:3");
      // Read off the task's own columns, never re-derived from those tokens.
      expect(result.current.priority).toBe(ETaskPriority.NEITHER);
      expect(result.current.listId).toBeNull();
      expect(result.current.dueOn).toBeNull();
    });

    // Typing tokens while editing is just typing — the row's own columns keep
    // their values, and the characters survive into the payload.
    it("does not parse tokens typed into the title while editing", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], { task: makeTask() }),
      );

      act(() => result.current.setTitle("!!! Rewrite the deck #home due:2"));

      expect(result.current.task.title).toBe(
        "!!! Rewrite the deck #home due:2",
      );
      expect(result.current.priority).toBe(ETaskPriority.NEITHER);
      expect(result.current.listId).toBeNull();
      expect(result.current.dueOn).toBeNull();
    });

    it("still trims the title and refuses to save an emptied one", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], { task: makeTask() }),
      );

      act(() => result.current.setTitle("  Renamed  "));
      expect(result.current.task.title).toBe("Renamed");

      act(() => result.current.setTitle("   "));
      expect(result.current.canSave).toBe(false);
    });

    // The payload is spread into `updateTask`, so a field the form doesn't own
    // must stay out of it entirely rather than go along as a stale value.
    it("omits goalId and status from the payload so an update can't clobber them", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], {
          task: makeTask({ goalId: "goal-1", status: ETaskStatus.IN_PROGRESS }),
        }),
      );

      expect(result.current.task).not.toHaveProperty("goalId");
      expect(result.current.task).not.toHaveProperty("status");
    });

    // Provenance is the task's, not the form's — writing the payload back has
    // to leave `template_id` pointing where it already pointed.
    it("carries the task's template link through unchanged", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], {
          task: makeTask({ templateId: "template-1" }),
        }),
      );

      act(() => result.current.setTitle("Renamed"));

      expect(result.current.task.templateId).toBe("template-1");
    });

    it("carries manual edits into the payload", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], { task: makeTask() }),
      );

      act(() => result.current.setPriority(ETaskPriority.URGENT));
      act(() => result.current.setListId("list-home"));
      act(() => result.current.setDueOn("2026-09-09"));
      act(() => result.current.setScheduledFor(null));

      expect(result.current.task).toMatchObject({
        priority: ETaskPriority.URGENT,
        listId: "list-home",
        dueOn: "2026-09-09",
        scheduledFor: null,
      });
    });

    // Clearing a seeded value has to stick: `undefined` means "follow the
    // tokens" in create mode, so a null that collapsed back to the task's own
    // value would make the list unclearable.
    it("lets a seeded list and deadline be cleared back to null", () => {
      const { result } = renderHook(() =>
        useTaskForm([homeList], {
          task: makeTask({ listId: "list-home", dueOn: "2026-08-01" }),
        }),
      );

      act(() => result.current.setListId(null));
      act(() => result.current.setDueOn(null));

      expect(result.current.task.listId).toBeNull();
      expect(result.current.task.dueOn).toBeNull();
    });
  });
});
