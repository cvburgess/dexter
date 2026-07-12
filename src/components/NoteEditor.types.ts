export type TNoteEditorProps = {
  /** Markdown seeded into the editor once, at mount. */
  initialValue: string;
  /** Fired with the full markdown string as the user edits (native only). */
  onChangeMarkdown: (markdown: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  testID?: string;
};
