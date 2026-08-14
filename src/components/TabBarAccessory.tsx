import { FocusTimerAccessory } from "@/components/FocusTimerAccessory";
import { NewTaskButton } from "@/components/NewTaskButton";
import { useFocusTimer } from "@/hooks/useFocusTimer";

/**
 * What the iOS tab bar's bottom accessory draws: the running focus block if
 * there is one, and "＋ New Task" otherwise.
 *
 * The branch lives here rather than in `(tabs)/_layout.tsx` because
 * `NativeTabs.BottomAccessory` takes a single element — there is no second
 * accessory slot to add a timer to — and because keeping it in one small
 * component leaves the layout's tests able to stand this in the way they already
 * stand in `NewTaskButton`.
 *
 * It reads the module store rather than the query hooks: this element is
 * rendered twice at once, once per placement (see `useFocusTimer.tsx`).
 */
export function TabBarAccessory() {
  const { actions, block } = useFocusTimer();

  if (!block) return <NewTaskButton />;

  return <FocusTimerAccessory actions={actions} block={block} />;
}
