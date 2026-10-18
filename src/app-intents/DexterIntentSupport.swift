import AppIntents
internal import ExpoAppIntents
import Foundation

// The widget extension (DexterAlarmWidget) is a separate target that restates
// these strings in DexterWidgetSnapshot.swift — the targets cannot share code,
// so keep the two copies in step.

let dexterAppGroup = "group.com.dexterplanner"
let dexterHabitSnapshotKey = "habitsSnapshot"
let dexterPendingHabitStepsKey = "pendingHabitSteps"

/// Matches the widget's `dexterISOFormatter`: pending steps and daily-habit
/// rows key by `yyyy-MM-dd` in the device's calendar.
let dexterIntentDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
}()

/// Mirror of the widget catalog search — the app target cannot import it.
func dexterIntentNormalize(_ value: String) -> String {
    value
        .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

/// The subset of the habits snapshot the app-target habit intent needs.
private struct DexterHabitSnapshotDecoded: Decodable {
    let days: [DexterHabitDayDecoded]
}

private struct DexterHabitDayDecoded: Decodable {
    let date: String
    let habits: [DexterHabitDecoded]
}

private struct DexterHabitDecoded: Decodable {
    let id: String
    let steps: Int
    let stepsComplete: Int
}

/// `date|habitId` → absolute stepsComplete on the App Group key the widget's
/// `DexterPendingHabitSteps` writes. Either target may write; only the app
/// drains (`useHabitWidgetDrain` persists it on the next foreground).
enum DexterAppHabitSteps {
    static func advance(habitId: String, on date: String) {
        guard let defaults = UserDefaults(suiteName: dexterAppGroup),
              let json = defaults.string(forKey: dexterHabitSnapshotKey),
              let data = json.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(
                  DexterHabitSnapshotDecoded.self,
                  from: data
              ),
              let habit = snapshot.days.first(where: { $0.date == date })?
                  .habits.first(where: { $0.id == habitId })
        else { return }

        let key = "\(date)|\(habitId)"
        var pending = load(from: defaults)
        // Mirrors the widget's wrap: tapping a finished ring steps back to 0.
        let current = pending[key] ?? habit.stepsComplete
        pending[key] = current >= habit.steps ? 0 : current + 1

        guard let next = try? JSONEncoder().encode(pending),
              let nextJson = String(data: next, encoding: .utf8)
        else { return }
        defaults.set(nextJson, forKey: dexterPendingHabitStepsKey)
    }

    private static func load(from defaults: UserDefaults) -> [String: Int] {
        guard let json = defaults.string(forKey: dexterPendingHabitStepsKey),
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([String: Int].self, from: data)
        else { return [:] }
        return decoded
    }
}
