import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

// Mirrors the metadata struct that `expo-alarm-kit` schedules its alarms with.
// The simple type name "Meta" is what ActivityKit uses to match this widget
// against the scheduled activity — `String(describing:)` erases the module and
// any enclosing context — so it must stay named exactly `Meta` on both sides.
//
// `contentColor` is non-Optional because every alarm Dexter schedules carries
// one: `TAlarmColors` cannot be built without it, and `primaryContent` is a
// required field on the palette, so there is no theme that omits it. Decoding it
// as required makes a metadata shape we didn't write a loud failure rather than a
// silently wrong colour.
//
// The fork's own `Meta` keeps it Optional, and must — that is what lets a widget
// whose `Meta` predates the field keep decoding (MMK-452).
@available(iOS 26.0, *)
nonisolated struct Meta: AlarmMetadata {
    let contentColor: String
}

// `expo-alarm-kit` exposes a single `title` string, and `scheduleTaskAlarm`
// passes the task title straight through, so there's nothing to unpack — read
// whichever presentation is active.
@available(iOS 26.0, *)
func dexterAlarmTitle(for attributes: AlarmAttributes<Meta>) -> String {
    if let countdownTitle = attributes.presentation.countdown?.title {
        return String(localized: countdownTitle)
    }
    return String(localized: attributes.presentation.alert.title)
}

// The trailing time readout: a live-updating countdown while the alarm is
// pending, and "Now" once it fires.
@available(iOS 26.0, *)
@ViewBuilder
func dexterAlarmCountdown(state: AlarmPresentationState) -> some View {
    switch state.mode {
    case .countdown(let countdown):
        Text(timerInterval: Date.now ... countdown.fireDate, countsDown: true)
            .monospacedDigit()
    case .paused(let paused):
        let remaining =
            paused.totalCountdownDuration - paused.previouslyElapsedDuration
        Text(dexterAlarmFormat(remaining))
            .monospacedDigit()
    case .alert:
        Text("Now")
    @unknown default:
        EmptyView()
    }
}

func dexterAlarmFormat(_ seconds: TimeInterval) -> String {
    let total = max(0, Int(seconds))
    return String(format: "%d:%02d", total / 60, total % 60)
}

// What reads on top of the tint: the reader's `primaryContent`, sent in the
// alarm's `metadata` (DEX-158). Nothing is derived here — the app sends both
// halves of the pair it themes itself with.
//
// `AlarmAttributes.metadata` is Optional in AlarmKit's own API, so the type
// forces a default even though Dexter always schedules one. White is the safe
// end of that branch: the card is a translucent wash of `primary`, and every
// Dexter theme pairs it with light content except the two whose primary is a
// near-fluorescent green.
@available(iOS 26.0, *)
func dexterAlarmOnTint(for attributes: AlarmAttributes<Meta>) -> Color {
    attributes.metadata.flatMap { dexterAlarmColor(hex: $0.contentColor) } ?? .white
}

// `#rrggbb`, matching what the module parses on the way in. Every value that
// reaches this is a `primaryContent` token, so the nil path is unreachable in
// practice — it exists so a malformed string falls back rather than scanning to
// black, which `Scanner.scanHexInt64` would do silently.
@available(iOS 26.0, *)
func dexterAlarmColor(hex: String) -> Color? {
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

// The depleting ring the Clock app shows, filling every Dynamic Island slot that
// would otherwise hold a glyph. `ProgressView(timerInterval:)` is driven by the
// system rather than by view updates, so it animates smoothly in a Live Activity
// with no timeline of our own — the reason this is a few lines instead of a
// TimelineProvider.
@available(iOS 26.0, *)
@ViewBuilder
func dexterAlarmRing(state: AlarmPresentationState, tint: Color) -> some View {
    switch state.mode {
    case .countdown(let countdown):
        ProgressView(
            timerInterval: countdown.startDate...countdown.fireDate,
            countsDown: true
        )
        .progressViewStyle(.circular)
        .labelsHidden()
        .tint(tint)
    case .paused(let paused):
        // No dates to interpolate between while held, so the ring is static at
        // whatever fraction is left. Unreachable for focus blocks — they are
        // scheduled with no paused presentation — but a snoozed task alarm can
        // land here.
        ProgressView(
            value: max(0, paused.totalCountdownDuration - paused.previouslyElapsedDuration),
            total: max(1, paused.totalCountdownDuration)
        )
        .progressViewStyle(.circular)
        .labelsHidden()
        .tint(tint)
    case .alert:
        Image(systemName: "bell.fill")
            .foregroundStyle(tint)
    @unknown default:
        EmptyView()
    }
}

// The lock screen's own progress indicator. Same self-animating primitive as the
// ring, laid out flat — a bar reads as elapsed-of-total at a glance where a ring
// that size would just be a decoration.
//
// Nothing is drawn for `.alert` or `.paused`: a ringing alarm has no remaining
// time to show, and a task alarm has no countdown presentation at all, so the
// row above stands on its own.
@available(iOS 26.0, *)
@ViewBuilder
func dexterAlarmProgressBar(state: AlarmPresentationState, tint: Color) -> some View {
    if case .countdown(let countdown) = state.mode {
        ProgressView(
            timerInterval: countdown.startDate...countdown.fireDate,
            countsDown: true
        )
        .progressViewStyle(.linear)
        .labelsHidden()
        .tint(tint)
    }
}

@available(iOS 26.0, *)
struct DexterAlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<Meta>.self) { context in
            DexterAlarmLockScreenView(
                attributes: context.attributes,
                state: context.state
            )
            // iOS *composites* this with its own material rather than filling a
            // rectangle with it, so the card reads as a translucent wash of the
            // theme's primary, not a flat swatch. Ignored on the Dynamic Island
            // and in StandBy, both of which are always black — the lock screen
            // carrying colour while the Island stays dark is the platform, not
            // an inconsistency to chase.
            .activityBackgroundTint(context.attributes.tintColor)
            // The system draws its own affordances over the card; without this
            // they keep a default contrast that a themed background can swallow.
            .activitySystemActionForegroundColor(
                dexterAlarmOnTint(for: context.attributes)
            )
        } dynamicIsland: { context in
            let title = dexterAlarmTitle(for: context.attributes)
            let tint = context.attributes.tintColor
            return DynamicIsland {
                // Expanded keeps the readable figures; the ring lives in the
                // slots too small to print them, which is how the Clock app
                // splits it too.
                DynamicIslandExpandedRegion(.leading) {
                    Text(title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    dexterAlarmCountdown(state: context.state)
                        .font(.system(size: 28, design: .rounded))
                        .foregroundStyle(tint)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            } compactLeading: {
                dexterAlarmRing(state: context.state, tint: tint)
            } compactTrailing: {
                dexterAlarmCountdown(state: context.state)
                    .foregroundStyle(tint)
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 56, alignment: .trailing)
            } minimal: {
                dexterAlarmRing(state: context.state, tint: tint)
            }
            .keylineTint(tint)
        }
    }
}

@available(iOS 26.0, *)
struct DexterAlarmLockScreenView: View {
    let attributes: AlarmAttributes<Meta>
    let state: AlarmPresentationState

    var body: some View {
        let onTint = dexterAlarmOnTint(for: attributes)

        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                // No glyph here on purpose: the row is a task title next to its
                // own countdown, and iOS already attributes the activity to
                // Dexter in the chrome around it. The Dynamic Island keeps one,
                // because its compact and minimal slots have nowhere for words.
                Text(dexterAlarmTitle(for: attributes))
                    .font(.headline)
                    .foregroundStyle(onTint)
                    .lineLimit(2)
                    // Let the title take the slack so it truncates only when it
                    // reaches the countdown, instead of a Spacer clipping it
                    // early.
                    .frame(maxWidth: .infinity, alignment: .leading)

                dexterAlarmCountdown(state: state)
                    .font(.system(size: 40, weight: .light, design: .rounded))
                    .foregroundStyle(onTint)
                    .lineLimit(1)
                    .multilineTextAlignment(.trailing)
                    .minimumScaleFactor(0.6)
                    .frame(width: 112, alignment: .trailing)
            }

            // The bar says "roughly half way" where the numerals say "12:04" —
            // the thing a glance actually wants, and the reason it earns the
            // space a glyph used to take. Only a timer has a countdown to draw,
            // so a task alarm keeps the row above and nothing else.
            dexterAlarmProgressBar(state: state, tint: onTint)
        }
        .padding(16)
    }
}
