// Platform-specific implementations live in CalendarSourceList.{native,web}.tsx
// and the bundler selects one per platform. This base file exists so TypeScript
// (which does not resolve platform extensions) can resolve
// `@/components/CalendarSourceList`; at runtime a platform variant is always
// bundled instead. It falls back to the native (device calendars) list.
export { CalendarSourceList } from "./CalendarSourceList.native";
