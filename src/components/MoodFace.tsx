import Svg, { Circle, Path } from "react-native-svg";

import {
  MOOD_FACE_VIEWBOX,
  moodMouthPath,
  type TMoodRating,
} from "@/utils/mood";

// Stroke-only, so one `color` carries both the selected and unselected state.
const STROKE = 6;
const EYE_RADIUS = 5;
// Derived, not another literal 50 — the mouth's own coordinates already assume
// this viewBox, and two places guessing it is how a face goes off-center.
const CENTER = MOOD_FACE_VIEWBOX / 2;
const EYE_Y = 38;
const EYE_OFFSET = 16;

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
        cx={CENTER}
        cy={CENTER}
        r={CENTER - STROKE / 2}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Circle cx={CENTER - EYE_OFFSET} cy={EYE_Y} r={EYE_RADIUS} fill={color} />
      <Circle cx={CENTER + EYE_OFFSET} cy={EYE_Y} r={EYE_RADIUS} fill={color} />
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
