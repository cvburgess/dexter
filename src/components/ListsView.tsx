import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { DraxScrollView } from "react-native-drax";
import { useAnimatedRef } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { DragScheduleProvider } from "@/components/DragScheduleProvider";
import { EmptyScreen } from "@/components/EmptyScreen";
import { GlassIconButton } from "@/components/GlassIconButton";
import { LargeScreenHeader } from "@/components/LargeScreenHeader";
import { ListColumn } from "@/components/ListColumn";
import { TaskDropTarget } from "@/components/TaskDropTarget";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";
import {
  DRAWER_PANE_MAX_WIDTH,
  WEEK_COLUMN_MIN_WIDTH,
} from "@/utils/breakpoints";
import { listColumns } from "@/utils/listColumns";
import { useTheme } from "@/utils/theme";

const NEW_LIST = {
  pathname: "/settings/lists/[id]",
  params: { id: "new" },
} as const;

// The Lists tab's large-screen layout (DEX-221): a column per list, and
// dragging a card between columns reassigns its list.
export function ListsView() {
  const theme = useTheme();
  const router = useRouter();
  const [tasks] = useTasks();
  const [lists, { isLoading }] = useLists();
  const columns = useMemo(() => listColumns(tasks, lists), [tasks, lists]);

  // Animated so a pressed card can pause it from the UI thread (DEX-207).
  const scrollRef = useAnimatedRef<ScrollView>();
  const openNewList = () => router.push(NEW_LIST);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <LargeScreenHeader
        actions={
          <GlassIconButton
            accessibilityLabel="New list"
            ionicon="add"
            onPress={openNewList}
            sfSymbol="plus"
          />
        }
      >
        <Text
          accessibilityRole="header"
          style={[theme.fonts.title, { color: theme.colors.text }]}
        >
          Lists
        </Text>
      </LargeScreenHeader>
      {lists.length === 0 ? (
        !isLoading && (
          <EmptyScreen message="Group related tasks into lists, then drag tasks between them here.">
            <Button onPress={openNewList} variant="primary">
              Create a list
            </Button>
          </EmptyScreen>
        )
      ) : (
        // Web's drag doesn't race the scroller, and `setNativeProps` is
        // native-only — as in WeekView.
        <DragScheduleProvider
          pauseScrollRef={Platform.OS === "web" ? undefined : scrollRef}
        >
          <View
            style={[
              styles.body,
              { paddingHorizontal: theme.space.md, paddingTop: theme.space.md },
            ]}
          >
            {/* DraxScrollView, not plain: drax corrects hit-test offsets by
                scroll position, and a plain ScrollView registers none. */}
            <DraxScrollView
              horizontal
              ref={scrollRef}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              style={styles.body}
              contentContainerStyle={[styles.row, { gap: theme.space.md }]}
            >
              {columns.map((column) => (
                // The whole column is the target, so an empty list accepts drops.
                <TaskDropTarget
                  key={column.listId ?? "none"}
                  listId={column.listId}
                  style={styles.column}
                  testID={`list-drop-${column.listId ?? "none"}`}
                >
                  <ListColumn column={column} />
                </TaskDropTarget>
              ))}
            </DraxScrollView>
          </View>
        </DragScheduleProvider>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  // Lets the columns divide the full width when they fit.
  row: {
    flexGrow: 1,
  },
  // Week's floor, then sideways scroll; unlike Week's fixed seven, two lists
  // would stretch a card across half the screen, hence the drawer-width cap.
  column: {
    flex: 1,
    maxWidth: DRAWER_PANE_MAX_WIDTH,
    minWidth: WEEK_COLUMN_MIN_WIDTH,
  },
});
