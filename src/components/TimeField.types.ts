export type TTimeFieldProps = {
  /** Time-of-day as a `"HH:MM"` string. */
  value: string;
  /** Called with the new `"HH:MM"` string. */
  onChange: (value: string) => void;
  accentColor?: string;
  testID?: string;
};
