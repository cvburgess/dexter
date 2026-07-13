export type TNoteEditorProps = {
  /** Markdown seeded into the editor once, at mount. */
  initialValue: string;
  /** Fired with the full markdown string as the user edits (native only). */
  onChangeMarkdown: (markdown: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Fired when the editor gains/loses focus (native only). Lets the host
   * disable day-swipe while editing so it doesn't fight text gestures. */
  onFocusChange?: (focused: boolean) => void;
  testID?: string;
};
