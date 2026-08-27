import { FocusTimerAccessory } from "@/components/FocusTimerAccessory";
import { NewTaskButton } from "@/components/NewTaskButton";
import { useFocusTimer } from "@/hooks/useFocusTimer";

// The bottom accessory: the running focus block if there is one, else "＋ New
// Task". Reads the module store, not query hooks — rendered twice at once.
export function TabBarAccessory() {
  const { actions, block } = useFocusTimer();

  if (!block) return <NewTaskButton />;

  return <FocusTimerAccessory actions={actions} block={block} />;
}
