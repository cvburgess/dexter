// Reset the App Store / marketing demo account to a curated, known-good state
// (DEX-73). Idempotent: run it as often as you like and the demo user always
// lands on the same data.
//
// Usage (never commit these values — pass them at runtime):
//   cd supabase/scripts
//   SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   DEMO_EMAIL=demo@dexterplanner.com \
//   DEMO_PASSWORD=... \
//   deno task seed-demo
//
// The service-role key bypasses RLS, so every inserted row sets `user_id`
// explicitly (there is no `auth.uid()` under the service role). It is a secret
// with full database access — only ever supply it via the environment.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@src/types/database.types.ts";

import { addDaysIso, buildDemoData, type DemoDataset } from "./demoData.ts";

type Client = SupabaseClient<Database>;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    Deno.exit(1);
  }
  return value;
}

/** Find the demo user by email (paging through the admin list) or create it. */
async function findOrCreateDemoUser(
  supabase: Client,
  email: string,
  password: string,
): Promise<string> {
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const existing = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (existing) {
      // Keep the password in sync so the reviewer login never drifts.
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password },
      );
      if (updateError) {
        throw new Error(
          `Failed updating demo password: ${updateError.message}`,
        );
      }
      console.log(`Found existing demo user ${email} (${existing.id})`);
      return existing.id;
    }

    if (data.users.length < perPage) break; // last page
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Created demo user ${email} (${data.user.id})`);
  return data.user.id;
}

/** Delete every demo-owned row so the reseed is deterministic. */
async function wipeUserData(supabase: Client, userId: string): Promise<void> {
  // daily_habits first (FK → habits); the rest are independent per user.
  const tables = [
    "daily_habits",
    "tasks",
    "repeat_task_templates",
    "habits",
    "goals",
    "lists",
    "days",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Failed clearing ${table}: ${error.message}`);
  }
}

/** Assign a fresh UUID to each entity's key, before any round-trip. */
function idMap<T extends { key: string }>(entities: T[]): Map<string, string> {
  return new Map(entities.map((entity) => [entity.key, crypto.randomUUID()]));
}

/** Await a Supabase write and throw a labeled error if it failed. */
async function runWrite(
  label: string,
  query: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(`Failed writing ${label}: ${error.message}`);
}

async function seed(
  supabase: Client,
  userId: string,
  data: DemoDataset,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const date = (offset: number | null) =>
    offset === null ? null : addDaysIso(today, offset);

  // Generate ids client-side (the Insert types accept `id`) so foreign keys
  // resolve without a round-trip and without correlating returned rows.
  const listIds = idMap(data.lists);
  const goalIds = idMap(data.goals);
  const habitIds = idMap(data.habits);
  const templateIds = idMap(data.templates);

  await runWrite(
    "lists",
    supabase.from("lists").insert(
      data.lists.map((list) => ({
        id: listIds.get(list.key)!,
        user_id: userId,
        title: list.title,
        emoji: list.emoji,
      })),
    ),
  );

  await runWrite(
    "goals",
    supabase.from("goals").insert(
      data.goals.map((goal) => ({
        id: goalIds.get(goal.key)!,
        user_id: userId,
        title: goal.title,
      })),
    ),
  );

  await runWrite(
    "habits",
    supabase.from("habits").insert(
      data.habits.map((habit) => ({
        id: habitIds.get(habit.key)!,
        user_id: userId,
        title: habit.title,
        emoji: habit.emoji,
        steps: habit.steps,
        days_active: habit.daysActive,
      })),
    ),
  );

  await runWrite(
    "repeat_task_templates",
    supabase.from("repeat_task_templates").insert(
      data.templates.map((template) => ({
        id: templateIds.get(template.key)!,
        user_id: userId,
        title: template.title,
        schedule: template.schedule,
        priority: template.priority,
        list_id: template.listKey ? listIds.get(template.listKey)! : null,
        goal_id: template.goalKey ? goalIds.get(template.goalKey)! : null,
      })),
    ),
  );

  await runWrite(
    "tasks",
    supabase.from("tasks").insert(
      data.tasks.map((task) => ({
        user_id: userId,
        title: task.title,
        priority: task.priority,
        status: task.status,
        scheduled_for: date(task.scheduledForOffset),
        due_on: date(task.dueOnOffset),
        list_id: task.listKey ? listIds.get(task.listKey)! : null,
        goal_id: task.goalKey ? goalIds.get(task.goalKey)! : null,
        template_id: task.templateKey
          ? templateIds.get(task.templateKey)!
          : null,
        alarm_time: task.alarmTime ?? null,
      })),
    ),
  );

  await runWrite(
    "daily_habits",
    supabase.from("daily_habits").insert(
      data.dailyHabits.map((entry) => ({
        user_id: userId,
        habit_id: habitIds.get(entry.habitKey)!,
        date: addDaysIso(today, entry.dateOffset),
        steps: entry.steps,
        steps_complete: entry.stepsComplete,
      })),
    ),
  );

  await runWrite(
    "days",
    supabase.from("days").insert(
      data.days.map((day) => ({
        user_id: userId,
        date: addDaysIso(today, day.dateOffset),
        notes: day.notes,
        prompts: day.prompts,
      })),
    ),
  );

  // The signup trigger creates a preferences row, but upsert keeps the reset
  // idempotent even if that row is ever missing. Unset columns keep their DB
  // defaults on insert.
  await runWrite(
    "preferences",
    supabase.from("preferences").upsert({
      user_id: userId,
      light_theme: data.preferences.lightTheme,
      dark_theme: data.preferences.darkTheme,
      theme_mode: data.preferences.themeMode,
      enable_notes: data.preferences.enableNotes,
      enable_journal: data.preferences.enableJournal,
      enable_habits: data.preferences.enableHabits,
      template_prompts: data.preferences.templatePrompts,
    }, { onConflict: "user_id" }),
  );
}

async function main(): Promise<void> {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const demoEmail = requireEnv("DEMO_EMAIL");
  const demoPassword = requireEnv("DEMO_PASSWORD");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await findOrCreateDemoUser(supabase, demoEmail, demoPassword);
  await wipeUserData(supabase, userId);
  await seed(supabase, userId, buildDemoData());

  console.log(`Demo account reset complete for ${demoEmail}.`);
}

if (import.meta.main) {
  await main();
}
