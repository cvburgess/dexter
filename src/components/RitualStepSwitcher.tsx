// Platform-specific implementations live in RitualStepSwitcher.{native,web}.tsx
// and the bundler selects one per platform. This base file exists so TypeScript
// (which does not resolve platform extensions) can resolve
// `@/components/RitualStepSwitcher`; at runtime a platform variant is always
// bundled instead. It falls back to the native menu implementation, mirroring
// `IconMenu.tsx`.
export * from "./RitualStepSwitcher.types";
export { RitualStepSwitcher } from "./RitualStepSwitcher.native";
