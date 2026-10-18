import AppIntents

/// All App Shortcuts for Dexter (DEX-235). Phrases are compile-time; the iOS
/// 26 metadata processor only allows *entity/enum* parameter interpolation.
struct AppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddTaskIntent(),
            phrases: [
                "Add a task to \(.applicationName)",
            ],
            shortTitle: "Add Task",
            systemImageName: "square.and.pencil"
        )
        AppShortcut(
            intent: CompleteTaskIntent(),
            phrases: [
                "Complete a task in \(.applicationName)",
                "Complete \(\.$task) in \(.applicationName)",
            ],
            shortTitle: "Complete Task",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: LogHabitStepIntent(),
            phrases: [
                "Log a habit step in \(.applicationName)",
                "Log \(\.$habit) in \(.applicationName)",
            ],
            shortTitle: "Log Habit Step",
            systemImageName: "plus.circle"
        )
    }
}
