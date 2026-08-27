// Re-exports the native variant so tsc (no platform-extension resolution)
// can resolve this import; the bundler always picks a real platform file.
export * from "./IconMenu.types";
export { IconMenu } from "./IconMenu.native";
