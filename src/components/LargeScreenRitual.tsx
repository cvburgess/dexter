import { Temporal } from "@js-temporal/polyfill";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DayNav } from "@/components/DayNav";
import { GlassIconButton } from "@/components/GlassIconButton";
import { LargeScreenHeader } from "@/components/LargeScreenHeader";
import { RitualModeButton } from "@/components/RitualModeButton";
import type { TRitualState } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

type TLargeScreenRitualProps = {
  state: TRitualState;
  onChangeDate: (date: Temporal.PlainDate) => void;
  onToggleMode: () => void;
};

/**
 * The ritual on a large screen: a toolbar and, for now, nothing else (DEX-127).
 *
 * A guided one-thing-at-a-time flow doesn't want a whole desktop window, so
 * running it here means running the phone experience in a modal — the play
 * button is the entry point, and the body below stays empty until a later
 * DEX-34 sub-issue decides what a wide ritual looks like.
 *
 * `DayNav` sits flush at the gutter, matching the Week tab rather than Today:
 * Today centers its nav inside a slot capped to the Tasks pane so it labels
 * that column, and there is no column here to label.
 */
export function LargeScreenRitual({
  state,
  onChangeDate,
  onToggleMode,
}: TLargeScreenRitualProps) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <LargeScreenHeader
        actions={
          <>
            <GlassIconButton
              accessibilityLabel="Start ritual"
              ionicon="play"
              onPress={() =>
                // The modal opens on what the toolbar is showing, so pressing
                // play after paging to another day starts *that* day's ritual.
                router.push({
                  pathname: "/ritual-session",
                  params: { date: state.date.toString(), mode: state.mode },
                })
              }
              sfSymbol="play.fill"
            />
            <RitualModeButton mode={state.mode} onPress={onToggleMode} />
          </>
        }
      >
        <DayNav date={state.date} onChangeDate={onChangeDate} />
      </LargeScreenHeader>
      <View style={styles.body} testID="ritual-empty-body" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Deliberately empty (DEX-127). Kept as a real flex child rather than nothing
  // at all so the header stays pinned to the top of the screen.
  body: {
    flex: 1,
  },
});
