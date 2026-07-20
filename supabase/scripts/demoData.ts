// Curated, deterministic dataset for the App Store review / marketing demo
// account (DEX-73). This module is intentionally pure — no Deno, network, or
// env access — so it can be unit-tested without a database. `seed-demo.ts`
// resolves the symbolic keys and day offsets below into real UUIDs and dates.
//
// Enum values mirror the app:
//   priority: 0 IMPORTANT_AND_URGENT, 1 URGENT, 2 IMPORTANT, 3 NEITHER, 4 UNPRIORITIZED
//   status:   0 IN_PROGRESS, 1 TODO, 2 DONE, 3 WONT_DO
// (see src/api/tasks.ts and supabase/functions/mcp-server/tools/helpers.ts)

export const DEMO_PRIORITY = {
  IMPORTANT_AND_URGENT: 0,
  URGENT: 1,
  IMPORTANT: 2,
  NEITHER: 3,
  UNPRIORITIZED: 4,
} as const;

export const DEMO_STATUS = {
  IN_PROGRESS: 0,
  TODO: 1,
  DONE: 2,
  WONT_DO: 3,
} as const;

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

export interface DemoTemplate {
  key: string;
  title: string;
  /** Midnight cron: `0 0 <day-of-month> <month> <day-of-week>`. */
  schedule: string;
  priority: number;
  listKey?: string;
  goalKey?: string;
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
}

export interface DemoDailyHabit {
  habitKey: string;
  dateOffset: number;
  steps: number;
  stepsComplete: number;
}

export interface DemoDay {
  dateOffset: number;
  notes: string;
  prompts: { prompt: string; response: string }[];
}

export interface DemoPreferences {
  lightTheme: string;
  darkTheme: string;
  themeMode: number;
  enableNotes: boolean;
  enableJournal: boolean;
  enableHabits: boolean;
  templatePrompts: string[];
}

export interface DemoDataset {
  lists: DemoList[];
  goals: DemoGoal[];
  habits: DemoHabit[];
  templates: DemoTemplate[];
  tasks: DemoTask[];
  dailyHabits: DemoDailyHabit[];
  days: DemoDay[];
  preferences: DemoPreferences;
}

const PROMPTS = [
  "Yesterday's highlight",
  "Today I am grateful for",
  "Today I am excited for",
  "What matters most today",
];

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
    },
    {
      title: "Draft release notes",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: 0,
      dueOnOffset: null,
      listKey: "work",
      goalKey: "launch",
    },
    {
      title: "Weekly review",
      priority: DEMO_PRIORITY.NEITHER,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: 0,
      dueOnOffset: null,
      listKey: "work",
      templateKey: "weeklyReview",
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
    {
      title: "Research a standing desk",
      priority: DEMO_PRIORITY.UNPRIORITIZED,
      status: DEMO_STATUS.TODO,
      scheduledForOffset: null,
      dueOnOffset: null,
      listKey: "personal",
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

  const days: DemoDay[] = [
    {
      dateOffset: -1,
      notes:
        "# Yesterday\n\n- Closed out the beta feedback backlog\n- Good momentum heading into launch week",
      prompts: [
        { prompt: PROMPTS[0], response: "Finished the calendar view redesign" },
        { prompt: PROMPTS[1], response: "A quiet morning to focus" },
        { prompt: PROMPTS[2], response: "Shipping 2.0" },
        { prompt: PROMPTS[3], response: "Polishing the App Store listing" },
      ],
    },
    {
      dateOffset: 0,
      notes:
        "# Today\n\n- Rewrote the README\n- Reviewing App Store assets\n\n> Busy != productive.",
      prompts: [
        { prompt: PROMPTS[0], response: "A great run this morning" },
        { prompt: PROMPTS[1], response: "This planner, honestly" },
        { prompt: PROMPTS[2], response: "Submitting to the App Store" },
        { prompt: PROMPTS[3], response: "Getting the demo account just right" },
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
    templatePrompts: [...PROMPTS],
  };

  return {
    lists,
    goals,
    habits,
    templates,
    tasks,
    dailyHabits,
    days,
    preferences,
  };
}

/** Add `offset` days to an ISO `YYYY-MM-DD` date, returning ISO. Pure/UTC. */
export function addDaysIso(iso: string, offset: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}
