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

/// The task/habit/list entities: a spoken value fuzzy-matches id/title/subtitle.
protocol DexterCatalogEntity {
    var id: String { get }
    var displayTitle: String { get }
    var subtitle: String? { get }
}

extension DexterCatalogEntity {
    func matches(_ searchText: String) -> Bool {
        let normalized = dexterIntentNormalize(searchText)
        guard !normalized.isEmpty else { return false }
        let terms = ([id, displayTitle] + (subtitle.map { [$0] } ?? [])).map(
            dexterIntentNormalize
        )
        return terms.contains { term in
            normalized == term
                || normalized.contains(term)
                || term.contains(normalized)
        }
    }
}

enum DexterIntentError: Error, CustomLocalizedStringResourceConvertible {
    case habitNotLogged

    var localizedStringResource: LocalizedStringResource {
        "Couldn't log that habit for that day. Open Dexter and try again."
    }
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

/// `date|habitId` → absolute stepsComplete on the widget's App Group key.
/// Either target may write; the app drains on the next foreground.
enum DexterAppHabitSteps {
    /// False when the habit isn't in that day's snapshot (or the write failed).
    static func advance(habitId: String, on date: String) -> Bool {
        guard let defaults = UserDefaults(suiteName: dexterAppGroup),
              let json = defaults.string(forKey: dexterHabitSnapshotKey),
              let data = json.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(
                  DexterHabitSnapshotDecoded.self,
                  from: data
              ),
              let habit = snapshot.days.first(where: { $0.date == date })?
                  .habits.first(where: { $0.id == habitId })
        else { return false }

        let key = "\(date)|\(habitId)"
        var pending = load(from: defaults)
        // Clamps, unlike the widget's tap-to-wrap: "log a step" must never erase
        // a finished habit's progress.
        let current = pending[key] ?? habit.stepsComplete
        pending[key] = min(current + 1, habit.steps)

        guard let next = try? JSONEncoder().encode(pending),
              let nextJson = String(data: next, encoding: .utf8)
        else { return false }
        defaults.set(nextJson, forKey: dexterPendingHabitStepsKey)
        return true
    }

    private static func load(from defaults: UserDefaults) -> [String: Int] {
        guard let json = defaults.string(forKey: dexterPendingHabitStepsKey),
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([String: Int].self, from: data)
        else { return [:] }
        return decoded
    }
}
