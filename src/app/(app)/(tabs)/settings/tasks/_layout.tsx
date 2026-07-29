import { Stack } from "expo-router";

import { createModalScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

/**
 * The editor is a detail view of the list, so the list is this stack's anchor:
 * arriving at `tasks/[id]` from anywhere — a task card's Repeat / Save as
 * template, or a hard refresh on the URL — mounts `tasks/index` beneath it.
 *
 * That has to be structural rather than a push at the call site. `[id]` is a
 * modal, and a modal renders over whatever sits below it: with the two screens
 * flat in the parent settings stack, entering from a task card left nothing
 * there, so on web the modal floated over an empty black pane with Tasks
 * unselected in the sidebar and no destination to close or save back to.
 * Pushing the list first only worked once the route had already been visited —
 * on a cold navigation both pushes coalesce before this navigator exists.
 * Callers pair this with `withAnchor: true` so the anchor comes along when the
 * navigation enters this stack for the first time.
 *
 * The list's header is **not** declared here — the parent settings stack owns
 * it (`settings/_layout.tsx`), because this screen is this stack's root and a
 * stack's root screen never gets a native back button (DEX-93).
 */
export const unstable_settings = { anchor: "index" };

export default function TasksSettingsLayout() {
  const theme = useTheme();

  return (
    <Stack>
      {/* No title or header styling: with the header hidden, the only option
          left that does anything is the background the screen transitions in
          over. The parent names this screen. */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
      <Stack.Screen
        name="[id]"
        options={createModalScreenOptions(theme, "Repeat Schedule")}
      />
    </Stack>
  );
}
