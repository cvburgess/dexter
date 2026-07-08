// Platform-specific implementations live in ConfirmationModal.{native,web}.tsx
// and the bundler selects one per platform. This base file exists so TypeScript
// (which does not resolve platform extensions) can resolve
// `@/components/ConfirmationModal`; at runtime a platform variant is always
// bundled instead. It falls back to the React Native Alert implementation.
export * from "./ConfirmationModal.types";
export { ConfirmationModal } from "./ConfirmationModal.native";
