import { useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { getGoals } from "@/api/goals";
import { getLists } from "@/api/lists";
import { LoadingScreen } from "@/components/LoadingScreen";
import { supabase, useAuth } from "@/hooks/useAuth";
import { createModalScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

const LISTS_GOALS_STALE_TIME_MS = 1000 * 60 * 10;

export default function AppLayout() {
  const { initializing, session } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Warms the lists/goals caches (`useLists`/`useGoals`'s query keys) as soon
  // as a session exists, so the Backlog drawer's Group menu never has to wait
  // on a cold fetch the first time "By List"/"By Goal" is picked.
  useEffect(() => {
    if (!session) return;

    void queryClient.prefetchQuery({
      queryKey: ["lists"],
      queryFn: () => getLists(supabase),
      staleTime: LISTS_GOALS_STALE_TIME_MS,
    });
    void queryClient.prefetchQuery({
      queryKey: ["goals"],
      queryFn: () => getGoals(supabase),
      staleTime: LISTS_GOALS_STALE_TIME_MS,
    });
  }, [session, queryClient]);

  if (initializing) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="new-task"
        options={createModalScreenOptions(theme, "New Task")}
      />
    </Stack>
  );
}
