import ActivityKit
import AlarmKit
import SwiftUI
import UIKit
import WidgetKit

// Mirrors the metadata struct that `expo-alarm-kit` schedules its alarms with.
// The simple type name "Meta" is what ActivityKit uses to match this widget
// against the scheduled activity — `String(describing:)` erases the module and
// any enclosing context — so it must stay named exactly `Meta` on both sides.
//
// `contentColor` must stay Optional. Swift synthesises `decodeIfPresent` for an
// Optional stored property, which is what lets this decode an alarm scheduled by
// a build that predates the field. A non-Optional property with a default value
// does *not* get that treatment: synthesised `Decodable` ignores the default and
// throws, and a throw here is a lock screen that renders nothing.
@available(iOS 26.0, *)
nonisolated struct Meta: AlarmMetadata {
    let contentColor: String?
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

// What reads on top of the tint: the reader's real `primaryContent`, sent in the
// alarm's `metadata` (DEX-158).
//
// The fallback is for alarms scheduled by a build that predates that field —
// they decode to `nil` rather than failing, and get the luminance derivation
// that used to be the only option. Every newly scheduled alarm takes the token,
// so this converges as old alarms fire or are replaced. It cannot be deleted
// while an alarm scheduled by an older build can still be pending.
@available(iOS 26.0, *)
func dexterAlarmOnTint(for attributes: AlarmAttributes<Meta>) -> Color {
    if let hex = attributes.metadata?.contentColor,
       let sent = dexterAlarmColor(hex: hex) {
        return sent
    }
    return dexterAlarmDerivedOnTint(attributes.tintColor)
}

// `#rrggbb`, matching what the module parses on the way in. Anything else is
// treated as absent so a malformed value falls back rather than rendering black.
@available(iOS 26.0, *)
func dexterAlarmColor(hex: String) -> Color? {
    var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if value.hasPrefix("#") { value.removeFirst() }
    guard value.count == 6, let rgb = UInt64(value, radix: 16) else { return nil }
    return Color(
        red: Double((rgb & 0xFF0000) >> 16) / 255.0,
        green: Double((rgb & 0x00FF00) >> 8) / 255.0,
        blue: Double(rgb & 0x0000FF) / 255.0
    )
}

// The pre-DEX-158 reconstruction: Dexter's light themes pair a dark primary with
// a near-white content colour and its dark themes do the reverse, so luma lands
// on the correct side of that split for all five. It is only ever an
// approximation of the token — Dexter resolves to white rather than `#c3ffcf`,
// abyss to black rather than `#427600`.
@available(iOS 26.0, *)
func dexterAlarmDerivedOnTint(_ tint: Color) -> Color {
    let components = UIColor(tint).cgColor.components ?? []
    guard components.count >= 3 else { return .white }
    // Rec. 601 luma — perceived brightness, not the raw average, or a saturated
    // green reads as darker than it looks.
    let luma = 0.299 * components[0] + 0.587 * components[1] + 0.114 * components[2]
    return luma > 0.6 ? .black : .white
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
