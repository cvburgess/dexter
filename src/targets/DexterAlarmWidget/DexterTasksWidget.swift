import SwiftUI
import WidgetKit

// The home screen and lock screen surfaces for today's tasks (DEX-83). Every
// view here reads a snapshot the app published into the App Group — see
// `DexterWidgetSnapshot.swift`. Nothing fetches, and nothing writes: taps are
// deep links, so completing a task still goes through the app, where the
// subtask sweep and the recurrence spawn live.

/// Where a tap lands. `/today` needs no `date` param — the tab opens on the
/// current day by itself, and passing one would make a repeat tap a no-op link
/// rather than a plain "go to Today".
///
/// Force-unwrapped because both are literals this file owns: if either stops
/// parsing it is a typo made here, and a widget that silently stopped opening
/// the app would be far harder to notice than a crash on the first build.
private let dexterTodayURL = URL(string: "dexter:///today")!
private let dexterNewTaskURL = URL(string: "dexter:///new-task")!

/// Copy for the day the user has cleared, verbatim from DEX-83. Not shown for
/// an empty column in the extra-large widget, where three blank columns of it
/// would drown the one day that has work in it.
private let dexterAllDone = "All done! No more tasks today"

// MARK: - Timeline

struct DexterTasksEntry: TimelineEntry {
    let date: Date
    let snapshot: DexterWidgetSnapshot?

    /// The local day this entry stands for, as the ISO string the payload keys
    /// on. Derived from `date` rather than from "now" so an entry scheduled for
    /// a future midnight renders that day when it comes up.
    var isoDate: String {
        DexterTasksEntry.isoFormatter.string(from: date)
    }

    /// `yyyy-MM-dd` in the device's own calendar and time zone, matching what
    /// `Temporal.PlainDate` produced on the JS side. Pinned to `en_US_POSIX`
    /// because a locale with a non-Gregorian calendar would otherwise format
    /// digits and eras the payload never uses.
    static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

/// One entry for now, then one at each upcoming local midnight the snapshot
/// still covers.
///
/// This is what makes the rollover cost nothing. The payload carries four days,
/// so a widget can advance through them unattended: at 00:00 WidgetKit swaps to
/// the next entry, which re-slices the same snapshot to the new day. A user who
/// plans tomorrow tonight sees tomorrow on the lock screen in the morning
/// without the app being opened, without a background task, and without a timer
/// in JS. `.atEnd` then asks for a fresh timeline once the days run out, at
/// which point `day(on:)` finds nothing and the empty state takes over.
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

        let calendar = Calendar.current
        var midnight = calendar.startOfDay(for: now)
        // One entry per remaining day in the payload. Bounded by the snapshot's
        // own length rather than a constant, so shortening the window on the JS
        // side can't leave this scheduling entries for days that aren't there.
        let remaining = max(0, (snapshot?.days.count ?? 1) - 1)
        for _ in 0..<remaining {
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

/// A task's open circle, stroked in its priority accent — the one thing DEX-83
/// asks for by name. Sized off the font so it keeps its relationship to the
/// title as the accessory families shrink the type.
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

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            DexterTaskCircle(color: palette.color(for: task.priority))
                // A circle has no baseline of its own, so it aligns to the top
                // of the row and drifts up off a two-line title without this.
                .alignmentGuide(.firstTextBaseline) { $0.height * 0.8 }
            Text(task.title)
                .font(font)
                .foregroundStyle(palette.textColor)
                .lineLimit(2)
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
                    // `textSecondary` is an `rgba()` string the payload can't
                    // carry, so the dimmed ink is derived here at the same 0.6
                    // the theme uses.
                    .foregroundStyle(palette.textColor.opacity(0.6))
            }
            Spacer(minLength: 0)
        }
    }
}

/// The `+` on the medium, large, and extra-large families.
///
/// A `Link` is why it exists only there: WidgetKit routes taps per element from
/// `.systemMedium` up, while `.systemSmall` and the accessories have one target
/// for the whole widget. That platform rule is exactly why DEX-83 gives the
/// small widget no button rather than it being an omission.
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

/// Shown when there is no snapshot at all: signed out, or the app has not run
/// since this widget was added. Distinct from "All done!", which is a real
/// answer about a real day.
private struct DexterNoDataView: View {
    let palette: DexterWidgetPalette

    var body: some View {
        Text("Open Dexter to see today's tasks")
            .font(.caption)
            .foregroundStyle(palette.textColor.opacity(0.6))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Home screen

/// The small / medium / large layout: heading, then as many rows as the family
/// has room for, then the `+` where taps can reach it.
private struct DexterTasksListView: View {
    let day: DexterWidgetDay?
    let palette: DexterWidgetPalette
    let limit: Int
    let showsAddButton: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            DexterTasksHeader(
                title: "Today",
                count: day?.openCount ?? 0,
                palette: palette
            )

            if let day, !day.tasks.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(day.tasks.prefix(limit))) { task in
                        DexterTaskRow(task: task, palette: palette)
                            // Keeps a long title from running under the `+`,
                            // which overlays this corner rather than taking a
                            // row of its own.
                            .padding(.trailing, showsAddButton ? 34 : 0)
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

/// The extra-large iPad layout: today and the next three days as columns.
///
/// An empty column stays blank rather than repeating "All done!" — DEX-83 asks
/// for that, and four copies of the same sentence would read as an error state
/// rather than as a clear week.
private struct DexterTasksColumnsView: View {
    let entry: DexterTasksEntry
    let palette: DexterWidgetPalette

    private var columns: [(title: String, day: DexterWidgetDay?)] {
        guard let snapshot = entry.snapshot,
              let start = snapshot.days.firstIndex(where: {
                  $0.date >= entry.isoDate
              })
        else { return [] }

        // Sliced from the entry's own day rather than from the payload's first
        // element: an entry scheduled for a future midnight has to start its
        // columns there, or day two would still be headed "Today".
        return snapshot.days[start...].enumerated().map { offset, day in
            (title: columnTitle(offset: offset, iso: day.date), day: day)
        }
    }

    private func columnTitle(offset: Int, iso: String) -> String {
        if offset == 0 { return "Today" }
        if offset == 1 { return "Tomorrow" }
        guard let date = DexterTasksEntry.isoFormatter.date(from: iso) else {
            return iso
        }
        return date.formatted(.dateTime.weekday(.wide))
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            ForEach(columns, id: \.title) { column in
                VStack(alignment: .leading, spacing: 8) {
                    DexterTasksHeader(
                        title: column.title,
                        count: column.day?.openCount ?? 0,
                        palette: palette
                    )
                    Divider().overlay(palette.borderColor)
                    ForEach(Array((column.day?.tasks ?? []).prefix(9))) { task in
                        DexterTaskRow(task: task, palette: palette)
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .overlay(alignment: .bottomTrailing) {
            DexterAddTaskButton(palette: palette)
        }
    }
}

// MARK: - Lock screen

/// Up to three of today's tasks.
///
/// No palette is applied: iOS renders lock screen accessories in
/// `WidgetRenderingMode.vibrant`, desaturating the whole view to monochrome, so
/// a priority hex would land as a shade of the wallpaper's tint no matter what
/// we sent. The circles still carry priority as *brightness*; that is the
/// platform, not something to work around.
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
                // `day` is non-nil only when the snapshot actually covers
                // today, so an empty list here really is a cleared day — the
                // caller routes the no-data case away before it reaches this
                // view.
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

    /// The palette this widget draws with, or the app's own light theme when
    /// there is no snapshot — so the "open Dexter" state is still a Dexter
    /// surface rather than an unpainted rectangle.
    private var palette: DexterWidgetPalette {
        entry.snapshot?.palette(for: colorScheme) ?? dexterFallbackPalette
    }

    private var day: DexterWidgetDay? {
        entry.snapshot?.day(on: entry.isoDate)
    }

    var body: some View {
        content
            // Clear on the lock screen, where a widget is meant to float on the
            // wallpaper — and where `vibrant` rendering would flatten a themed
            // fill into an opaque grey slab anyway.
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
            // No snapshot, or one that has aged past its four-day window with
            // the app never opened. Both mean we have nothing to say about
            // today — and saying "All done!" here would be a claim about a day
            // we don't have, on a surface the user reads *instead of* opening
            // the app.
            DexterNoDataView(palette: palette)
        } else if family == .systemExtraLarge {
            DexterTasksColumnsView(entry: entry, palette: palette)
        } else {
            // Row counts are what each family fits beneath the heading with the
            // `+` clear of the last row; tuned on device.
            DexterTasksListView(
                day: day,
                palette: palette,
                limit: family == .systemLarge ? 9 : 4,
                showsAddButton: family != .systemSmall
            )
        }
    }
}

/// The `+` on its own, for the lock screen.
///
/// A second `Widget` rather than another family on `DexterTasksWidget`: the two
/// occupy the same kind of slot, so a user picking "the Dexter lock screen
/// widget" has to be able to choose between a list and a button. Declaring only
/// the circular family keeps it out of the home screen gallery, where the `+`
/// already lives inside the list widget.
struct DexterAddTaskWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: "DexterAddTaskWidget",
            provider: DexterAddTaskProvider()
        ) { _ in
            ZStack {
                // The ring is what makes the glyph read as a button rather than
                // as a mark on the wallpaper. `strokeBorder` insets the line so
                // it stays inside the slot's circular bounds instead of being
                // clipped in half by them.
                Circle().strokeBorder(lineWidth: 2)
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .semibold))
            }
            .padding(1)
            // The standard translucent disc behind a circular complication.
            // Without it the glyph floats on bare wallpaper and reads as part
            // of the photo rather than as a button.
            .containerBackground(for: .widget) { AccessoryWidgetBackground() }
            .widgetURL(dexterNewTaskURL)
        }
        .configurationDisplayName("New Task")
        .description("Add a task without unlocking.")
        .supportedFamilies([.accessoryCircular])
    }
}

/// A `+` never changes, so this widget has nothing to schedule. It gets its own
/// provider rather than borrowing `DexterTasksProvider` so it neither reads the
/// App Group nor books midnight entries against the reload budget for a glyph
/// that would look identical at every one of them.
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

/// The `dexter` theme, the app's own default light palette. Only reached when
/// no snapshot exists, so it paints the empty state and nothing else.
private let dexterFallbackPalette = DexterWidgetPalette(
    background: "#fffbf4",
    border: "#e0d5c2",
    text: "#593d31",
    primary: "#00674f",
    priority: ["#fcb700", "#ff627d", "#00bafe", "#fffbf4", "#593d31"]
)
