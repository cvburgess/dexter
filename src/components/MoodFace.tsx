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
  /** Fills the disc and knocks features out in this color — pass what's
   * actually behind the glyph, since a wrong value shows as a halo, not a hole. */
  knockout?: string;
};

// One face of the 1-5 scale, drawn rather than picked from SF Symbols/Ionicons —
// neither set has a five-step ramp, and half-matching glyphs drift per platform.
export function MoodFace({ rating, size, color, knockout }: TMoodFaceProps) {
  const face = MOOD_FACES[rating];
  const disc = color ?? face.color;
  // Filled and outlined share an outer edge: the ring's stroke straddles r=47,
  // so it reaches the same 50 the solid disc does and the row never shifts.
  const ink = knockout ?? disc;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MOOD_FACE_VIEWBOX} ${MOOD_FACE_VIEWBOX}`}
    >
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={knockout ? CENTER : CENTER - STROKE / 2}
        fill={knockout ? disc : "none"}
        stroke={knockout ? "none" : disc}
        strokeWidth={STROKE}
      />
      {[CENTER - EYE_OFFSET, CENTER + EYE_OFFSET].map((cx) => (
        <Circle key={cx} cx={cx} cy={EYE_Y} r={EYE_RADIUS} fill={ink} />
      ))}
      <Path
        d={face.mouth}
        fill={face.mouthFilled ? ink : "none"}
        stroke={ink}
        strokeWidth={face.mouthFilled ? 0 : STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}
