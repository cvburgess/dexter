import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderAddButton } from "@/components/HeaderAddButton";
import { ListRow } from "@/components/ListRow";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

export default function ListsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const [lists] = useLists();
  const [tasks] = useTasks();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsMultiPane();

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
      edges={twoPane ? ["bottom", "right"] : ["bottom", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing, gap: theme.spacing },
        ]}
      >
        <View style={styles.section}>
          <SettingsSectionTitle>Lists</SettingsSectionTitle>
          {lists.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
              Tap ＋ to create your first list.
            </Text>
          ) : (
            <View style={{ gap: theme.gap }}>
              {lists.map((list) => (
                <View
                  key={list.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.colors.card,
                      borderRadius: theme.borderRadius,
                    },
                  ]}
                >
                  <ListRow
                    list={list}
                    openCount={openCounts.get(list.id) ?? 0}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
  },
  empty: {
    fontSize: 14,
    paddingVertical: 8,
  },
  section: {
    gap: 10,
  },
});
