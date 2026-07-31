import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { HeaderAddButton } from "@/components/HeaderAddButton";
import { ListRow } from "@/components/ListRow";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { isCompletionStatus } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

export default function ListsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const [lists] = useLists();
  const [tasks] = useTasks();
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
            // `lg` between sections, `sm` within one (`styles.section`): the
            // groups had been separated by the same step that separated a
            // title from its own content, so nothing read as grouped (DEX-61).
            gap: theme.space.lg,
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
                      backgroundColor: theme.colors.card,
                      borderRadius: theme.radii.md,
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
  },
});
