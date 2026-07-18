import { useTheme, withOpacity } from "@/utils/theme";

import { TTimeFieldProps } from "./TimeField.types";

/**
 * Web implementation of the time field. The community `DateTimePicker` renders
 * nothing on web (see `DateField.web`), so web uses the browser's native
 * `input[type="time"]`, themed to match the rest of the app. Its value is
 * already the `"HH:MM"` string the field speaks, so no conversion is needed.
 */
export function TimeField({ min, onChange, testID, value }: TTimeFieldProps) {
  const theme = useTheme();

  return (
    <input
      type="time"
      data-testid={testID}
      value={value}
      min={min}
      onChange={(event) => onChange(event.target.value)}
      style={{
        backgroundColor: theme.colors.card,
        border: `1px solid ${withOpacity(theme.colors.text, 0.15)}`,
        borderRadius: theme.borderRadius,
        color: theme.colors.text,
        colorScheme: "light dark",
        fontSize: 16,
        padding: "8px 10px",
      }}
    />
  );
}
