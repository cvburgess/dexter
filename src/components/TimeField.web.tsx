import { useTheme } from "@/utils/theme";

import { TTimeFieldProps } from "./TimeField.types";

// The community DateTimePicker renders nothing on web (see DateField.web), so
// this uses the browser's native input[type="time"], themed to match.
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
        backgroundColor: theme.colors.surfaceSunken,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii.md,
        color: theme.colors.text,
        colorScheme: "light dark",
        fontSize: theme.fonts.control.fontSize,
        padding: `${theme.space.sm}px ${theme.space.sm}px`,
      }}
    />
  );
}
