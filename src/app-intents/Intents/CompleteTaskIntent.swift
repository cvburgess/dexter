import AppIntents
internal import ExpoAppIntents

/// "Complete <task> in Dexter" — the task is picked from the entity catalog
/// JS publishes; the `completeTask` handler marks it done in Supabase.
struct CompleteTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Complete Task"
    static let description = IntentDescription("Marks a task as done.")
    static let openAppWhenRun = true

    @Parameter(title: "Task", requestValueDialog: "Which task?")
    var task: DexterTaskEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Complete \(\.$task)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        await AppIntentDispatcher.shared.dispatch(
            name: "completeTask",
            params: ["taskId": .string(task.id)]
        )
        return .result(dialog: "Task completed.")
    }
}
