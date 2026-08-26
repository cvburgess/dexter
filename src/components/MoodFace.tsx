import Svg, { Circle, Path } from "react-native-svg";

import { MOOD_FACES, MOOD_FACE_VIEWBOX, type TMoodRating } from "@/utils/mood";

const STROKE = 6;
const CENTER = MOOD_FACE_VIEWBOX / 2;
// Features sit well inside the perimeter deliberately: the ring is the loudest
// thing at this size, and a crowded interior turns to mush at 40pt.
const EYE_RADIUS = 5;
const EYE_Y = 38;
const EYE_OFFSET = 14;

type TMoodFaceProps = {
  rating: TMoodRating;
  size: number;
  /** Overrides the ramp color — `MoodScale` passes `text` for an unselected face. */
  color?: string;
};

/**
 * One face of the 1-5 scale. Drawn rather than picked from SF Symbols/Ionicons:
 * neither set has a five-step ramp, and half-matching glyphs drift per platform.
 */
export function MoodFace({ rating, size, color }: TMoodFaceProps) {
  const face = MOOD_FACES[rating];
  const stroke = color ?? face.color;

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
        stroke={stroke}
        strokeWidth={STROKE}
      />
      {[CENTER - EYE_OFFSET, CENTER + EYE_OFFSET].map((cx) => (
        <Circle key={cx} cx={cx} cy={EYE_Y} r={EYE_RADIUS} fill={stroke} />
      ))}
      <Path
        d={face.mouth}
        fill={face.mouthFilled ? stroke : "none"}
        stroke={stroke}
        strokeWidth={face.mouthFilled ? 0 : STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}
