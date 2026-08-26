// Curated, deterministic dataset for the App Store review / marketing demo
// account (DEX-73). This module is intentionally pure — no Deno, network, or
// env access — so it can be unit-tested without a database. `seed-demo.ts`
// resolves the symbolic keys and day offsets below into real UUIDs and dates.
//
// Status and priority are the app's own enums, not copies of them —
// `scripts/deno.json` maps `@src/` the same way the MCP server's config does,
// and both modules are import-free, so this one stays pure. Aliased to
// `DEMO_STATUS` / `DEMO_PRIORITY` to keep the `DEMO_*` naming the rest of the
// file reads by. Priority was a hand-copied object literal until DEX-137
// extracted `ETaskPriority` somewhere Deno could reach it.
import { ETaskPriority as DEMO_PRIORITY } from "@src/utils/taskPriority.ts";
import { ETaskStatus as DEMO_STATUS } from "@src/utils/taskStatus.ts";

export { DEMO_PRIORITY, DEMO_STATUS };

export interface DemoList {
  key: string;
  title: string;
  emoji: string;
}

export interface DemoGoal {
  key: string;
  title: string;
}

export interface DemoHabit {
  key: string;
  title: string;
  emoji: string;
  steps: number;
  /** ISO weekday numbers the habit is active on: 1 = Mon … 7 = Sun. */
  daysActive: number[];
}

/** A subtask on a demo task: `{id, title, done}`, matching the jsonb column. */
export interface DemoSubtask {
  id: string;
  title: string;
  done: boolean;
}

/** A template's checklist blueprint: `{id, title}` only — no `done`. */
export interface DemoTemplateSubtask {
  id: string;
  title: string;
}

export interface DemoTemplate {
  key: string;
  title: string;
  /** Midnight cron: `0 0 <day-of-month> <month> <day-of-week>`. */
  schedule: string;
  priority: number;
  listKey?: string;
  goalKey?: string;
  /** Checklist copied onto each generated occurrence, reset to open (DEX-70). */
  subtasks?: DemoTemplateSubtask[];
}

export interface DemoTask {
  title: string;
  priority: number;
  status: number;
  /** Days from "today"; negative = past, null = unscheduled backlog. */
  scheduledForOffset: number | null;
  /** Days from "today" for the due date, or null. */
  dueOnOffset: number | null;
  listKey?: string;
  goalKey?: string;
  templateKey?: string;
  /** Local alarm time `HH:MM`, iOS-only at runtime. */
  alarmTime?: string;
  /** In-card checklist stored on the task's `subtasks` jsonb column (DEX-70). */
  subtasks?: DemoSubtask[];
}

export interface DemoDailyHabit {
  habitKey: string;
  dateOffset: number;
  steps: number;
  stepsComplete: number;
}

export interface DemoNote {
  dateOffset: number;
  content: string;
}

export interface DemoJournal {
  dateOffset: number;
  prompts: { prompt: string; response: string; period: "am" | "pm" }[];
}

export interface DemoPreferences {
  lightTheme: string;
  darkTheme: string;
  themeMode: number;
  enableNotes: boolean;
  enableJournal: boolean;
  enableHabits: boolean;
  enableHoroscope: boolean;
  /** A `public.sun_sign` enum value — see 20260804005118_add_horoscopes.sql. */
  sunSign: string;
  /** The morning ritual's journal prompts. */
  templatePrompts: string[];
  /** The evening ritual's (DEX-151). Both are seeded so the demo account has a
   * Journal step in each half of the day — an empty list would drop the step
   * from that ritual entirely, and the screenshots walk both. */
  templatePromptsPm: string[];
}

export interface DemoDataset {
  lists: DemoList[];
  goals: DemoGoal[];
  habits: DemoHabit[];
  templates: DemoTemplate[];
  tasks: DemoTask[];
  dailyHabits: DemoDailyHabit[];
  notes: DemoNote[];
  journals: DemoJournal[];
  preferences: DemoPreferences;
}

// Split by ritual since DEX-151. The morning set is the app's own default,
// unchanged; the evening set is new, and deliberately short — an evening
// journal that asks four questions of someone winding down is a chore, and two
// is enough to show the step is not a copy of the morning's.
const AM_PROMPTS = [
  "Yesterday's highlight",
  "Today I am grateful for",
  "Today I am excited for",
  "What matters most today",
];

const PM_PROMPTS = ["What went well today", "What I would do differently"];

/**
 * Build the curated demo dataset. Deterministic and self-consistent: every
 * `*Key` reference on a task/template/daily-habit points at an entity defined
 * here, so `seed-demo.ts` can resolve them and the unit test can assert it.
 */
export function buildDemoData(): DemoDataset {
  const lists: DemoList[] = [
    { key: "work", title: "Work", emoji: "💼" },
    { key: "personal", title: "Personal", emoji: "🏡" },
    { key: "errands", title: "Errands", emoji: "🛒" },
    { key: "health", title: "Health", emoji: "🏃" },
  ];

  const goals: DemoGoal[] = [
    { key: "launch", title: "Launch Dexter 2.0" },
    { key: "marathon", title: "Train for a half marathon" },
  ];

  const habits: DemoHabit[] = [
    {
      key: "walk",
      title: "Morning walk",
      emoji: "🚶",
      steps: 1,
      daysActive: [1, 2, 3, 4, 5, 6, 7],
    },
    {
      key: "water",
      title: "Drink water",
      emoji: "💧",
      steps: 8,
      daysActive: [1, 2, 3, 4, 5, 6, 7],
    },
    {
      key: "read",
      title: "Read 20 minutes",
      emoji: "📖",
      steps: 1,
      daysActive: [1, 2, 3, 4, 5],
    },
  ];

  const templates: DemoTemplate[] = [
    {
      key: "weeklyReview",
      title: "Weekly review",
      schedule: "0 0 * * 0",
      priority: DEMO_PRIORITY.IMPORTANT,
      listKey: "work",
      subtasks: [
        { id: "wr-1", title: "Clear inbox to zero" },
        { id: "wr-2", title: "Review this week's goals" },
        { id: "wr-3", title: "Plan next week's priorities" },
      ],
    },
    {
      key: "standup",
      title: "Team standup",
      schedule: "0 0 * * 1,2,3,4,5",
      priority: DEMO_PRIORITY.URGENT,
      listKey: "work",
    },
  ];

  const tasks: DemoTask[] = [
    {
      title: "Prepare App Store screenshots",
      priority: DEMO_PRIORITY.IMPORTANT_AND_URGENT,
      status: DEMO_STATUS.DONE,
      scheduledForOffset: 0,
      dueOnOffset: 0,
      listKey: "work",
      goalKey: "launch",
    },
    {
      title: "Reply to beta tester feedback",
      priority: DEMO_PRIORITY.URGENT,
      status: DEMO_STATUS.IN_PROGRESS,
      scheduledForOffset: 0,
      dueOnOffset: 1,
      listKey: "work",
      // A checklist mid-flight: some checked off, some still open.
      subtasks: [
        { id: "bf-1", title: "Triage new reports", done: true },
        { id: "bf-2", title: "Reply to the crash on iPad", done: false },
        { id: "bf-3", title: "Thank the TestFlight group", done: false },
      ],
    },
    {
      title: "Draft release notes",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: 0,
      dueOnOffset: null,
      listKey: "work",
      goalKey: "launch",
      // A fresh checklist, nothing started yet.
      subtasks: [
        { id: "rn-1", title: "Summarize new features", done: false },
        { id: "rn-2", title: "List bug fixes", done: false },
        { id: "rn-3", title: "Proofread", done: false },
      ],
    },
    {
      title: "Weekly review",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: 0,
      dueOnOffset: null,
      listKey: "work",
      templateKey: "weeklyReview",
      // This occurrence's copy of the template's checklist, materialized
      // unchecked.
      subtasks: [
        { id: "wro-1", title: "Clear inbox to zero", done: false },
        { id: "wro-2", title: "Review this week's goals", done: false },
        { id: "wro-3", title: "Plan next week's priorities", done: false },
      ],
    },
    {
      title: "Submit tax documents",
      priority: DEMO_PRIORITY.IMPORTANT_AND_URGENT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: 0,
      dueOnOffset: 2,
      listKey: "personal",
    },
    {
      title: "Call mom",
      priority: DEMO_PRIORITY.IMPORTANT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: 0,
      dueOnOffset: null,
      listKey: "personal",
      alarmTime: "18:00",
    },
    {
      title: "Buy groceries",
      priority: DEMO_PRIORITY.UNPRIORITIZED,
      status: DEMO_STATUS.DONE,
      scheduledForOffset: 0,
      dueOnOffset: null,
      listKey: "errands",
    },
    {
      title: "Book dentist appointment",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.DONE,
      scheduledForOffset: 0,
      dueOnOffset: null,
      listKey: "errands",
    },
    {
      title: "File Q2 expense report",
      priority: DEMO_PRIORITY.URGENT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: -3,
      dueOnOffset: -2,
      listKey: "work",
    },
    {
      title: "Send invoice to client",
      priority: DEMO_PRIORITY.IMPORTANT_AND_URGENT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: -5,
      dueOnOffset: -4,
      listKey: "work",
    },
    {
      title: "Renew car registration",
      priority: DEMO_PRIORITY.URGENT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: -2,
      dueOnOffset: -1,
      listKey: "personal",
    },
    {
      title: "Water the plants",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: -2,
      dueOnOffset: null,
      listKey: "personal",
    },
    {
      title: "Morning 5k run",
      priority: DEMO_PRIORITY.IMPORTANT,
      status: DEMO_STATUS.DONE,
      scheduledForOffset: -1,
      dueOnOffset: null,
      listKey: "health",
      goalKey: "marathon",
      alarmTime: "06:30",
    },
    {
      title: "Optional webinar",
      priority: DEMO_PRIORITY.UNPRIORITIZED,
      status: DEMO_STATUS.WONT_DO,
      scheduledForOffset: -1,
      dueOnOffset: null,
    },
    {
      title: "Plan weekend trip",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: 1,
      dueOnOffset: null,
      listKey: "personal",
    },
    // The unscheduled tail — everything below here has `scheduledForOffset:
    // null` and so lands in the task drawer's Unscheduled filter. There are
    // several on purpose: the drawer is one of the App Store screenshots, and a
    // backlog holding a single task reads as an empty feature rather than a
    // place work waits. Spread across lists and priorities so the drawer shows
    // its grouping and colour rather than one flat run.
    {
      title: "Research a standing desk",
      priority: DEMO_PRIORITY.UNPRIORITIZED,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: null,
      dueOnOffset: null,
      listKey: "personal",
    },
    {
      title: "Write the Q3 roadmap",
      priority: DEMO_PRIORITY.IMPORTANT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: null,
      dueOnOffset: null,
      listKey: "work",
    },
    {
      title: "Replace the smoke alarm batteries",
      priority: DEMO_PRIORITY.URGENT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: null,
      dueOnOffset: null,
      listKey: "errands",
    },
    {
      title: "Book the dentist follow-up",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: null,
      dueOnOffset: null,
      listKey: "health",
    },
    {
      title: "Sketch the onboarding flow",
      priority: DEMO_PRIORITY.IMPORTANT,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: null,
      dueOnOffset: null,
      listKey: "work",
    },
    {
      title: "Find a running club",
      priority: DEMO_PRIORITY.UNPRIORITIZED,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: null,
      dueOnOffset: null,
      listKey: "health",
    },
  ];

  const dailyHabits: DemoDailyHabit[] = [
    { habitKey: "walk", dateOffset: -2, steps: 1, stepsComplete: 1 },
    { habitKey: "walk", dateOffset: -1, steps: 1, stepsComplete: 1 },
    { habitKey: "walk", dateOffset: 0, steps: 1, stepsComplete: 0 },
    { habitKey: "water", dateOffset: -2, steps: 8, stepsComplete: 8 },
    { habitKey: "water", dateOffset: -1, steps: 8, stepsComplete: 6 },
    { habitKey: "water", dateOffset: 0, steps: 8, stepsComplete: 3 },
    { habitKey: "read", dateOffset: -1, steps: 1, stepsComplete: 1 },
    { habitKey: "read", dateOffset: 0, steps: 1, stepsComplete: 0 },
  ];

  const notes: DemoNote[] = [
    {
      dateOffset: -1,
      content:
        "# Yesterday\n\n- Closed out the beta feedback backlog\n- Good momentum heading into launch week",
    },
    {
      dateOffset: 0,
      content:
        "# Today\n\n- Rewrote the README\n- Reviewing App Store assets\n\n> Busy != productive.",
    },
  ];

  const journals: DemoJournal[] = [
    {
      dateOffset: -1,
      prompts: [
        {
          prompt: AM_PROMPTS[0],
          response: "Finished the calendar view redesign",
          period: "am",
        },
        {
          prompt: AM_PROMPTS[1],
          response: "A quiet morning to focus",
          period: "am",
        },
        { prompt: AM_PROMPTS[2], response: "Shipping 2.0", period: "am" },
        {
          prompt: AM_PROMPTS[3],
          response: "Polishing the App Store listing",
          period: "am",
        },
        {
          prompt: PM_PROMPTS[0],
          response: "The redesign landed without a single rollback",
          period: "pm",
        },
        {
          prompt: PM_PROMPTS[1],
          response: "Started the day in my inbox instead of on the plan",
          period: "pm",
        },
      ],
    },
    {
      dateOffset: 0,
      prompts: [
        {
          prompt: AM_PROMPTS[0],
          response: "A great run this morning",
          period: "am",
        },
        {
          prompt: AM_PROMPTS[1],
          response: "This planner, honestly",
          period: "am",
        },
        {
          prompt: AM_PROMPTS[2],
          response: "Submitting to the App Store",
          period: "am",
        },
        {
          prompt: AM_PROMPTS[3],
          response: "Getting the demo account just right",
          period: "am",
        },
        // Left blank: today's evening ritual has not happened yet, so an
        // answered PM prompt would read as a day journalled out of order.
        { prompt: PM_PROMPTS[0], response: "", period: "pm" },
        { prompt: PM_PROMPTS[1], response: "", period: "pm" },
      ],
    },
  ];

  const preferences: DemoPreferences = {
    lightTheme: "dexter",
    darkTheme: "dark",
    themeMode: 0,
    enableNotes: true,
    enableJournal: true,
    enableHabits: true,
    enableHoroscope: true,
    // Set so the Horoscope step shows an actual horoscope: with no sign it
    // renders the "Choose your sign" prompt instead, which is not what the demo
    // account or an App Store screenshot should show.
    sunSign: "libra",
    templatePrompts: [...AM_PROMPTS],
    templatePromptsPm: [...PM_PROMPTS],
  };

  return {
    lists,
    goals,
    habits,
    templates,
    tasks,
    dailyHabits,
    notes,
    journals,
    preferences,
  };
}

/** Add `offset` days to an ISO `YYYY-MM-DD` date, returning ISO. Pure/UTC. */
export function addDaysIso(iso: string, offset: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}
