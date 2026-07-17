import type { TSettingsIconName } from "@/components/SettingsIcon";

// The subview slugs, as a literal union so `/settings/${slug}` narrows to the
// typed-route strings expo-router accepts (typedRoutes is enabled).
export type TSettingsSlug =
  | "account"
  | "appearance"
  | "tasks"
  | "lists"
  | "calendars"
  | "habits"
  | "journal"
  | "notes"
  | "licenses";

export type TSettingsItem = {
  slug: TSettingsSlug;
  title: string;
  subtitle: string;
  icon: TSettingsIconName;
};

// Each item navigates to a subview under `/settings/<slug>` (registered in
// settings/_layout.tsx). Shared by the list (index.tsx) and the large-screen
// sidebar (SettingsSidebar.tsx) so both stay in sync.
export const SETTINGS_ITEMS: TSettingsItem[] = [
  {
    slug: "account",
    title: "Account",
    subtitle: "Manage your account and sign out",
    icon: "person-circle-outline",
  },
  {
    slug: "appearance",
    title: "Appearance",
    subtitle: "Theme and display options",
    icon: "color-palette-outline",
  },
  {
    slug: "tasks",
    title: "Tasks",
    subtitle: "Task defaults and behavior",
    icon: "checkbox-outline",
  },
  {
    slug: "lists",
    title: "Lists",
    subtitle: "Organize tasks into lists",
    icon: "list-outline",
  },
  {
    slug: "calendars",
    title: "Calendars",
    subtitle: "Connected calendars",
    icon: "calendar-outline",
  },
  {
    slug: "habits",
    title: "Habits",
    subtitle: "Habit tracking preferences",
    icon: "repeat-outline",
  },
  {
    slug: "journal",
    title: "Journal",
    subtitle: "Journaling preferences",
    icon: "book-outline",
  },
  {
    slug: "notes",
    title: "Notes",
    subtitle: "Notes preferences",
    icon: "document-text-outline",
  },
  {
    slug: "licenses",
    title: "Licenses",
    subtitle: "Open source licenses",
    icon: "document-outline",
  },
];
