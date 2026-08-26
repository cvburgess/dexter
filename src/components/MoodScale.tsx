import { Pressable, View } from "react-native";

import {
  MOOD_RATINGS,
  moodAccessibilityLabel,
  type TMoodRating,
} from "@/utils/mood";
import { useTheme } from "@/utils/theme";

import { MoodFace } from "./MoodFace";

// Five of these plus four `lg` gaps is 296pt — it still fits the 360dp Android
// floor once `SwipeablePage`'s gutter is taken off, where 44 would not.
const FACE_SIZE = 40;
// Unselected faces draw in `text` rather than a dimmed ramp color: at 40pt the
// ramp's yellows were the faintest thing on the page, and a faded row read as
// disabled. Color is the selection, so only the chosen face carries its own.

type TMoodScaleProps = {
  /** The day's saved score, or `null` when unanswered. */
  value: number | null;
  onChange: (rating: TMoodRating) => void;
};

/**
 * The 1-5 face row at the top of the journal. Selection is the only state — a
 * tap saves immediately, since a discrete choice has nothing to debounce.
 */
export function MoodScale({ value, onChange }: TMoodScaleProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="How was your day?"
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: theme.space.lg,
      }}
    >
      {MOOD_RATINGS.map((rating) => {
        const isSelected = value === rating;
        return (
          <Pressable
            key={rating}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={moodAccessibilityLabel(rating)}
            hitSlop={theme.space.sm}
            onPress={() => onChange(rating)}
            testID={`mood-face-${rating}`}
          >
            <MoodFace
              rating={rating}
              size={FACE_SIZE}
              color={isSelected ? undefined : theme.colors.text}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
