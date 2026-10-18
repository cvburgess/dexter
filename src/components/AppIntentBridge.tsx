import * as AppIntents from "expo-app-intents";
import type { AppIntentInvocation } from "expo-app-intents";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { useHabits } from "@/hooks/useHabits";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";
import { ETaskStatus, isCompletionStatus } from "@/utils/taskStatus";

// iOS App Intents bridge (DEX-235): publishes the entity catalogs Siri and
// Shortcuts resolve parameters against, applies the `addTask`/`completeTask`
// invocations through the same hooks the UI uses, and clears the resource on
// sign-out. Renders nothing. The native layer is iOS-only; every API here is
// a no-op on web/Android/Expo Go, so the component is safe to mount everywhere.

// Catalogs live in UserDefaults and the invocation queue caps at 100 entries,
// so Siri gets a bounded, id-plus-title view (issue note 5).
const TASK_CATALOG_LIMIT = 250;
const HABIT_CATALOG_LIMIT = 100;
const LIST_CATALOG_LIMIT = 100;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

type TMutationRunner = (callbacks: {
  onError: (error: Error) => void;
  onSuccess: () => void;
}) => void;

/** The UI mutations are `mutate`-shaped (void), so success/failure has to be
 * collected through their per-call callbacks before the invocation is removed. */
const runMutation = (run: TMutationRunner): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    run({ onError: reject, onSuccess: resolve });
  });

const warn = (message: string) => (error: unknown) => {
  console.warn(message, error);
};

export function AppIntentBridge() {
  const { session, initializing } = useAuth();
  const [
    tasks,
    { createTask, updateTask, isError: tasksError, isLoading: tasksLoading },
  ] = useTasks();
  const [habits, { isLoading: habitsLoading }] = useHabits();
  const [lists, { isLoading: listsLoading }] = useLists();

  const isSignedIn = !!session;

  // At-least-once delivery: the same id can arrive as the pending snapshot,
  // a live event, and our own re-drains (the sign-in gate below) — applied once.
  const handledIds = useRef(new Set<string>());

  // completeTask reuses the UI's updateTask, whose subtask sweep and recurring
  // spawn read the query cache snapshot. A cold start must not complete a
  // recurring task before that snapshot exists, or the next occurrence is lost
  // (DEX-21); the gate keeps such invocations queued until the fetch settles.
  const tasksSettled = useRef(!tasksLoading && !tasksError);
  useEffect(() => {
    tasksSettled.current = !tasksLoading && !tasksError;
  }, [tasksError, tasksLoading]);

  // Publish the catalogs no earlier than the data backing them has loaded —
  // an empty catalog published during that window would wipe the native one,
  // which the next same-data publish treats as unchanged and does not restore.
  const catalogPublished = useRef(false);

  const applyInvocation = useCallback(
    async (invocation: AppIntentInvocation) => {
      // No session: nothing to write with, and a write here could never land on
      // the right account. Leave the invocation queued — the sign-in drain
      // applies it once a session exists.
      if (!isSignedIn) return;

      if (handledIds.current.has(invocation.id)) return;
      handledIds.current.add(invocation.id);
      if (handledIds.current.size > 1000) handledIds.current.clear();

      // Applied ids are gone from the native queue, so this only unmarks the
      // ones a transient failure keeps queued for the next drain.
      const keepForRetry = () => {
        handledIds.current.delete(invocation.id);
      };

      try {
        if (invocation.name === "addTask") {
          const title = asString(invocation.params.title)?.trim();
          // An empty title cannot become a task; nothing would ever fix it.
          if (!title) {
            await AppIntents.removePendingInvocationAsync(invocation.id);
            return;
          }
          await runMutation((callbacks) =>
            createTask(
              {
                title,
                listId: asString(invocation.params.listId) ?? null,
                dueOn: asString(invocation.params.dueDate) ?? null,
              },
              callbacks,
            ),
          );
        } else if (invocation.name === "completeTask") {
          const taskId = asString(invocation.params.taskId);
          if (!taskId) {
            await AppIntents.removePendingInvocationAsync(invocation.id);
            return;
          }
          if (!tasksSettled.current) {
            keepForRetry();
            return;
          }
          await runMutation((callbacks) =>
            updateTask({ id: taskId, status: ETaskStatus.DONE }, callbacks),
          );
        } else {
          // An intent this build doesn't know can never be handled — drop it
          // rather than let the 100-entry queue fill with unhandleables.
          await AppIntents.removePendingInvocationAsync(invocation.id);
          return;
        }
        await AppIntents.removePendingInvocationAsync(invocation.id);
      } catch {
        // Offline or rejected: leave it queued — the next foreground, sign-in,
        // or launch drains it again.
        keepForRetry();
      }
    },
    [createTask, isSignedIn, updateTask],
  );

  // Delivery is at-least-once, so falling back to `getPendingInvocationsAsync`
  // is safe: unhandled invocations simply stay queued until a gate opens.
  AppIntents.useAppIntents((pendingIntents) => {
    for (const invocation of pendingIntents) void applyInvocation(invocation);
  });

  const drain = useCallback(async () => {
    if (!isSignedIn) return;
    const pending = await AppIntents.getPendingInvocationsAsync();
    for (const invocation of pending) await applyInvocation(invocation);
  }, [applyInvocation, isSignedIn]);

  const dataReady =
    !tasksLoading && !tasksError && !habitsLoading && !listsLoading;

  // Both the gate (tasks settled) and sign-in can open the queue between the
  // useAppIntents snapshot and a later launch, so re-read it each time either
  // flips, and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!isSignedIn || !dataReady) return;
    void drain();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void drain();
    });
    return () => subscription.remove();
  }, [dataReady, drain, isSignedIn]);

  const publishCatalogs = useCallback(() => {
    if (!isSignedIn) return;

    const listTitle = new Map(lists.map((list) => [list.id, list.title]));

    void AppIntents.setEntityCatalogAsync(
      "task",
      tasks
        .filter((task) => !isCompletionStatus(task.status))
        // Most recently scheduled first — the likeliest pick heads the list.
        .sort((a, b) =>
          (b.scheduledFor ?? "").localeCompare(a.scheduledFor ?? ""),
        )
        .slice(0, TASK_CATALOG_LIMIT)
        .map((task) => ({
          id: task.id,
          title: task.title,
          subtitle: task.listId ? listTitle.get(task.listId) : undefined,
        })),
    ).catch(warn("Could not publish the task catalog"));

    void AppIntents.setEntityCatalogAsync(
      "habit",
      habits
        .filter((habit) => !habit.isArchived && !habit.isPaused)
        .slice(0, HABIT_CATALOG_LIMIT)
        .map((habit) => ({
          id: habit.id,
          title: habit.title,
          subtitle: habit.emoji,
        })),
    ).catch(warn("Could not publish the habit catalog"));

    void AppIntents.setEntityCatalogAsync(
      "list",
      lists
        .filter((list) => !list.isArchived)
        .slice(0, LIST_CATALOG_LIMIT)
        .map((list) => ({
          id: list.id,
          title: list.title,
          subtitle: list.emoji,
        })),
    ).catch(warn("Could not publish the list catalog"));
  }, [habits, isSignedIn, lists, tasks]);

  useEffect(() => {
    // Wait for the first real load before touching the native catalogs; after
    // that, publish every time the data changes (or is refetched).
    if (!isSignedIn || !dataReady) return;
    catalogPublished.current = true;
    publishCatalogs();
  }, [dataReady, isSignedIn, publishCatalogs]);

  // Sign-out cleanup, once per signed-out stretch. The catalogs and donations
  // go as soon as the app observes a missing session (Siri must not keep
  // offering the departing user's tasks); the invocation queue only clears on
  // an actual sign-out — a signed-out cold start may hold an invocation that
  // just fired and is waiting for a sign-in, which must not be dropped.
  const hadSession = useRef(isSignedIn);
  const cleanedUpSignedOut = useRef(false);

  useEffect(() => {
    if (initializing) return;

    const sessionEnded = hadSession.current && !isSignedIn;
    hadSession.current = isSignedIn;

    if (isSignedIn) {
      cleanedUpSignedOut.current = false;
      catalogPublished.current = false;
      return;
    }
    if (cleanedUpSignedOut.current) return;
    cleanedUpSignedOut.current = true;

    void AppIntents.setEntityCatalogAsync("task", []).catch(
      warn("Could not clear the task catalog"),
    );
    void AppIntents.setEntityCatalogAsync("habit", []).catch(
      warn("Could not clear the habit catalog"),
    );
    void AppIntents.setEntityCatalogAsync("list", []).catch(
      warn("Could not clear the list catalog"),
    );
    void AppIntents.deleteDonationsAsync({ intent: "addTask" }).catch(
      warn("Could not clear add-task donations"),
    );
    void AppIntents.deleteDonationsAsync({ intent: "completeTask" }).catch(
      warn("Could not clear complete-task donations"),
    );
    if (sessionEnded) {
      void AppIntents.clearPendingInvocationsAsync().catch(
        warn("Could not clear pending App Intents invocations"),
      );
    }
  }, [initializing, isSignedIn]);

  return null;
}
