// Re-exports the native variant so tsc (no platform-extension resolution)
// can resolve this import; the bundler always picks a real platform file.
export * from "./NoteEditor.types";
export { NoteEditor } from "./NoteEditor.native";
