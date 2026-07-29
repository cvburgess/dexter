// Expo's ambient types, most visibly the `process.env.EXPO_PUBLIC_*` typings.
// Expo also writes this same reference into `expo-env.d.ts` when the dev server
// runs, but that file is generated and gitignored, so it does not exist on a
// fresh clone or in CI — leaving `process.env` as `any` there and the
// type-aware lint rules reporting errors that never appear locally (DEX-95).
// Declaring it in this tracked file keeps the two environments identical.
/// <reference types="expo/types" />

// Reserved for project-wide ambient type declarations.
export {};
