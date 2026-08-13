import { StyleProp, Text, TextStyle } from "react-native";

import { TFocusBlock } from "@/api/focusBlocks";
import { useFocusCountdown } from "@/hooks/useFocusTimer";
import { formatCountdown } from "@/utils/focusBlocks";

/**
 * The remaining time on a focus block, ticking once a second.
 *
 * This is its own component so that **it is the only thing in the app that
 * re-renders every second**. The bar and accessory around it hold the task
 * title, the buttons, and their layout, none of which change between the four
 * or five times a block's row is actually written.
 */
export function FocusCountdown({
  block,
  style,
}: {
  block: TFocusBlock | null;
  style?: StyleProp<TextStyle>;
}) {
  const seconds = useFocusCountdown(block);

  return (
    <Text style={style} testID="focus-countdown">
      {formatCountdown(seconds)}
    </Text>
  );
}
