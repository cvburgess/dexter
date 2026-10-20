import AppIntents
import Foundation

/// Queues to the widget's App Group row, so it needs no JavaScript and can
/// stay headless — `useHabitWidgetDrain` persists it on next foreground.
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
        let logged = DexterAppHabitSteps.advance(
            habitId: habit.id,
            // Defaults to today; an explicit date lands on that day's row the
            // way a 23:59 widget tap lands on the day the widget showed.
            on: dexterIntentDateFormatter.string(from: date ?? Date())
        )
        guard logged else { throw DexterIntentError.habitNotLogged }
        return .result()
    }
}
