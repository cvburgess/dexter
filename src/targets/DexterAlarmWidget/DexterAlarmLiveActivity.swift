import ActivityKit
import AlarmKit
import SwiftUI
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

@available(iOS 26.0, *)
struct DexterAlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<Meta>.self) { context in
            DexterAlarmLockScreenView(
                attributes: context.attributes,
                state: context.state
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
        HStack(alignment: .center, spacing: 12) {
            // No glyph here on purpose: the row is a task title next to its own
            // countdown, and iOS already attributes the activity to Dexter in the
            // chrome around it. The Dynamic Island keeps one, because its compact
            // and minimal slots have nowhere to put words.
            Text(dexterAlarmTitle(for: attributes))
                .font(.headline)
                .foregroundStyle(.primary)
                .lineLimit(2)
                // Let the title take the slack so it truncates only when it
                // reaches the countdown, instead of a Spacer clipping it early.
                .frame(maxWidth: .infinity, alignment: .leading)

            dexterAlarmCountdown(state: state)
                .font(.system(size: 40, weight: .light, design: .rounded))
                .foregroundStyle(attributes.tintColor)
                .lineLimit(1)
                .multilineTextAlignment(.trailing)
                .minimumScaleFactor(0.6)
                .frame(width: 112, alignment: .trailing)
        }
        .padding(16)
    }
}
