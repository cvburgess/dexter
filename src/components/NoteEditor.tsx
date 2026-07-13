// Platform-specific implementations live in NoteEditor.{native,web}.tsx and the
// bundler selects one per platform. This base file exists so TypeScript (which
// does not resolve platform extensions) can resolve `@/components/NoteEditor`;
// at runtime a platform variant is always bundled instead. It falls back to the
// native implementation.
export * from "./NoteEditor.types";
export { NoteEditor } from "./NoteEditor.native";
