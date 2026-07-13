import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { JournalView } from "@/components/JournalView";
import { NotesView } from "@/components/NotesView";
import { useTheme } from "@/utils/theme";

type TTab = "notes" | "journal";

type TNotesJournalTabsProps = {
  /** ISO date (YYYY-MM-DD) of the day shown. */
  date: string;
  showNotes: boolean;
  showJournal: boolean;
};

/**
 * The large-screen Notes/Journal pane: both surfaces share one bordered
 * column (see today/index.tsx), switched via a small tab bar when both are
 * enabled — styled like manila folder tabs (rounded top corners, the active
 * tab's color merging into the card body below it), matching the legacy
 * desktop app. With only one enabled, its content fills the pane and no tab
 * bar renders. Calendar is a separate column so it always sits at the far
 * right regardless of this pane's state.
 */
export function NotesJournalTabs({
  date,
  showNotes,
  showJournal,
}: TNotesJournalTabsProps) {
  const theme = useTheme();
  const [tab, setTab] = useState<TTab>(showNotes ? "notes" : "journal");
  // Snap to whichever tab is still enabled if the active one gets toggled off.
  const activeTab: TTab =
    tab === "notes" && !showNotes
      ? "journal"
      : tab === "journal" && !showJournal
        ? "notes"
        : tab;
  const showTabBar = showNotes && showJournal;

  return (
    <View style={styles.container}>
      {showTabBar && <TabBar activeTab={activeTab} onChangeTab={setTab} />}
      <View style={[styles.content, { backgroundColor: theme.colors.card }]}>
        {activeTab === "notes" ? (
          <NotesView date={date} inset={false} />
        ) : (
          <JournalView date={date} />
        )}
      </View>
    </View>
  );
}

function TabBar({
  activeTab,
  onChangeTab,
}: {
  activeTab: TTab;
  onChangeTab: (tab: TTab) => void;
}) {
  return (
    <View style={styles.tabBar}>
      <TabButton
        activeTab={activeTab}
        label="Notes"
        onPress={onChangeTab}
        tab="notes"
      />
      <TabButton
        activeTab={activeTab}
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
  onPress,
}: {
  label: string;
  tab: TTab;
  activeTab: TTab;
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
        {
          backgroundColor: active ? theme.colors.card : "transparent",
          borderTopLeftRadius: theme.borderRadius,
          borderTopRightRadius: theme.borderRadius,
        },
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
  // The tab row sits on the page background; only the active tab's card
  // color "pops" above the content body, like a manila folder tab.
  tabBar: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 14,
  },
  // Matches the active tab's color so the two merge into one folder body.
  content: {
    flex: 1,
  },
});
