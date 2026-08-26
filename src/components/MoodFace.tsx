import Svg, { Circle, Path } from "react-native-svg";

import {
  MOOD_FACE_VIEWBOX,
  moodMouthPath,
  type TMoodRating,
} from "@/utils/mood";

// Stroke-only, so one `color` carries both the selected and unselected state.
const STROKE = 6;
const EYE_RADIUS = 5;

type TMoodFaceProps = {
  rating: TMoodRating;
  size: number;
  color: string;
};

/**
 * One face of the 1-5 scale. Drawn rather than picked from SF Symbols/Ionicons:
 * neither set has a five-step ramp, and half-matching glyphs drift per platform.
 */
export function MoodFace({ rating, size, color }: TMoodFaceProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MOOD_FACE_VIEWBOX} ${MOOD_FACE_VIEWBOX}`}
    >
      <Circle
        cx={50}
        cy={50}
        r={50 - STROKE / 2}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Circle cx={34} cy={38} r={EYE_RADIUS} fill={color} />
      <Circle cx={66} cy={38} r={EYE_RADIUS} fill={color} />
      <Path
        d={moodMouthPath(rating)}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}
