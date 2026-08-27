import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-screens/experimental";

import { TSearchResult } from "@/api/search";
import { duplicateTaskInput } from "@/api/tasks";
import { EmptyScreen } from "@/components/EmptyScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SearchField } from "@/components/SearchField";
import { SearchResultCard } from "@/components/SearchResultCard";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { TaskCard } from "@/components/TaskCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePreferences } from "@/hooks/usePreferences";
import { MIN_SEARCH_LENGTH, useSearch } from "@/hooks/useSearch";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { canOpenSearchResult, searchResultRoute } from "@/utils/searchRoute";
import { useTheme } from "@/utils/theme";

// Headers and results flattened into one recyclable list (TaskDrawer's
// approach); `getItemType` splits the row shapes into separate recycle pools.
type TSearchListItem =
  | { type: "header"; id: string; title: string }
  | { type: "result"; id: string; result: TSearchResult };

const SECTIONS: { kind: TSearchResult["kind"]; title: string }[] = [
  { kind: "task", title: "Tasks" },
  { kind: "note", title: "Notes" },
  { kind: "journal", title: "Journal" },
];

// Every search full-scans the account's corpus, so this is about round trips:
// long enough to collapse a typing burst, short enough to feel immediate.
const SEARCH_DEBOUNCE_MS = 250;

// Record form: this is react-native-screens' SafeAreaView, not the context's.
// No `bottom` — the tab bar owns it; the list reserves that inset (DEX-91).
const SCREEN_EDGES = { top: true, left: true, right: true } as const;

// The Search tab (DEX-47). Results group by kind rather than interleave:
// substring matching yields no relevance score that could justify one order.
export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  // The field renders `query` so typing stays immediate; the search runs on
  // the settled value — "eisenhower" is one round trip rather than nine.
  const searchedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // The query the rows on screen actually matched; highlighting with the newer
  // in-flight one would blank every excerpt until results caught up.
  const [results, { isLoading, enabled, matchedQuery }] =
    useSearch(searchedQuery);
  // Mutations only: subscribing to the canonical ["tasks"] query would
  // re-render the long-lived Search tab on every task change made anywhere.
  const [, { updateTask, createTask, deleteTask }] = useTasks({
    skipQuery: true,
  });
  const [, { deleteTemplate }] = useTemplates({ skipQuery: true });
  // Only for where a result opens: with the journal disabled its entries are
  // still searchable but have no ritual step to land on (DEX-105).
  const [preferences] = usePreferences();
  const routeOptions = useMemo(
    () => ({
      enableJournal: preferences.enableJournal,
      // Which ritual a journal hit opens in, and whether it opens at all: since
      // DEX-151 a ritual only has a Journal step if it has prompts of its own.
      templatePrompts: preferences.templatePrompts,
    }),
    [preferences.enableJournal, preferences.templatePrompts],
  );

  // Off the *field*, not `enabled` (debounced): keying the idle prompt off
  // `enabled` told a user who had just typed that they hadn't typed anything.
  const willSearch = query.trim().length >= MIN_SEARCH_LENGTH;

  const listItems = useMemo<TSearchListItem[]>(
    () =>
      SECTIONS.flatMap(({ kind, title }) => {
        const section = results.filter((result) => result.kind === kind);
        if (section.length === 0) return [];

        return [
          { type: "header" as const, id: `header-${kind}`, title },
          ...section.map((result, index) => ({
            type: "result" as const,
            // Notes/journals have no id (keyed by user+date), and one journal
            // day yields a row per matching prompt — position disambiguates.
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

  // Nonce per navigation — a second tap on the same result would otherwise
  // do nothing; a counter, not a timestamp, keeps the link deterministic.
  const navigationCount = useRef(0);

  const openResult = useCallback(
    (result: TSearchResult) => {
      navigationCount.current += 1;
      const route = searchResultRoute(
        result,
        matchedQuery,
        String(navigationCount.current),
        routeOptions,
      );
      // Null for a result with nowhere to open — those render without an
      // `onPress` below, so this is belt and braces.
      if (route) router.push(route);
    },
    [router, matchedQuery, routeOptions],
  );

  const renderItem = useCallback(
    ({ item }: { item: TSearchListItem }) => {
      if (item.type === "header") {
        // The same component the settings screens use: this screen carried a
        // second, near-identical copy of its style (DEX-61).
        return <SettingsSectionTitle>{item.title}</SettingsSectionTitle>;
      }

      const { result } = item;

      if (result.kind === "task") {
        const { task } = result;
        return (
          <TaskCard
            // FlashList recycles React keys (`keyExtractor` only sets its own
            // stableId) — without this key, card state survives the swap.
            key={task.id}
            task={task}
            // Title becomes a link (status button and menus keep working);
            // omitted when there's nowhere to go, so it can't open an empty drawer.
            onPress={
              canOpenSearchResult(result, routeOptions)
                ? () => openResult(result)
                : undefined
            }
            onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
            onDuplicate={() => createTask(duplicateTaskInput(task))}
            onPromoteSubtask={(promoted) => createTask(promoted)}
            onDelete={() => {
              // The task→template FK is ON DELETE SET NULL, so the schedule
              // must go too or it keeps spawning occurrences (DEX-21).
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
          // Omitted for a journal entry the ritual has no step for; the card
          // stays readable, it just isn't a link (see `canOpenSearchResult`).
          onPress={
            canOpenSearchResult(result, routeOptions)
              ? () => openResult(result)
              : undefined
          }
        />
      );
    },
    [
      matchedQuery,
      openResult,
      routeOptions,
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
    () => <View style={{ height: theme.space.sm }} />,
    [theme.space.sm],
  );

  // Empty states render *inside* the list, never in place of it (DEX-136):
  // UIKit resolves the tab's scroll view once at mount, on the idle state.
  const ListEmpty = useCallback(() => {
    if (!willSearch) {
      return <EmptyScreen message="Search your tasks, notes, and journal." />;
    }
    // `!enabled` covers the debounce window; otherwise only a cold query shows
    // this — `keepPreviousData` keeps prior results on screen while resolving.
    if (isLoading || !enabled) return <LoadingScreen />;
    return <EmptyScreen message="No matches." />;
  }, [willSearch, isLoading, enabled]);

  // Bottom inset lives in list content (frame padding cuts the last row,
  // DEX-91); an empty list skips it since its filler states reserve it too.
  const listContentStyle = useMemo(
    () =>
      listItems.length === 0
        ? styles.emptyContent
        : { paddingBottom: insets.bottom + theme.space.md },
    [listItems.length, insets.bottom, theme.space.md],
  );

  return (
    // react-native-screens' SafeAreaView, not the context's — the context's top
    // inset misses the translucent header bar (DEX-107; docs/features.md).
    <SafeAreaView
      edges={SCREEN_EDGES}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          gap: theme.space.md,
          padding: theme.space.md,
        },
      ]}
    >
      {/* Native renders into the navigation header and returns null here (no
          layout); web renders a themed in-body field. See SearchField.tsx. */}
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search tasks, notes, and journal"
      />
      <FlashList
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={ListEmpty}
        testID="search-results"
        // A result is one tap away while the keyboard is up, rather than the
        // first tap only dismissing it.
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={listContentStyle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Lets the idle/loading/no-matches state fill the viewport so it centres in
  // it, which a content container sized to its (empty) content would not.
  emptyContent: {
    flexGrow: 1,
  },
  // Fills the space below the field; FlashList owns its own scrolling.
  list: {
    flex: 1,
  },
});
