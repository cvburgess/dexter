import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { JournalView } from "@/components/JournalView";
import { NotesView } from "@/components/NotesView";
import { useTheme, withOpacity } from "@/utils/theme";

export type TTab = "notes" | "journal";

type TNotesJournalTabsProps = {
  /** ISO date (YYYY-MM-DD) of the day shown. */
  date: string;
  showNotes: boolean;
  showJournal: boolean;
  /**
   * Selects a tab from outside, for a `?mode=notes|journal` deep link from the
   * Search tab (DEX-47). Null when the route asked for neither, which leaves
   * whichever tab the user last picked alone.
   */
  requestedTab?: TTab | null;
};

/**
 * The large-screen Notes/Journal pane: both surfaces share one bordered body
 * (see today/index.tsx, which gives this pane no border of its own; no fill
 * color either — a solid card tint here reads as distracting next to the
 * other borderless/lightly-bordered panes), switched via a small tab bar when
 * both are enabled — styled like manila folder tabs: only the active tab
 * carries a border (top + sides, no bottom), overlapping the body's own top
 * border so the two merge into one shape, matching the legacy desktop app.
 * With only one enabled, its content fills the pane and no tab bar renders.
 * Calendar is a separate column so it always sits at the far right
 * regardless of this pane's state.
 */
export function NotesJournalTabs({
  date,
  showNotes,
  showJournal,
  requestedTab = null,
}: TNotesJournalTabsProps) {
  const theme = useTheme();
  // Seeded from the route so a deep link is right on the first render — the
  // `appliedTab` adjustment below only fires on a *change*, so arriving with
  // `requestedTab` set would otherwise land on the default tab.
  const [tab, setTab] = useState<TTab>(
    requestedTab ?? (showNotes ? "notes" : "journal"),
  );

  // Follow the route when it names a tab. Adjusted during render (React's
  // supported pattern for deriving state from a changed prop — the same one the
  // `activeTab` fallback below uses) so the pane never shows the wrong tab for a
  // frame. `appliedTab` makes it fire once per change, so the user can switch
  // tabs afterwards without this snapping them back; re-opening the *same* deep
  // link is therefore a no-op, which is fine — the tab is already right.
  const [appliedTab, setAppliedTab] = useState(requestedTab);
  if (requestedTab !== appliedTab) {
    setAppliedTab(requestedTab);
    if (requestedTab) setTab(requestedTab);
  }
  // Snap to whichever tab is still enabled if the active one gets toggled off.
  let activeTab = tab;
  if (tab === "notes" && !showNotes) activeTab = "journal";
  else if (tab === "journal" && !showJournal) activeTab = "notes";
  const showTabBar = showNotes && showJournal;
  const borderColor = withOpacity(theme.colors.text, 0.1);

  return (
    <View style={styles.container}>
      {showTabBar && (
        <TabBar
          activeTab={activeTab}
          borderColor={borderColor}
          onChangeTab={setTab}
        />
      )}
      <View
        style={[
          styles.content,
          { borderColor, borderRadius: theme.borderRadius },
        ]}
      >
        {/* Keyed on date: NotesView/JournalView seed their editors
            uncontrolled and rely on a remount to re-seed for a new day (see
            their own comments). Keying only these — not the whole component —
            re-seeds the editor on a day change without also resetting which
            tab is selected. */}
        {activeTab === "notes" ? (
          <NotesView date={date} inset={false} key={date} />
        ) : (
          <JournalView date={date} key={date} />
        )}
      </View>
    </View>
  );
}

function TabBar({
  activeTab,
  borderColor,
  onChangeTab,
}: {
  activeTab: TTab;
  borderColor: string;
  onChangeTab: (tab: TTab) => void;
}) {
  return (
    <View style={styles.tabBar}>
      <TabButton
        activeTab={activeTab}
        borderColor={borderColor}
        label="Notes"
        onPress={onChangeTab}
        tab="notes"
      />
      <TabButton
        activeTab={activeTab}
        borderColor={borderColor}
        label="Journal"
        onPress={onChangeTab}
        tab="journal"
      />
    </View>
  );
}

function TabButton({
  label,
  tab,
  activeTab,
  borderColor,
  onPress,
}: {
  label: string;
  tab: TTab;
  activeTab: TTab;
  borderColor: string;
  onPress: (tab: TTab) => void;
}) {
  const theme = useTheme();
  const active = tab === activeTab;

  return (
    <TouchableOpacity
      accessibilityLabel={`${label} tab`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => onPress(tab)}
      style={[
        styles.tab,
        active && [
          styles.activeTab,
          {
            borderColor,
            borderTopLeftRadius: theme.borderRadius,
            borderTopRightRadius: theme.borderRadius,
          },
        ],
      ]}
    >
      <Text
        style={[
          styles.tabLabel,
          {
            color: active ? theme.colors.text : theme.colors.textSecondary,
            fontWeight: active ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  // Border on top + sides only, pulled down by a hairline to overlap (and so
  // visually merge with) the content body's own top border below it.
  activeTab: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabLabel: {
    fontSize: 14,
  },
  content: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden",
  },
});
