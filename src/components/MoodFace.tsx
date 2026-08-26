import Svg, { Circle, Path } from "react-native-svg";

import { MOOD_FACES, MOOD_FACE_VIEWBOX, type TMoodRating } from "@/utils/mood";

const STROKE = 6;
const CENTER = MOOD_FACE_VIEWBOX / 2;
// Features sit well inside the perimeter deliberately: the ring is the loudest
// thing at this size, and a crowded interior turns to mush at 40pt.
const EYE_RADIUS = 5;
const EYE_Y = 38;
const EYE_OFFSET = 14;
// Half a chevron of the squeezed eyes, measured from the dot they replace.
const EYE_ARM = 6;

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
      {[CENTER - EYE_OFFSET, CENTER + EYE_OFFSET].map((cx, index) =>
        face.eyes === "squeeze" ? (
          <SqueezeEye
            key={cx}
            cx={cx}
            pointsRight={index === 0}
            color={stroke}
          />
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

/** A `>` or `<` chevron: both eyes point inward, so the pair reads as `> <`. */
function SqueezeEye({
  cx,
  pointsRight,
  color,
}: {
  cx: number;
  pointsRight: boolean;
  color: string;
}) {
  const tip = pointsRight ? cx + EYE_ARM : cx - EYE_ARM;
  const tail = pointsRight ? cx - EYE_ARM : cx + EYE_ARM;

  return (
    <Path
      d={`M ${tail} ${EYE_Y - EYE_ARM} L ${tip} ${EYE_Y} L ${tail} ${EYE_Y + EYE_ARM}`}
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
