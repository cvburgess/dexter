import { StyleSheet, View } from "react-native";

import { ColumnChip } from "@/components/ColumnChip";
import { TaskCardList } from "@/components/TaskCardList";
import { TListColumn } from "@/utils/listColumns";

// One list of the Lists tab (DEX-221): chip + that list's open tasks.
export function ListColumn({ column }: { column: TListColumn }) {
  const name = `${column.emoji} ${column.title}`;
  const count = column.tasks.length;
  const subtitle = `${count} ${count === 1 ? "task" : "tasks"}`;

  return (
    <View style={styles.container}>
      <ColumnChip
        accessibilityLabel={`${column.title}, ${subtitle}`}
        subtitle={subtitle}
        testID={`list-chip-${column.listId ?? "none"}`}
        title={name}
      />
      {/* No empty state, like Week: an empty column is self-evident. */}
      <TaskCardList emptyMessage={null} tasks={column.tasks} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Bounds TaskCardList's flex:1 ScrollView so a long list scrolls.
  container: {
    flex: 1,
  },
});
