export type TTimeFieldProps = {
  /** Time-of-day as a `"HH:MM"` string. */
  value: string;
  /** Called with the new `"HH:MM"` string. */
  onChange: (value: string) => void;
  /** Earliest selectable time-of-day (`"HH:MM"`); earlier times are disabled. */
  min?: string;
  accentColor?: string;
  testID?: string;
};
