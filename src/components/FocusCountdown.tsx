import { StyleProp, Text, TextStyle } from "react-native";

import { TFocusBlock } from "@/api/focusBlocks";
import { useFocusCountdown } from "@/hooks/useFocusTimer";
import { formatCountdown } from "@/utils/focusBlocks";

/** Ticks once a second — its own component so it's the only thing in the app
 * re-rendering that often; the bar/accessory around it barely ever change. */
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
