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
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(title)
                            .font(.headline)
                            .lineLimit(1)
                    } icon: {
                        Image(systemName: "alarm.fill")
                            .foregroundStyle(context.attributes.tintColor)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    dexterAlarmCountdown(state: context.state)
                        .font(.system(size: 28, design: .rounded))
                        .foregroundStyle(context.attributes.tintColor)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            } compactLeading: {
                Image(systemName: "alarm.fill")
                    .foregroundStyle(context.attributes.tintColor)
            } compactTrailing: {
                dexterAlarmCountdown(state: context.state)
                    .foregroundStyle(context.attributes.tintColor)
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 56, alignment: .trailing)
            } minimal: {
                Image(systemName: "alarm.fill")
                    .foregroundStyle(context.attributes.tintColor)
            }
            .keylineTint(context.attributes.tintColor)
        }
    }
}

@available(iOS 26.0, *)
struct DexterAlarmLockScreenView: View {
    let attributes: AlarmAttributes<Meta>
    let state: AlarmPresentationState

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Label {
                Text(dexterAlarmTitle(for: attributes))
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
            } icon: {
                Image(systemName: "alarm.fill")
                    .foregroundStyle(attributes.tintColor)
            }
            // Let the title take the slack so it truncates only when it reaches
            // the countdown, instead of a Spacer clipping it early.
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
