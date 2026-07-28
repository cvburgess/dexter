import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { TSearchResult } from "@/api/search";
import { duplicateTaskInput } from "@/api/tasks";
import { EmptyScreen } from "@/components/EmptyScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SearchResultCard } from "@/components/SearchResultCard";
import { TaskCard } from "@/components/TaskCard";
import { TextInput } from "@/components/TextInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { MIN_SEARCH_LENGTH, useSearch } from "@/hooks/useSearch";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { searchResultRoute } from "@/utils/todayRoute";
import { useTheme } from "@/utils/theme";

// The flattened shape `FlashList` renders: section headers and results in one
// recyclable list, the same approach `TaskDrawer` uses. `getItemType` keys off
// the row's shape so headers and the two card kinds recycle into separate pools.
type TSearchListItem =
  | { type: "header"; id: string; title: string }
  | { type: "result"; id: string; result: TSearchResult };

const SECTIONS: { kind: TSearchResult["kind"]; title: string }[] = [
  { kind: "task", title: "Tasks" },
  { kind: "note", title: "Notes" },
  { kind: "journal", title: "Journal" },
];

/**
 * How long typing has to settle before the query runs. Every search is a full
 * scan of the account's tasks, notes, and journals, so this is about round
 * trips, not render cost — long enough to collapse a burst of typing, short
 * enough that pausing feels like it searched immediately.
 */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * The Search tab (DEX-47): one query across task titles (including subtask
 * titles), note content, and journal prompts/responses.
 *
 * Results are grouped by kind rather than interleaved. The three read very
 * differently — a task card beside a paragraph of note prose — and substring
 * matching produces no relevance score that could justify one order over
 * another, so grouping is the honest presentation.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  // The field renders `query` so typing stays immediate; the search runs on the
  // settled value, so typing "eisenhower" is one round trip rather than nine —
  // each of which is a full scan of the account's tasks, notes, and journals.
  const searchedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // `matchedQuery` is the query the rows on screen actually matched, which lags
  // `searchedQuery` while a newer search is in flight — highlighting with the
  // newer one would blank every excerpt until the results caught up.
  const [results, { isLoading, enabled, matchedQuery }] =
    useSearch(searchedQuery);
  // `skipQuery`: this screen wants the mutations, not the task list — its
  // results come from the server. Subscribing to the canonical `["tasks"]`
  // query would re-render the (long-lived) Search tab on every task change made
  // anywhere else in the app.
  const [, { updateTask, createTask, deleteTask }] = useTasks({
    skipQuery: true,
  });
  const [, { deleteTemplate }] = useTemplates({ skipQuery: true });

  const listItems = useMemo<TSearchListItem[]>(
    () =>
      SECTIONS.flatMap(({ kind, title }) => {
        const section = results.filter((result) => result.kind === kind);
        if (section.length === 0) return [];

        return [
          { type: "header" as const, id: `header-${kind}`, title },
          ...section.map((result, index) => ({
            type: "result" as const,
            // Notes and journals have no id — they're keyed by (user, date), and
            // one journal day yields a row per matching prompt, so the position
            // within the section is what disambiguates them.
            id:
              result.kind === "task"
                ? result.task.id
                : `${kind}-${result.date}-${index}`,
            result,
          })),
        ];
      }),
    [results],
  );

  // Separates one navigation from the next. Cross-tab navigation reuses the
  // mounted Today screen and only swaps its params, so without this a second tap
  // on the same result produces identical params and Today — having already
  // applied them — does nothing but switch tabs. A counter rather than a
  // timestamp so the link is deterministic in tests.
  const navigationCount = useRef(0);

  const openResult = useCallback(
    (result: TSearchResult) => {
      navigationCount.current += 1;
      router.push(
        searchResultRoute(
          result,
          matchedQuery,
          String(navigationCount.current),
        ),
      );
    },
    [router, matchedQuery],
  );

  const renderItem = useCallback(
    ({ item }: { item: TSearchListItem }) => {
      if (item.type === "header") {
        return (
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            {item.title}
          </Text>
        );
      }

      const { result } = item;

      if (result.kind === "task") {
        const { task } = result;
        return (
          <TaskCard
            // FlashList recycles a row by reusing its React key from a pool and
            // re-rendering with new props — it does not remount, and
            // `keyExtractor` only sets FlashList's own stableId. Without this
            // key, card state survives the swap (see TaskDrawer's copy of this).
            key={task.id}
            task={task}
            // The card's title becomes a link rather than a rename affordance;
            // its status button and menus keep working, so a result can still be
            // checked off without leaving Search.
            onPress={() => openResult(result)}
            onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
            onDuplicate={() => createTask(duplicateTaskInput(task))}
            onPromoteSubtask={(promoted) => createTask(promoted)}
            onDelete={() => {
              // The task→template FK is ON DELETE SET NULL, so a repeating
              // task's schedule has to be removed explicitly or it keeps
              // creating occurrences of a task the user just deleted (DEX-21,
              // same as TasksView).
              if (task.templateId) deleteTemplate(task.templateId);
              deleteTask(task.id);
            }}
          />
        );
      }

      return (
        <SearchResultCard
          date={result.date}
          prompt={result.kind === "journal" ? result.prompt : undefined}
          content={result.content}
          query={matchedQuery}
          onPress={() => openResult(result)}
        />
      );
    },
    [
      theme,
      matchedQuery,
      openResult,
      updateTask,
      createTask,
      deleteTask,
      deleteTemplate,
    ],
  );

  const keyExtractor = useCallback((item: TSearchListItem) => item.id, []);
  const getItemType = useCallback((item: TSearchListItem) => {
    if (item.type === "header") return "header";
    // A task card and an excerpt card are shaped nothing alike; recycling one as
    // the other would re-lay out every row it lands in.
    return item.result.kind === "task" ? "task" : "entry";
  }, []);
  const ItemSeparator = useCallback(
    () => <View style={{ height: theme.gap }} />,
    [theme.gap],
  );

  // The host SafeAreaView omits the bottom edge (the native tab bar owns it), so
  // the list reserves that inset in its own *content* — padding the frame would
  // end the viewport above the bar and cut the last row off at it, instead of
  // letting content scroll past underneath.
  const listContentStyle = useMemo(
    () => ({ paddingBottom: insets.bottom + theme.spacing }),
    [insets.bottom, theme.spacing],
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <TextInput
        accessibilityLabel="Search"
        placeholder="Search tasks, notes, and journal"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {!enabled ? (
        <EmptyScreen
          message={`Type at least ${MIN_SEARCH_LENGTH} characters to search your tasks, notes, and journal.`}
        />
      ) : isLoading ? (
        // Only on a cold query — `keepPreviousData` keeps the previous results
        // on screen while a subsequent search resolves.
        <LoadingScreen />
      ) : listItems.length === 0 ? (
        <EmptyScreen message="No matches." />
      ) : (
        <FlashList
          data={listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          ItemSeparatorComponent={ItemSeparator}
          // A result is one tap away while the keyboard is up, rather than the
          // first tap only dismissing it.
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={listContentStyle}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 16,
  },
  // Fills the space below the field; FlashList owns its own scrolling.
  list: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    paddingBottom: 4,
    textTransform: "uppercase",
  },
});
