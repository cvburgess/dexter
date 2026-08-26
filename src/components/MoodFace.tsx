import Svg, { Circle, Line, Path } from "react-native-svg";

import { MOOD_FACES, MOOD_FACE_VIEWBOX, type TMoodRating } from "@/utils/mood";

const STROKE = 6;
const CENTER = MOOD_FACE_VIEWBOX / 2;
const EYE_RADIUS = 6;
const EYE_Y = 40;
const EYE_OFFSET = 15;
// Half an arm of the crossed eyes, measured from the dot they replace.
const CROSS_ARM = 7;

type TMoodFaceProps = {
  rating: TMoodRating;
  size: number;
  /** Overrides the ramp color — used to mute an unselected face. */
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
      {[CENTER - EYE_OFFSET, CENTER + EYE_OFFSET].map((cx) =>
        face.eyes === "cross" ? (
          <CrossEye key={cx} cx={cx} color={stroke} />
        ) : (
          <Circle key={cx} cx={cx} cy={EYE_Y} r={EYE_RADIUS} fill={stroke} />
        ),
      )}
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

function CrossEye({ cx, color }: { cx: number; color: string }) {
  return (
    <>
      <Line
        x1={cx - CROSS_ARM}
        y1={EYE_Y - CROSS_ARM}
        x2={cx + CROSS_ARM}
        y2={EYE_Y + CROSS_ARM}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Line
        x1={cx + CROSS_ARM}
        y1={EYE_Y - CROSS_ARM}
        x2={cx - CROSS_ARM}
        y2={EYE_Y + CROSS_ARM}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </>
  );
}
