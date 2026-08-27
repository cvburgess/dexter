import AppIntents
import SwiftUI
import WidgetKit

// Today's habits as tappable rings (DEX-160) — the first widget that writes
// anything, via dexterPendingHabitStepsKey; useHabitWidgetDrain persists it.

/// Where a tap on the widget's *background* lands — rings run the intent
/// instead. Force-unwrapped: a literal this file owns.
private let dexterHabitsURL = URL(string: "dexter:///today")!

private let dexterNoHabitsMessage = "Open Dexter to see today's habits"
private let dexterNoHabitsTodayMessage = "No habits today"

/// How many rings a family draws: 2×2 small, 4×2 medium (DEX-160). Capped at
/// WIDGET_HABITS_PER_DAY with no "and N more" marker — a ring can't say it.
private func dexterHabitColumns(for family: WidgetFamily) -> Int {
    family == .systemSmall ? 2 : 4
}

private func dexterHabitLimit(for family: WidgetFamily) -> Int {
    dexterHabitColumns(for: family) * 2
}

// MARK: - Intent

/// `openAppWhenRun` is false so the tap lands where the user is looking —
/// also the only way `.systemSmall` can be interactive at all.
struct DexterHabitStepIntent: AppIntent {
    static var title: LocalizedStringResource = "Log a habit step"
    static var description = IntentDescription(
        "Adds a step to one of today's habits."
    )
    static var openAppWhenRun = false

    @Parameter(title: "Habit") var habitId: String
    @Parameter(title: "Date") var date: String

    init() {}

    init(habitId: String, date: String) {
        self.habitId = habitId
        self.date = date
    }

    func perform() async throws -> some IntentResult {
        DexterPendingHabitSteps.advance(habitId: habitId, on: date)
        return .result()
    }
}

// MARK: - Timeline

struct DexterHabitsEntry: TimelineEntry {
    let date: Date
    let snapshot: DexterHabitWidgetSnapshot?
    /// Read once per entry so every ring in one render agrees what's queued.
    let pending: [String: Int]

    var isoDate: String {
        dexterISOFormatter.string(from: date)
    }
}

/// One entry for now, then one at each upcoming midnight the snapshot
/// covers — a post-midnight glance never shows yesterday's progress.
struct DexterHabitsProvider: TimelineProvider {
    func placeholder(in context: Context) -> DexterHabitsEntry {
        DexterHabitsEntry(date: Date(), snapshot: nil, pending: [:])
    }

    func getSnapshot(
        in context: Context,
        completion: @escaping (DexterHabitsEntry) -> Void
    ) {
        completion(
            DexterHabitsEntry(
                date: Date(),
                snapshot: DexterHabitWidgetSnapshot.load(),
                pending: DexterPendingHabitSteps.load()
            )
        )
    }

    func getTimeline(
        in context: Context,
        completion: @escaping (Timeline<DexterHabitsEntry>) -> Void
    ) {
        let snapshot = DexterHabitWidgetSnapshot.load()
        let pending = DexterPendingHabitSteps.load()
        let now = Date()
        var entries = [
            DexterHabitsEntry(date: now, snapshot: snapshot, pending: pending)
        ]

        // Counted from *now*, not days.count - 1, or a stale snapshot books
        // midnights it has no data for.
        let today = dexterISOFormatter.string(from: now)
        let upcoming = snapshot?.days.filter { $0.date > today } ?? []

        let calendar = Calendar.current
        var midnight = calendar.startOfDay(for: now)
        for _ in upcoming {
            guard
                let next = calendar.date(byAdding: .day, value: 1, to: midnight)
            else { break }
            midnight = next
            entries.append(
                DexterHabitsEntry(
                    date: midnight,
                    snapshot: snapshot,
                    pending: pending
                )
            )
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Pieces

/// SwiftUI counterpart of components/HabitRing.tsx. No animation — a widget
/// redraws by swapping timeline entries, so the app's arc sweep has no room.
private struct DexterHabitRing: View {
    let habit: DexterWidgetHabit
    let palette: DexterWidgetPalette
    let size: CGFloat

    private var stroke: CGFloat { size * 0.1 }

    var body: some View {
        ZStack {
            if habit.isComplete {
                Circle().fill(palette.primaryColor)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.5, weight: .semibold))
                    .foregroundStyle(palette.primaryContentColor)
            } else {
                Circle()
                    .strokeBorder(
                        palette.textColor.opacity(0.15),
                        lineWidth: stroke
                    )
                Circle()
                    // No trimmed strokeBorder — inset by half its width to
                    // sit on the track rather than straddle the outer bound.
                    .inset(by: stroke / 2)
                    .trim(from: 0, to: habit.fraction)
                    .stroke(
                        palette.primaryColor,
                        style: StrokeStyle(lineWidth: stroke, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                Text(habit.emoji)
                    .font(.system(size: size * 0.45))
                    .lineLimit(1)
            }
        }
        .frame(width: size, height: size)
    }
}

/// A ring wrapped in the intent that advances it. `.plain` style avoids
/// WidgetKit's default accessory capsule, which misaligns behind a circle.
private struct DexterHabitButton: View {
    let habit: DexterWidgetHabit
    let date: String
    let palette: DexterWidgetPalette
    let size: CGFloat

    var body: some View {
        Button(intent: DexterHabitStepIntent(habitId: habit.id, date: date)) {
            DexterHabitRing(habit: habit, palette: palette, size: size)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            "\(habit.title) (\(habit.stepsComplete)/\(habit.steps))"
        )
    }
}

/// Sized off the container so one layout serves both families. `.topLeading`
/// keeps a half-full grid packed at the corner instead of drifting to center.
private struct DexterHabitsGridView: View {
    let day: DexterWidgetHabitDay
    let pending: [String: Int]
    let palette: DexterWidgetPalette
    let columns: Int
    let limit: Int

    private var habits: [DexterWidgetHabit] {
        day.habits.prefix(limit).map { habit in
            habit.withStepsComplete(
                DexterPendingHabitSteps.stepsComplete(
                    for: habit,
                    on: day.date,
                    pending: pending
                )
            )
        }
    }

    var body: some View {
        if habits.isEmpty {
            DexterNoDataView(
                palette: palette,
                message: dexterNoHabitsTodayMessage
            )
        } else {
            GeometryReader { geometry in
                // Off the height, which small/medium share — off the width,
                // medium's gaps would run nearly 3x small's.
                let spacing = geometry.size.height * 0.07

                // Flexible columns divide the width evenly; fewer habits than
                // columns still fills from the left rather than a broken grid.
                let ring = min(
                    (geometry.size.width - spacing * CGFloat(columns - 1))
                        / CGFloat(columns),
                    (geometry.size.height - spacing) / 2
                )

                LazyVGrid(
                    columns: Array(
                        repeating: GridItem(
                            .flexible(),
                            spacing: spacing,
                            alignment: .center
                        ),
                        count: columns
                    ),
                    alignment: .leading,
                    spacing: spacing
                ) {
                    ForEach(habits) { habit in
                        DexterHabitButton(
                            habit: habit,
                            date: day.date,
                            palette: palette,
                            size: ring
                        )
                    }
                }
                .frame(
                    maxWidth: .infinity,
                    maxHeight: .infinity,
                    alignment: .topLeading
                )
            }
        }
    }
}

// MARK: - Widget

struct DexterHabitsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: "DexterHabitsWidget",
            provider: DexterHabitsProvider()
        ) { entry in
            DexterHabitsWidgetView(entry: entry)
        }
        .configurationDisplayName("Habits")
        .description("Today's habits. Tap one to log a step.")
        // Home screen only — the lock screen's vibrant rendering mode would
        // flatten the emoji and arc to monochrome, leaving nothing.
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private struct DexterHabitsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    let entry: DexterHabitsEntry

    private var palette: DexterWidgetPalette {
        entry.snapshot?.palette(for: colorScheme) ?? dexterFallbackPalette
    }

    private var day: DexterWidgetHabitDay? {
        entry.snapshot?.day(on: entry.isoDate)
    }

    var body: some View {
        content
            .containerBackground(palette.backgroundColor, for: .widget)
            // Background only — a ring's own tap belongs to its intent.
            .widgetURL(dexterHabitsURL)
    }

    @ViewBuilder
    private var content: some View {
        if let day {
            DexterHabitsGridView(
                day: day,
                pending: entry.pending,
                palette: palette,
                columns: dexterHabitColumns(for: family),
                limit: dexterHabitLimit(for: family)
            )
        } else {
            // No snapshot, or one aged past its window — "No habits today"
            // would be a claim about a day we don't have.
            DexterNoDataView(palette: palette, message: dexterNoHabitsMessage)
        }
    }
}
