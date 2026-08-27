import RNEmojiKeyboard from "rn-emoji-keyboard";

import { useTheme, withOpacity } from "@/utils/theme";

type TEmojiPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
};

/** Wraps `rn-emoji-keyboard` — pure JS, no dev-client rebuild needed. */
export function EmojiPicker({ open, onClose, onSelect }: TEmojiPickerProps) {
  const theme = useTheme();

  return (
    <RNEmojiKeyboard
      open={open}
      onClose={onClose}
      onEmojiSelected={(emoji) => onSelect(emoji.emoji)}
      enableSearchBar
      theme={{
        // Dimmed with the app's own background rather than a fixed black:
        // a black wash all but disappears over a dark theme (DEX-61).
        backdrop: withOpacity(theme.colors.background, 0.85),
        knob: theme.colors.primary,
        container: theme.colors.surfaceSunken,
        header: theme.colors.text,
        category: {
          icon: theme.colors.textSecondary,
          iconActive: theme.colors.primary,
          container: theme.colors.background,
          containerActive: theme.colors.surfaceSunken,
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
