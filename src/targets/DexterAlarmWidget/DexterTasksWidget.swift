import SwiftUI
import WidgetKit

// Home/lock screen surfaces for today's tasks (DEX-83); taps are deep links
// so completion still goes through the app's subtask sweep/recurrence spawn.

/// `/today` needs no `date` param — passing one would make a repeat tap a
/// no-op link. Force-unwrapped: both are literals this file owns.
private let dexterTodayURL = URL(string: "dexter:///today")!
private let dexterNewTaskURL = URL(string: "dexter:///new-task")!

/// Copy for a cleared day (DEX-83). Not shown for an empty extra-large
/// column, where three blank copies would drown the one day with work.
private let dexterAllDone = "All done! No more tasks today"

/// Small fits six exactly; medium stops one row short for a two-line wrap,
/// which small forgoes (dexterTitleLineLimit). Large caps at WIDGET_TASKS_PER_DAY.
private func dexterRowLimit(for family: WidgetFamily) -> Int {
    switch family {
    case .systemSmall: 6
    case .systemMedium: 5
    default: Int.max
    }
}

/// Small forgoes wrapping: a second line costs a whole task's worth of
/// height there, and six single-line tasks beat four wrapped ones.
private func dexterTitleLineLimit(for family: WidgetFamily) -> Int {
    family == .systemSmall ? 1 : 2
}

// MARK: - Timeline

struct DexterTasksEntry: TimelineEntry {
    let date: Date
    let snapshot: DexterWidgetSnapshot?

    /// Derived from `date`, not "now", so an entry scheduled for a future
    /// midnight renders that day when it comes up.
    var isoDate: String {
        dexterISOFormatter.string(from: date)
    }
}

/// One entry for now, then each upcoming midnight the four-day snapshot
/// covers, with no app open, background task, or JS timer.
struct DexterTasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> DexterTasksEntry {
        DexterTasksEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(
        in context: Context,
        completion: @escaping (DexterTasksEntry) -> Void
    ) {
        completion(
            DexterTasksEntry(date: Date(), snapshot: DexterWidgetSnapshot.load())
        )
    }

    func getTimeline(
        in context: Context,
        completion: @escaping (Timeline<DexterTasksEntry>) -> Void
    ) {
        let snapshot = DexterWidgetSnapshot.load()
        let now = Date()
        var entries = [DexterTasksEntry(date: now, snapshot: snapshot)]

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
            entries.append(DexterTasksEntry(date: midnight, snapshot: snapshot))
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Pieces

/// The open circle, stroked in its priority accent (DEX-83). Sized off the
/// font so it keeps proportion as accessory families shrink the type.
private struct DexterTaskCircle: View {
    let color: Color
    var size: CGFloat = 13

    var body: some View {
        Circle()
            .strokeBorder(color, lineWidth: 1.5)
            .frame(width: size, height: size)
    }
}

private struct DexterTaskRow: View {
    let task: DexterWidgetTask
    let palette: DexterWidgetPalette
    var font: Font = .caption
    var lineLimit: Int = 2

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            DexterTaskCircle(color: palette.color(for: task.priority))
                // A circle has no baseline of its own and drifts up off a
                // two-line title without this.
                .alignmentGuide(.firstTextBaseline) { $0.height * 0.8 }
            Text(task.title)
                .font(font)
                .foregroundStyle(palette.textColor)
                .lineLimit(lineLimit)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// "Today  8" — the heading every family but the circular accessory carries.
/// The count is the *open* total, which is why it can exceed the rows drawn.
private struct DexterTasksHeader: View {
    let title: String
    let count: Int
    let palette: DexterWidgetPalette
    var font: Font = .subheadline

    var body: some View {
        HStack(spacing: 6) {
            Text(title)
                .font(font.weight(.semibold))
                .foregroundStyle(palette.primaryColor)
                .lineLimit(1)
            if count > 0 {
                Text("\(count)")
                    .font(font)
                    // textSecondary is an rgba() string the payload can't
                    // carry, so it's derived here at the theme's same 0.6.
                    .foregroundStyle(palette.textColor.opacity(0.6))
            }
            Spacer(minLength: 0)
        }
    }
}

/// The `+` on medium/large/extra-large only: WidgetKit routes per-element
/// taps from `.systemMedium` up, so small gets no button, per DEX-83.
private struct DexterAddTaskButton: View {
    let palette: DexterWidgetPalette
    var size: CGFloat = 30

    var body: some View {
        Link(destination: dexterNewTaskURL) {
            Image(systemName: "plus")
                .font(.system(size: size * 0.5, weight: .semibold))
                .foregroundStyle(palette.backgroundColor)
                .frame(width: size, height: size)
                .background(Circle().fill(palette.primaryColor))
        }
    }
}

/// What `DexterNoDataView` says on this widget. Distinct from "All done!",
/// which is a real answer about a real day.
private let dexterNoTasksMessage = "Open Dexter to see today's tasks"

// MARK: - Home screen

/// The small / medium / large layout: heading, then as many rows as the family
/// has room for, then the `+` where taps can reach it.
private struct DexterTasksListView: View {
    let day: DexterWidgetDay?
    let palette: DexterWidgetPalette
    let limit: Int
    let titleLineLimit: Int
    let showsAddButton: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            DexterTasksHeader(
                title: "Today",
                count: day?.openCount ?? 0,
                palette: palette
            )

            if let day, !day.tasks.isEmpty {
                let rows = Array(day.tasks.prefix(limit))
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) {
                        index, task in
                        DexterTaskRow(
                            task: task,
                            palette: palette,
                            lineLimit: titleLineLimit
                        )
                            // Only the bottom row can collide with the `+`;
                            // insetting every row costs the whole list width.
                            .padding(
                                .trailing,
                                showsAddButton && index == rows.count - 1
                                    ? 34 : 0
                            )
                    }
                }
                Spacer(minLength: 0)
            } else {
                Text(dexterAllDone)
                    .font(.caption)
                    .foregroundStyle(palette.textColor.opacity(0.6))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .overlay(alignment: .bottomTrailing) {
            if showsAddButton {
                DexterAddTaskButton(palette: palette)
            }
        }
    }
}

/// Today and the next three days as columns. An empty one stays blank rather
/// than repeating "All done!" (DEX-83) — four copies would read as an error.
private struct DexterTasksColumnsView: View {
    let entry: DexterTasksEntry
    let palette: DexterWidgetPalette

    private var columns: [(title: String, day: DexterWidgetDay)] {
        guard let snapshot = entry.snapshot,
              let start = snapshot.days.firstIndex(where: {
                  $0.date >= entry.isoDate
              })
        else { return [] }

        // Sliced from the entry's own day, not the payload's first element,
        // or a future-midnight entry's day two would still be headed "Today".
        return snapshot.days[start...].enumerated().map { offset, day in
            (title: columnTitle(offset: offset, iso: day.date), day: day)
        }
    }

    private func columnTitle(offset: Int, iso: String) -> String {
        if offset == 0 { return "Today" }
        if offset == 1 { return "Tomorrow" }
        guard let date = dexterISOFormatter.date(from: iso) else {
            return iso
        }
        return date.formatted(.dateTime.weekday(.wide))
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            ForEach(columns, id: \.day.date) { column in
                VStack(alignment: .leading, spacing: 8) {
                    DexterTasksHeader(
                        title: column.title,
                        count: column.day.openCount,
                        palette: palette
                    )
                    Divider().overlay(palette.borderColor)
                    // A column fits more rows than WIDGET_TASKS_PER_DAY ever
                    // sends — no slice of its own needed.
                    ForEach(column.day.tasks) { task in
                        DexterTaskRow(task: task, palette: palette)
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                // The `+` overlays only the last column's bottom; without
                // this its final rows would read through the button.
                .padding(.bottom, column.day.date == columns.last?.day.date ? 36 : 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .overlay(alignment: .bottomTrailing) {
            DexterAddTaskButton(palette: palette)
        }
    }
}

// MARK: - Lock screen

/// No palette applied: iOS's vibrant rendering desaturates accessories, so
/// priority reads as brightness only.
private struct DexterTasksAccessoryView: View {
    let day: DexterWidgetDay?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let day, !day.tasks.isEmpty {
                ForEach(Array(day.tasks.prefix(3))) { task in
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Image(systemName: "circle")
                            .font(.system(size: 9))
                        Text(task.title)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                }
            } else {
                // `day` is non-nil only when the snapshot covers today, so an
                // empty list here really is a cleared day.
                Text(dexterAllDone)
                    .font(.caption2)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Widgets

struct DexterTasksWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: "DexterTasksWidget",
            provider: DexterTasksProvider()
        ) { entry in
            DexterTasksWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Your tasks for today, and the days ahead.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .systemLarge,
            .systemExtraLarge,
            .accessoryRectangular,
        ])
    }
}

private struct DexterTasksWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    let entry: DexterTasksEntry

    /// Falls back to the light theme with no snapshot, so "open Dexter" is
    /// still a Dexter surface, not an unpainted rectangle.
    private var palette: DexterWidgetPalette {
        entry.snapshot?.palette(for: colorScheme) ?? dexterFallbackPalette
    }

    private var day: DexterWidgetDay? {
        entry.snapshot?.day(on: entry.isoDate)
    }

    var body: some View {
        content
            // Clear on the lock screen — vibrant rendering would flatten a
            // themed fill into an opaque grey slab anyway.
            .containerBackground(
                family == .accessoryRectangular
                    ? AnyShapeStyle(.clear)
                    : AnyShapeStyle(palette.backgroundColor),
                for: .widget
            )
            .widgetURL(dexterTodayURL)
    }

    @ViewBuilder
    private var content: some View {
        if family == .accessoryRectangular {
            DexterTasksAccessoryView(day: day)
        } else if day == nil {
            // No snapshot, or one aged past its window — "All done!" would
            // be a claim about a day we don't have.
            DexterNoDataView(palette: palette, message: dexterNoTasksMessage)
        } else if family == .systemExtraLarge {
            DexterTasksColumnsView(entry: entry, palette: palette)
        } else {
            DexterTasksListView(
                day: day,
                palette: palette,
                limit: dexterRowLimit(for: family),
                titleLineLimit: dexterTitleLineLimit(for: family),
                showsAddButton: family != .systemSmall
            )
        }
    }
}

/// A separate Widget, not another family on DexterTasksWidget, so a user
/// choosing "the lock screen widget" can pick between list and button.
struct DexterAddTaskWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: "DexterAddTaskWidget",
            provider: DexterAddTaskProvider()
        ) { _ in
            ZStack {
                // strokeBorder insets the line so it stays inside the slot's
                // circular bounds instead of being clipped in half.
                Circle().strokeBorder(lineWidth: 2)
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .semibold))
            }
            .padding(1)
            // Standard translucent disc — without it the glyph floats on
            // bare wallpaper and reads as part of the photo.
            .containerBackground(for: .widget) { AccessoryWidgetBackground() }
            .widgetURL(dexterNewTaskURL)
        }
        .configurationDisplayName("New Task")
        .description("Add a task without unlocking.")
        .supportedFamilies([.accessoryCircular])
    }
}

/// A `+` never changes, so this gets its own provider rather than borrowing
/// DexterTasksProvider — no App Group read, no midnight entries for nothing.
private struct DexterAddTaskEntry: TimelineEntry {
    let date: Date
}

private struct DexterAddTaskProvider: TimelineProvider {
    func placeholder(in context: Context) -> DexterAddTaskEntry {
        DexterAddTaskEntry(date: Date())
    }

    func getSnapshot(
        in context: Context,
        completion: @escaping (DexterAddTaskEntry) -> Void
    ) {
        completion(DexterAddTaskEntry(date: Date()))
    }

    func getTimeline(
        in context: Context,
        completion: @escaping (Timeline<DexterAddTaskEntry>) -> Void
    ) {
        completion(
            Timeline(
                entries: [DexterAddTaskEntry(date: Date())],
                policy: .never
            )
        )
    }
}
