import * as AppIntents from "expo-app-intents";
import type { AppIntentInvocation } from "expo-app-intents";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { useHabits } from "@/hooks/useHabits";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";
import { ETaskStatus, isCompletionStatus } from "@/utils/taskStatus";

// iOS App Intents bridge (DEX-235): publishes entity catalogs, applies
// `addTask`/`completeTask` invocations via the UI's hooks, clears on sign-out.

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

  // Gate completeTask until the tasks fetch settles: updateTask's recurring
  // spawn reads the cache snapshot, and a cold start would lose it (DEX-21).
  const tasksSettled = useRef(!tasksLoading && !tasksError);
  useEffect(() => {
    tasksSettled.current = !tasksLoading && !tasksError;
  }, [tasksError, tasksLoading]);

  // dataReady gate: publishing an empty catalog mid-load wipes the native
  // one, and the next same-data publish does not restore it.

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
    publishCatalogs();
  }, [dataReady, isSignedIn, publishCatalogs]);

  // Drop catalogs/donations on sign-out (Siri must not keep the departing
  // user's tasks); keep queued invocations — they wait for the sign-in.
  const hadSession = useRef(isSignedIn);
  const cleanedUpSignedOut = useRef(false);

  useEffect(() => {
    if (initializing) return;

    const sessionEnded = hadSession.current && !isSignedIn;
    hadSession.current = isSignedIn;

    if (isSignedIn) {
      cleanedUpSignedOut.current = false;
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
