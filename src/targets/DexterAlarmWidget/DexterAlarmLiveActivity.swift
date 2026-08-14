import ActivityKit
import AlarmKit
import SwiftUI
import UIKit
import WidgetKit

// Mirrors the empty metadata struct that `expo-alarm-kit` schedules its alarms
// with (declared as a function-local `struct Meta: AlarmMetadata {}` inside
// `scheduleAlarm`). The simple type name "Meta" is what ActivityKit uses to
// match this widget against the scheduled activity, so it must stay named
// exactly `Meta`.
@available(iOS 26.0, *)
nonisolated struct Meta: AlarmMetadata {
    init() {}
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

// What reads on top of the tint — the `primary`/`primaryContent` pairing the app
// themes itself with, reconstructed here because it cannot be sent.
// `AlarmAttributes` carries exactly one `Color`, and its only other channel,
// `metadata`, has to stay the empty `Meta` that `expo-alarm-kit` schedules. So
// the widget derives the on-colour from the tint's perceived luminance instead,
// which is the job `primaryContent` exists to do: Dexter's light themes pair a
// dark primary with a near-white content colour and its dark themes do the
// reverse, and this lands on the same side of that split for all five.
@available(iOS 26.0, *)
func dexterAlarmOnTint(_ tint: Color) -> Color {
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
                dexterAlarmOnTint(context.attributes.tintColor)
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
        let onTint = dexterAlarmOnTint(attributes.tintColor)

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
