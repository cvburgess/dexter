import RNEmojiKeyboard from "rn-emoji-keyboard";

import { useTheme } from "@/utils/theme";

type TEmojiPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
};

/**
 * A themed emoji picker sheet. Wraps `rn-emoji-keyboard` — a pure-JS React
 * Native component (no native module, so no dev-client rebuild) that renders on
 * iOS, Android, and web. The parent owns the open/closed state.
 */
export function EmojiPicker({ open, onClose, onSelect }: TEmojiPickerProps) {
  const theme = useTheme();

  return (
    <RNEmojiKeyboard
      open={open}
      onClose={onClose}
      onEmojiSelected={(emoji) => onSelect(emoji.emoji)}
      enableSearchBar
      theme={{
        backdrop: "#00000055",
        knob: theme.colors.primary,
        container: theme.colors.card,
        header: theme.colors.text,
        category: {
          icon: theme.colors.textSecondary,
          iconActive: theme.colors.primary,
          container: theme.colors.background,
          containerActive: theme.colors.card,
        },
        search: {
          text: theme.colors.text,
          placeholder: theme.colors.textSecondary,
          icon: theme.colors.textSecondary,
          background: theme.colors.background,
        },
      }}
    />
  );
}
