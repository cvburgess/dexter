import AppIntents
internal import ExpoAppIntents

/// "Add a task to Dexter" — the title is spoken or typed, with an optional
/// list and due date Shortcuts can fill in. JS persists through the
/// `addTask` handler, so the app must open (headless JS is not shipped yet;
/// the habit intent's queue path is how a write avoids that).
struct AddTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Add Task"
    static let description = IntentDescription("Adds a task to a list.")
    static let openAppWhenRun = true

    @Parameter(title: "Task", requestValueDialog: "What should the task say?")
    var taskTitle: String

    @Parameter(title: "List")
    var list: DexterListEntity?

    @Parameter(title: "Due Date")
    var dueDate: Date?

    static var parameterSummary: some ParameterSummary {
        When(\.$list, .hasAnyValue) {
            Summary("Add \(\.$taskTitle) to \(\.$list)")
        } otherwise: {
            Summary("Add \(\.$taskTitle)")
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        await AppIntentDispatcher.shared.dispatch(
            name: "addTask",
            params: [
                "title": .string(taskTitle),
                "listId": list.map { .string($0.id) } ?? .null,
                // Date-only: `dueOn` is a day, not a moment (DEX-235).
                "dueDate": dueDate.map {
                    .string(dexterIntentDateFormatter.string(from: $0))
                } ?? .null,
            ]
        )
        return .result(dialog: "Task added to Dexter.")
    }
}
