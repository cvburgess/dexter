import SwiftUI

// What the app publishes into the App Group for the widgets to render (DEX-83).
// The mirror image of `src/utils/widgets.shared.ts` — keep the two in step;
// nothing checks them against each other, and a renamed field decodes as a
// missing snapshot, which the widget shows as its "open Dexter" empty state.
//
// The extension never talks to Supabase. Its session lives in AsyncStorage
// inside the *app* container, and mirroring it here would put a second refresh
// holder on a rotating token and eventually sign the user out — see the header
// of `widgets.shared.ts` for the whole argument.

/// The App Group three targets and the app already share (`app.json`,
/// `expo-target.config.js`, `expo-share-intent`). `UserDefaults(suiteName:)`
/// silently returns nothing for a group the target isn't entitled to, so a typo
/// here reads as "no data" rather than as an error.
let dexterAppGroup = "group.com.dexterplanner"

/// The key `writeWidgetSnapshot` stores under.
let dexterSnapshotKey = "todaySnapshot"

/// The key `writeHabitWidgetSnapshot` stores under (DEX-160). Separate from the
/// tasks payload so the two widgets reload independently — see
/// `utils/widgets.ios.ts`.
let dexterHabitSnapshotKey = "habitsSnapshot"

/// Where `DexterHabitStepIntent` parks a step the extension cannot persist.
/// The only key written from *this* side of the App Group.
let dexterPendingHabitStepsKey = "pendingHabitSteps"

/// Indexes into `DexterWidgetPalette.priority`, mirroring `ETaskPriority`
/// (`utils/taskPriority.ts`). Only the two the widget has to tell apart are
/// named; see `DexterWidgetPalette.color(for:)`.
private let dexterNeitherPriority = 3
private let dexterUnprioritizedPriority = 4

struct DexterWidgetTask: Decodable, Identifiable {
    let id: String
    let title: String
    /// The raw `ETaskPriority` index. Out-of-range values are possible in
    /// principle — a newer bundle could add a priority before this binary is
    /// replaced — so every read goes through `DexterWidgetPalette.color(for:)`.
    let priority: Int
}

struct DexterWidgetDay: Decodable {
    /// ISO `yyyy-MM-dd`, compared as a string against the entry's own local day.
    let date: String
    /// Every open task on the day, which can exceed `tasks.count` — the payload
    /// is capped, the header count is not.
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

    /// The accent for a task's priority, falling back to the theme's ink for an
    /// index this build doesn't know. A ring in the wrong colour is a far
    /// smaller failure than a crash on the home screen.
    ///
    /// `NEITHER` is remapped to `UNPRIORITIZED`, because on all five themes
    /// `priority[NEITHER]` *is* the theme's `background` (both are daisyUI's
    /// base-100) — so a ring drawn in it is not merely low-contrast, it is
    /// invisible. The app never meets this: its cards fill with `priorityMuted`,
    /// whose `NEITHER` entry is replaced by `surfaceSunken` for exactly the same
    /// reason (`mutePriorities` in `utils/theme.ts`). This is the ring-shaped
    /// counterpart of that substitution, and it lands on the theme's ink —
    /// already what "no priority chosen" looks like, which is the right
    /// neighbour for "explicitly neither important nor urgent".
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
    /// Falls back to `background` rather than to a system colour: the mark sits
    /// on a solid `primary` disc, and the theme's own page colour is the nearest
    /// thing to a guaranteed contrast against an accent.
    var primaryContentColor: Color {
        dexterColor(hex: primaryContent) ?? backgroundColor
    }
}

struct DexterWidgetSnapshot: Decodable {
    let days: [DexterWidgetDay]
    let light: DexterWidgetPalette
    let dark: DexterWidgetPalette

    /// Both palettes travel because the extension cannot read
    /// `preferences.theme_mode`. When the user has *forced* light or dark, the
    /// app resolves both halves to that one palette, so following the
    /// environment here is right in every case.
    func palette(for scheme: ColorScheme) -> DexterWidgetPalette {
        scheme == .dark ? dark : light
    }

    /// The day matching `date`, or nil once the snapshot has aged past its
    /// four-day window with the app never opened. Nil is what makes the widget
    /// say "open Dexter" instead of presenting a stale day as today's.
    func day(on date: String) -> DexterWidgetDay? {
        days.first { $0.date == date }
    }

    /// Reads whatever the app last published. Decoded fresh on every timeline
    /// request rather than cached: the extension's process is short-lived and
    /// reused unpredictably, so a cached copy would be the stale one exactly
    /// when the app had just written a new one.
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
    /// The day's target. Guarded against zero everywhere it divides: `steps` is
    /// `not null` with a `min(1)` editor, but the payload is another process's
    /// output and a division by zero here is a crash on the home screen.
    let steps: Int
    let stepsComplete: Int

    /// 0...1, for `Circle().trim(from:to:)`.
    var fraction: Double {
        guard steps > 0 else { return 0 }
        return min(1, max(0, Double(stepsComplete) / Double(steps)))
    }

    var isComplete: Bool { steps > 0 && stepsComplete >= steps }

    /// The value a tap lands on, mirroring `incrementDailyHabit` in
    /// `hooks/useHabits.tsx`: a finished ring wraps back to empty rather than
    /// climbing past its target. Restated here rather than shared because there
    /// is no way to share it — but it is one comparison, and the app remains
    /// the definition.
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

/// The queue of steps tapped on the home screen that have not reached Supabase
/// yet (DEX-160).
///
/// The extension holds no Supabase session and deliberately never will — see the
/// header of `utils/widgets.shared.ts`. So a tap writes here instead, the widget
/// renders `pending ?? snapshot`, and `useHabitWidgetDrain` persists the queue
/// the next time the app is in front of the user.
///
/// **Only this side writes it; only the app clears it.** That is what keeps a
/// republish the app makes for an unrelated reason from reverting a tap: the
/// overlay outlives the snapshot underneath it.
enum DexterPendingHabitSteps {
    /// `date|habitId`, mirroring `pendingHabitStepsKey` in
    /// `utils/widgets.shared.ts`. Keyed by date as well as habit because the
    /// payload carries four days: a tap at 23:59 must land on the day the widget
    /// was showing, not on whichever day the app sees when it drains.
    static func key(date: String, habitId: String) -> String {
        "\(date)|\(habitId)"
    }

    /// The whole queue, or empty for anything unreadable. Values that are not
    /// integers are dropped rather than coerced — the app applies the same rule
    /// in `parsePendingHabitSteps`.
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

    /// The step a habit is currently showing: whatever is queued for it, else
    /// what the app last published.
    static func stepsComplete(
        for habit: DexterWidgetHabit,
        on date: String,
        pending: [String: Int]
    ) -> Int {
        pending[key(date: date, habitId: habit.id)] ?? habit.stepsComplete
    }

    /// Advances one habit and writes the queue back.
    ///
    /// Reads the snapshot rather than taking the value from the caller so the
    /// wrap rule runs against the freshest numbers the extension has: an intent
    /// invocation is a fresh process, and the view that rendered the button may
    /// belong to a timeline entry the app has since replaced.
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

/// `yyyy-MM-dd` in the device's own calendar and time zone, matching what
/// `Temporal.PlainDate` produced on the JS side — the form every `date` in both
/// payloads is keyed by.
///
/// Pinned to `en_US_POSIX` because a locale with a non-Gregorian calendar would
/// otherwise format digits and eras the payload never uses.
let dexterISOFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
}()

// MARK: - Shared views

/// Shown when there is no snapshot at all: signed out, or the app has not run
/// since this widget was added. Distinct from a real answer about a real day —
/// "All done!" for tasks, an empty habit row for habits.
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

/// The `dexter` theme, the app's own default light palette. Only reached when
/// no snapshot exists, so it paints the empty state and nothing else.
let dexterFallbackPalette = DexterWidgetPalette(
    background: "#fffbf4",
    border: "#e0d5c2",
    text: "#593d31",
    primary: "#00674f",
    primaryContent: "#c3ffcf",
    priority: ["#fcb700", "#ff627d", "#00bafe", "#fffbf4", "#593d31"]
)

// `#rrggbb`, the only form the app sends. Every colour token in the payload is a
// hex literal from `utils/theme.ts`; `textSecondary` is deliberately not among
// them because it is an `rgba()` string, and the dimmed ink is derived with
// `.opacity()` at the point of use instead.
//
// The nil path exists so a malformed string falls back rather than scanning to
// black, which `Scanner.scanHexInt64` would do silently. Shared with
// `DexterAlarmLiveActivity`, which used to carry its own copy.
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
