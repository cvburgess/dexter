// Expo's ambient types. Also written to gitignored expo-env.d.ts, absent in
// CI — tracked here so CI matches (DEX-95).
/// <reference types="expo/types" />

// Reserved for project-wide ambient types. A future image import can't use
// `declare module "*.jpg"` (tsconfig's @/* resolves first) — use `require<ImageSourcePropType>(...)` instead.
export {};
