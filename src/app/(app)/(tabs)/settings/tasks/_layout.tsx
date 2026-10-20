import { WebModalStack } from "@/components/WebModalStack";
import { createModalScreenOptions } from "@/utils/stackOptions";
import { useTheme } from "@/utils/theme";

// Anchored on index so tasks/[id] always mounts over a real list, not an
// empty pane (a call-site push doesn't survive a cold navigation coalesce).
export const unstable_settings = { anchor: "index" };

export default function TasksSettingsLayout() {
  const theme = useTheme();

  return (
    <WebModalStack>
      {/* Header hidden; only the transition background matters here. */}
      <WebModalStack.Screen
        name="index"
        options={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
      <WebModalStack.Screen
        name="[id]"
        options={createModalScreenOptions(theme, "Repeat Schedule")}
      />
    </WebModalStack>
  );
}
