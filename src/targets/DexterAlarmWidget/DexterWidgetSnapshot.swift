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
    let surfaceSunken: String
    let border: String
    let text: String
    let primary: String
    let priority: [String]

    /// The accent for a task's priority, falling back to the theme's ink for an
    /// index this build doesn't know. A ring in the wrong colour is a far
    /// smaller failure than a crash on the home screen.
    func color(for priority: Int) -> Color {
        guard priority >= 0, priority < self.priority.count,
              let color = dexterColor(hex: self.priority[priority])
        else { return textColor }
        return color
    }

    var backgroundColor: Color { dexterColor(hex: background) ?? .clear }
    var textColor: Color { dexterColor(hex: text) ?? .primary }
    var primaryColor: Color { dexterColor(hex: primary) ?? .accentColor }
    var borderColor: Color { dexterColor(hex: border) ?? .secondary }
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
