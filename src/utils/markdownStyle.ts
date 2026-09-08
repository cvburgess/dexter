import type {
  MarkdownStyle,
  MarkdownTextInputStyle,
  Md4cFlags,
} from "react-native-enriched-markdown";

import { Theme } from "@/utils/theme";

// Markdown prose is the only place in the app that needs a leading, so it is
// derived here rather than added to the type scale as a token.
const LEADING = 1.6;

/**
 * The editor emits one newline per Enter; CommonMark would collapse those to
 * spaces, reflowing every existing note into a single paragraph on web.
 */
export const NOTE_MD4C_FLAGS: Md4cFlags = { hardSoftBreaks: true };

/**
 * Six levels onto four type roles — no token is added for a level a note will
 * almost never use. `block` holds margins only the renderer's type accepts.
 */
const headings = (
  { colors, fonts }: Theme,
  block?: { marginTop: number; marginBottom: number },
) => ({
  h1: { ...fonts.heading, color: colors.text, ...block },
  h2: { ...fonts.heading, color: colors.text, ...block },
  h3: { ...fonts.title, color: colors.text, ...block },
  h4: { ...fonts.title, color: colors.text, ...block },
  h5: {
    ...fonts.body,
    fontWeight: fonts.title.fontWeight,
    color: colors.textSecondary,
    ...block,
  },
  h6: {
    ...fonts.body,
    fontWeight: fonts.title.fontWeight,
    color: colors.textSecondary,
    ...block,
  },
});

/** Styles for the read-only renderer (`EnrichedMarkdownText`). */
export function markdownStyle(theme: Theme): MarkdownStyle {
  const { colors, fonts, icons, radii, space } = theme;
  const lineHeight = Math.round(fonts.body.fontSize * LEADING);

  return {
    ...headings(theme, { marginTop: space.lg, marginBottom: space.sm }),
    paragraph: {
      ...fonts.body,
      color: colors.text,
      lineHeight,
      marginTop: 0,
      marginBottom: space.md,
    },
    blockquote: {
      color: colors.textSecondary,
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.primary,
      borderWidth: 3,
      borderRadius: radii.md,
      gapWidth: space.sm,
      padding: space.sm,
      marginTop: 0,
      marginBottom: space.md,
    },
    list: {
      ...fonts.body,
      color: colors.text,
      lineHeight,
      bulletColor: colors.textSecondary,
      markerColor: colors.textSecondary,
      gapWidth: space.sm,
      marginLeft: space.md,
      itemSpacing: space.xs,
      marginTop: 0,
      marginBottom: space.md,
    },
    // `syntaxColors` is left unset: no theme color means "keyword" or "string",
    // so highlighting falls back to the library's palette (DEX follow-up).
    codeBlock: {
      color: colors.text,
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: space.sm,
      marginTop: 0,
      marginBottom: space.md,
    },
    code: {
      color: colors.text,
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
    },
    link: { color: colors.primary, underline: true },
    strong: { color: colors.text },
    em: { color: colors.text },
    strikethrough: { color: colors.textSecondary },
    underline: { color: colors.text },
    spoiler: { color: colors.textSecondary },
    thematicBreak: {
      color: colors.border,
      height: 1,
      marginTop: space.md,
      marginBottom: space.md,
    },
    image: { borderRadius: radii.md, marginTop: 0, marginBottom: space.md },
    table: {
      ...fonts.body,
      color: colors.text,
      headerBackgroundColor: colors.surfaceSunken,
      headerTextColor: colors.text,
      rowEvenBackgroundColor: colors.background,
      rowOddBackgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      cellPaddingHorizontal: space.sm,
      cellPaddingVertical: space.xs,
      marginTop: 0,
      marginBottom: space.md,
    },
    taskList: {
      checkedColor: colors.primary,
      checkmarkColor: colors.primaryContent,
      checkedTextColor: colors.textSecondary,
      checkedStrikethrough: true,
      borderColor: colors.border,
      checkboxSize: icons.sm,
      checkboxBorderRadius: space.xs,
    },
    math: {
      ...fonts.body,
      color: colors.text,
      marginTop: 0,
      marginBottom: space.md,
    },
    inlineMath: { color: colors.text },
  };
}

/**
 * Styles for the editor. A much smaller type than `MarkdownStyle` — the input
 * has no key for blockquotes, code or paragraphs, so those keep library defaults.
 */
export function markdownInputStyle(theme: Theme): MarkdownTextInputStyle {
  const { colors, space } = theme;

  return {
    ...headings(theme),
    link: { color: colors.primary, underline: true },
    strong: { color: colors.text },
    em: { color: colors.text },
    spoiler: { color: colors.textSecondary },
    list: { itemSpacing: space.xs },
  };
}
