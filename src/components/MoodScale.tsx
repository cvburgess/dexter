import { Pressable, View } from "react-native";

import {
  MOOD_RATINGS,
  moodAccessibilityLabel,
  type TMoodRating,
} from "@/utils/mood";
import { useTheme, withOpacity } from "@/utils/theme";

import { MoodFace } from "./MoodFace";

// Five of these plus four `lg` gaps is 296pt — it still fits the 360dp Android
// floor once `SwipeablePage`'s gutter is taken off, where 44 would not.
const FACE_SIZE = 40;
// Only the answer is filled; other faces stay outlined at full text until
// picked, then fade — the fade itself becomes part of the answer.
const FADED_ALPHA = 0.5;

type TMoodScaleProps = {
  /** The day's saved score, or `null` when unanswered. */
  value: number | null;
  onChange: (rating: TMoodRating) => void;
};

// The 1-5 face row atop the journal. Selection is the only state — a tap
// saves immediately, since a discrete choice has nothing to debounce.
export function MoodScale({ value, onChange }: TMoodScaleProps) {
  const theme = useTheme();

  const unselected =
    value === null
      ? theme.colors.text
      : withOpacity(theme.colors.text, FADED_ALPHA);

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
              color={isSelected ? undefined : unselected}
              knockout={isSelected ? theme.colors.background : undefined}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
