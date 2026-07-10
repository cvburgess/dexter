// Platform-specific implementations live in IconMenu.{native,web}.tsx and the
// bundler selects one per platform. This base file exists so TypeScript
// (which does not resolve platform extensions) can resolve
// `@/components/IconMenu`; at runtime a platform variant is always bundled
// instead. It falls back to the native `@expo/ui` implementation.
export * from "./IconMenu.types";
export { IconMenu } from "./IconMenu.native";
