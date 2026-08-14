import AppIntents
import SwiftUI
import WidgetKit

// Today's habits on the home screen, as a grid of tappable rings (DEX-160).
// The visual echo of `components/HabitRing.tsx`, and the first widget in the app
// that *writes* anything.
//
// It still fetches nothing and still holds no session. A tap runs
// `DexterHabitStepIntent` inside this extension, which advances the ring and
// files the new value under `dexterPendingHabitStepsKey`; `useHabitWidgetDrain`
// persists the queue the next time the app runs. The whole argument for why the
// session cannot simply live here is in the header of `utils/widgets.shared.ts`.

/// Where a tap on the widget's *background* lands — the rings themselves run the
/// intent instead. Force-unwrapped for the reason `DexterTasksWidget`'s are: a
/// literal this file owns, where a silent failure would be far harder to notice
/// than a crash on the first build.
private let dexterHabitsURL = URL(string: "dexter:///today")!

private let dexterNoHabitsMessage = "Open Dexter to see today's habits"
private let dexterNoHabitsTodayMessage = "No habits today"

/// How many rings a family draws.
///
/// The two grids DEX-160 asks for by name: 2×2 on small, 4×2 on medium. The
/// payload is capped at `WIDGET_HABITS_PER_DAY` (eight — the medium grid), so a
/// user with more active habits than fit sees the first of them and no marker
/// saying so. That is deliberate: a ring cannot say "and three more", and a
/// count in a header would cost a row of the grid to say it.
private func dexterHabitColumns(for family: WidgetFamily) -> Int {
    family == .systemSmall ? 2 : 4
}

private func dexterHabitLimit(for family: WidgetFamily) -> Int {
    dexterHabitColumns(for: family) * 2
}

// MARK: - Intent

/// Advances one habit by a step, from the home screen, without opening the app.
///
/// `openAppWhenRun` is false — the point of the whole pending-queue design is
/// that the tap lands where the user is looking. It is also the only way the
/// *small* widget can be interactive at all: WidgetKit routes per-element taps
/// from `.systemMedium` up, so a `Link` on a 2×2 grid does nothing and one
/// `widgetURL` covers the whole thing.
///
/// WidgetKit reloads the timeline itself once an interactive intent returns, so
/// nothing here calls `WidgetCenter`.
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
    /// Read once per entry rather than per ring, so every ring in one render
    /// agrees about what is queued.
    let pending: [String: Int]

    var isoDate: String {
        DexterTasksEntry.isoFormatter.string(from: date)
    }
}

/// The same shape as `DexterTasksProvider`, and for the same reason: one entry
/// for now, then one at each upcoming local midnight the snapshot still covers.
///
/// This is what stops a widget glanced at after midnight from showing
/// yesterday's progress. The payload carries four days — today's rings filled
/// to today's progress, the next three at zero — so the rollover needs no
/// network, no background task, and no midnight timer in JS. Past the fourth
/// day `day(on:)` finds nothing and the empty state takes over rather than
/// presenting a stale day as today's.
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

        // Counted from *now*, not from `days.count - 1`: a snapshot four days
        // old would otherwise book three midnights it has no data for and sit
        // on the empty state until the last of them passed.
        let today = DexterTasksEntry.isoFormatter.string(from: now)
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

/// One habit: an emoji inside a radial progress ring, filling clockwise from
/// twelve o'clock. The SwiftUI counterpart of `components/HabitRing.tsx`, down
/// to the 0.15 track and the solid-disc-plus-checkmark completed state.
///
/// No animation. A widget redraws by swapping timeline entries, not by
/// transitioning within one, so the app's 300ms arc sweep has nowhere to run.
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
                    // `strokeBorder` has no trimmed form, so the arc is inset by
                    // half its own width to sit on the track rather than
                    // straddling the ring's outer bound.
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

/// A ring wrapped in the intent that advances it.
///
/// `.buttonStyle(.plain)` because WidgetKit's default renders an accessory
/// tint capsule behind the label, which on a circular mark reads as a second,
/// misaligned ring.
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

/// The 2×2 or 4×2 grid.
///
/// Sized off the container rather than a constant so one layout serves both
/// families and the iPad's larger renderings of them. `.topLeading` keeps a
/// half-full grid packed against the corner instead of drifting to the middle,
/// which is what makes two habits look like two habits rather than a mistake.
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
                let spacing = geometry.size.width * 0.06
                let ring = min(
                    (geometry.size.width - spacing * CGFloat(columns - 1))
                        / CGFloat(columns),
                    (geometry.size.height - spacing) / 2
                )

                LazyVGrid(
                    columns: Array(
                        repeating: GridItem(
                            .fixed(ring),
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
        // Home screen only. The lock screen renders accessories in
        // `WidgetRenderingMode.vibrant`, which would flatten both the emoji and
        // the primary-coloured arc to monochrome — a habit ring has nothing
        // left once its colour and its glyph are gone.
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
            // The background only. A ring's own tap belongs to its intent, and
            // `widgetURL` is the fallback for everything around them.
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
            // No snapshot, or one that has aged past its four-day window with
            // the app never opened. Saying "No habits today" here would be a
            // claim about a day we do not have.
            DexterNoDataView(palette: palette, message: dexterNoHabitsMessage)
        }
    }
}
