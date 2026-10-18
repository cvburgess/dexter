import AppIntents
import Foundation

/// "Log a habit step in Dexter" — the one intent that needs no JavaScript:
/// like the home-screen widget rings, it queues to the App Group and
/// `useHabitWidgetDrain` persists it on the next foreground. That also means
/// it can stay headless (`openAppWhenRun = false`), unlike the task intents.
struct LogHabitStepIntent: AppIntent {
    static let title: LocalizedStringResource = "Log Habit Step"
    static let description = IntentDescription("Adds a step to a habit.")
    static let openAppWhenRun = false

    @Parameter(title: "Habit", requestValueDialog: "Which habit?")
    var habit: DexterHabitEntity

    @Parameter(title: "Date")
    var date: Date?

    static var parameterSummary: some ParameterSummary {
        Summary("Log a step for \(\.$habit)")
    }

    func perform() async throws -> some IntentResult {
        DexterAppHabitSteps.advance(
            habitId: habit.id,
            // Defaults to today; an explicit date lands on that day's row the
            // way a 23:59 widget tap lands on the day the widget showed.
            on: dexterIntentDateFormatter.string(from: date ?? Date())
        )
        return .result()
    }
}
