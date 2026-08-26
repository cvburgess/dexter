import { Pressable, View } from "react-native";

import {
  MOOD_RATINGS,
  moodAccessibilityLabel,
  type TMoodRating,
} from "@/utils/mood";
import { useTheme } from "@/utils/theme";

import { MoodFace } from "./MoodFace";

const FACE_SIZE = 36;
// Unselected faces recede without vanishing — five greyed-out circles read as
// disabled, and the row has to look answerable before it has been answered.
const UNSELECTED_OPACITY = 0.45;

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
        justifyContent: "space-between",
        gap: theme.space.sm,
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
            style={{ opacity: isSelected ? 1 : UNSELECTED_OPACITY }}
            testID={`mood-face-${rating}`}
          >
            <MoodFace
              rating={rating}
              size={FACE_SIZE}
              color={isSelected ? theme.colors.primary : theme.colors.text}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
