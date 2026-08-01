import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { TList } from "@/api/lists";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { HeaderAddButton } from "@/components/HeaderAddButton";
import { ListRow } from "@/components/ListRow";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { showSaveError } from "@/utils/showSaveError";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

export default function ListsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const [lists, { updateList }] = useLists();
  const [tasks] = useTasks();
  const { confirm, confirmationProps } = useConfirmation();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

  // Open (TODO/in-progress) task counts per list, derived from the canonical
  // task cache. Completed tasks aren't counted — the cache only holds the
  // recent completed window, so a "# complete" total would undercount history.
  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.listId && !isCompletionStatus(task.status)) {
        counts.set(task.listId, (counts.get(task.listId) ?? 0) + 1);
      }
    }
    return counts;
  }, [tasks]);

  // Same prompt and copy as the edit modal's Archive action
  // (`settings/lists/[id].tsx`), since it is the same write from a second
  // place: the row disappears from every screen and there is no unarchive
  // anywhere in the app, so this asks first even though the pause toggle it
  // sits beside does not.
  const archiveList = async (list: TList) => {
    const confirmed = await confirm({
      title: `Archive ${list.title}?`,
      message:
        "Archiving hides this list and cancels any of its open tasks. This can't be undone from here.",
      confirmLabel: "Archive",
      destructive: true,
    });
    if (!confirmed) return;
    updateList(
      { id: list.id, isArchived: true },
      { onError: () => showSaveError("list") },
    );
  };

  // A "+" in the header opens the create modal (mirrors Habits). Re-wired on
  // every render so the push handler stays current.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderAddButton
          accessibilityLabel="New list"
          onPress={() =>
            router.push({
              pathname: "/settings/lists/[id]",
              params: { id: "new" },
            })
          }
          testID="new-list-button"
        />
      ),
    });
  });

  return (
    <SafeAreaView
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        // The edges above omit `bottom` so content scrolls under the
        // translucent tab bar; adding the inset to the content's own bottom
        // padding is what lets the last row clear it (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            // The in-group step only: `SettingsSectionTitle` carries the `lg`
            // between sections itself, so it applies wherever it renders (DEX-61).
            gap: theme.space.sm,
          },
        ]}
      >
        <View style={{ gap: theme.space.sm }}>
          <SettingsSectionTitle>Lists</SettingsSectionTitle>
          {lists.length === 0 ? (
            <Text
              style={[
                theme.fonts.body,
                { paddingVertical: theme.space.sm },
                { color: theme.colors.textSecondary },
              ]}
            >
              Tap ＋ to create your first list.
            </Text>
          ) : (
            <View style={{ gap: theme.space.sm }}>
              {lists.map((list) => (
                <View
                  key={list.id}
                  style={[
                    styles.card,
                    { paddingHorizontal: theme.space.md },
                    {
                      backgroundColor: theme.colors.surfaceSunken,
                      borderRadius: theme.radii.md,
                    },
                  ]}
                >
                  <ListRow
                    list={list}
                    openCount={openCounts.get(list.id) ?? 0}
                    onArchive={() => archiveList(list)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* One modal for the whole screen: `archiveList` awaits it, and every
          row's button routes through that. */}
      <ConfirmationModal {...confirmationProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  card: {
    overflow: "hidden",
  },
});
