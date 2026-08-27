import SwiftUI

// Mirror of src/utils/widgets.shared.ts (DEX-83) — a renamed field decodes
// as a missing snapshot. Never talks to Supabase (session lives in the app).

/// Shared with the app (app.json, expo-target.config.js). A typo here reads
/// as "no data" — UserDefaults(suiteName:) silently returns nothing.
let dexterAppGroup = "group.com.dexterplanner"

/// The key `writeWidgetSnapshot` stores under.
let dexterSnapshotKey = "todaySnapshot"

/// Separate from the tasks payload so the two widgets reload independently
/// (DEX-160).
let dexterHabitSnapshotKey = "habitsSnapshot"

/// Where `DexterHabitStepIntent` parks a step the extension cannot persist.
/// The only key written from *this* side of the App Group.
let dexterPendingHabitStepsKey = "pendingHabitSteps"

/// Mirrors ETaskPriority (utils/taskPriority.ts); only the two the widget
/// distinguishes are named — see color(for:).
private let dexterNeitherPriority = 3
private let dexterUnprioritizedPriority = 4

struct DexterWidgetTask: Decodable, Identifiable {
    let id: String
    let title: String
    /// Out-of-range values are possible (a newer bundle could add a
    /// priority), so every read goes through DexterWidgetPalette.color(for:).
    let priority: Int
}

struct DexterWidgetDay: Decodable {
    /// ISO `yyyy-MM-dd`, compared as a string against the entry's own local day.
    let date: String
    /// Can exceed `tasks.count` — the payload is capped, this count is not.
    let openCount: Int
    let tasks: [DexterWidgetTask]
}

struct DexterWidgetPalette: Decodable {
    let background: String
    let border: String
    let text: String
    let primary: String
    /// Readable *on top of* `primary` — only the checkmark inside a completed
    /// habit ring needs it (DEX-160).
    let primaryContent: String
    let priority: [String]

    /// NEITHER remaps to UNPRIORITIZED: priority[NEITHER] equals the theme's
    /// background on every theme, so drawn as-is it would be invisible.
    func color(for priority: Int) -> Color {
        let index = priority == dexterNeitherPriority
            ? dexterUnprioritizedPriority
            : priority
        guard index >= 0, index < self.priority.count,
              let color = dexterColor(hex: self.priority[index])
        else { return textColor }
        return color
    }

    var backgroundColor: Color { dexterColor(hex: background) ?? .clear }
    var textColor: Color { dexterColor(hex: text) ?? .primary }
    var primaryColor: Color { dexterColor(hex: primary) ?? .accentColor }
    var borderColor: Color { dexterColor(hex: border) ?? .secondary }
    /// Falls back to `background`, not a system colour — the nearest thing
    /// to guaranteed contrast against the primary disc it sits on.
    var primaryContentColor: Color {
        dexterColor(hex: primaryContent) ?? backgroundColor
    }
}

struct DexterWidgetSnapshot: Decodable {
    let days: [DexterWidgetDay]
    let light: DexterWidgetPalette
    let dark: DexterWidgetPalette

    /// Both palettes travel since the extension can't read theme_mode; a
    /// forced light/dark preference resolves both halves the same, either way.
    func palette(for scheme: ColorScheme) -> DexterWidgetPalette {
        scheme == .dark ? dark : light
    }

    /// Nil once the snapshot ages past its four-day window — what makes the
    /// widget say "open Dexter" instead of presenting a stale day as today's.
    func day(on date: String) -> DexterWidgetDay? {
        days.first { $0.date == date }
    }

    /// Decoded fresh every request, never cached — the extension's process
    /// is reused unpredictably, so a cache would go stale right after a write.
    static func load() -> DexterWidgetSnapshot? {
        guard let defaults = UserDefaults(suiteName: dexterAppGroup),
              let json = defaults.string(forKey: dexterSnapshotKey),
              let data = json.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(DexterWidgetSnapshot.self, from: data)
    }
}

// MARK: - Habits (DEX-160)

struct DexterWidgetHabit: Decodable, Identifiable {
    let id: String
    let emoji: String
    /// Read by VoiceOver, never drawn — the ring shows the emoji.
    let title: String
    /// Guarded against zero everywhere it divides — the payload is another
    /// process's output, and a division by zero here crashes the home screen.
    let steps: Int
    let stepsComplete: Int

    /// 0...1, for `Circle().trim(from:to:)`.
    var fraction: Double {
        guard steps > 0 else { return 0 }
        return min(1, max(0, Double(stepsComplete) / Double(steps)))
    }

    var isComplete: Bool { steps > 0 && stepsComplete >= steps }

    /// Mirrors incrementDailyHabit in hooks/useHabits.tsx: a finished ring
    /// wraps back to empty. Restated, not shared — the app remains the definition.
    var nextStepsComplete: Int {
        stepsComplete >= steps ? 0 : stepsComplete + 1
    }

    /// The same habit with a step applied, for rendering the pending overlay
    /// without another round-trip through the App Group.
    func withStepsComplete(_ value: Int) -> DexterWidgetHabit {
        DexterWidgetHabit(
            id: id,
            emoji: emoji,
            title: title,
            steps: steps,
            stepsComplete: value
        )
    }
}

struct DexterWidgetHabitDay: Decodable {
    /// ISO `yyyy-MM-dd`, compared as a string against the entry's own local day.
    let date: String
    let habits: [DexterWidgetHabit]
}

struct DexterHabitWidgetSnapshot: Decodable {
    let days: [DexterWidgetHabitDay]
    let light: DexterWidgetPalette
    let dark: DexterWidgetPalette

    func palette(for scheme: ColorScheme) -> DexterWidgetPalette {
        scheme == .dark ? dark : light
    }

    func day(on date: String) -> DexterWidgetHabitDay? {
        days.first { $0.date == date }
    }

    static func load() -> DexterHabitWidgetSnapshot? {
        guard let defaults = UserDefaults(suiteName: dexterAppGroup),
              let json = defaults.string(forKey: dexterHabitSnapshotKey),
              let data = json.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(
            DexterHabitWidgetSnapshot.self,
            from: data
        )
    }
}

/// Steps tapped at home, not yet in Supabase (DEX-160): the widget renders
/// `pending ?? snapshot`. Only this side writes; only the app clears.
enum DexterPendingHabitSteps {
    /// `date|habitId` — keyed by date too since a tap at 23:59 must land on
    /// the day the widget was showing, not whichever day the app drains on.
    static func key(date: String, habitId: String) -> String {
        "\(date)|\(habitId)"
    }

    /// Non-integer values are dropped, not coerced — mirrors
    /// parsePendingHabitSteps on the app side.
    static func load() -> [String: Int] {
        guard let defaults = UserDefaults(suiteName: dexterAppGroup),
              let json = defaults.string(forKey: dexterPendingHabitStepsKey),
              let data = json.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(
                  [String: Int].self,
                  from: data
              )
        else { return [:] }
        return decoded
    }

    /// Whatever is queued, else what the app last published.
    static func stepsComplete(
        for habit: DexterWidgetHabit,
        on date: String,
        pending: [String: Int]
    ) -> Int {
        pending[key(date: date, habitId: habit.id)] ?? habit.stepsComplete
    }

    /// Reads the snapshot rather than a caller-supplied value, so the wrap
    /// rule runs against the freshest numbers.
    static func advance(habitId: String, on date: String) {
        guard let defaults = UserDefaults(suiteName: dexterAppGroup),
              let habit = DexterHabitWidgetSnapshot.load()?
                  .day(on: date)?
                  .habits.first(where: { $0.id == habitId })
        else { return }

        var pending = load()
        let current = stepsComplete(for: habit, on: date, pending: pending)
        pending[key(date: date, habitId: habitId)] =
            habit.withStepsComplete(current).nextStepsComplete

        guard let data = try? JSONEncoder().encode(pending),
              let json = String(data: data, encoding: .utf8)
        else { return }
        defaults.set(json, forKey: dexterPendingHabitStepsKey)
    }
}

// MARK: - Shared

/// Matches what Temporal.PlainDate produced on the JS side. Pinned to
/// en_US_POSIX, or a non-Gregorian locale would format digits/eras unused here.
let dexterISOFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
}()

// MARK: - Shared views

/// Shown with no snapshot at all: signed out, or never run since added.
/// Distinct from a real answer — "All done!" for tasks, empty row for habits.
struct DexterNoDataView: View {
    let palette: DexterWidgetPalette
    let message: String

    var body: some View {
        Text(message)
            .font(.caption)
            .foregroundStyle(palette.textColor.opacity(0.6))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The `dexter` default light palette — only reached with no snapshot, so
/// it paints the empty state and nothing else.
let dexterFallbackPalette = DexterWidgetPalette(
    background: "#fffbf4",
    border: "#e0d5c2",
    text: "#593d31",
    primary: "#00674f",
    primaryContent: "#c3ffcf",
    priority: ["#fcb700", "#ff627d", "#00bafe", "#fffbf4", "#593d31"]
)

// `#rrggbb` only. Nil on a malformed string rather than silently scanning
// to black. Shared with DexterAlarmLiveActivity.
func dexterColor(hex: String) -> Color? {
    var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if value.hasPrefix("#") { value.removeFirst() }
    guard value.count == 6, value.allSatisfy(\.isHexDigit),
          let rgb = UInt64(value, radix: 16) else { return nil }
    return Color(
        red: Double((rgb & 0xFF0000) >> 16) / 255.0,
        green: Double((rgb & 0x00FF00) >> 8) / 255.0,
        blue: Double(rgb & 0x0000FF) / 255.0
    )
}
