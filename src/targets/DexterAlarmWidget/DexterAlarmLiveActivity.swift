import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

// ActivityKit matches by unqualified type name — must stay `Meta`. The
// fork's own Meta keeps contentColor Optional so old widgets still decode.
@available(iOS 26.0, *)
nonisolated struct Meta: AlarmMetadata {
    let contentColor: String
}

// `scheduleTaskAlarm` passes the task title straight through — read
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

// primaryContent, sent in the alarm's metadata (DEX-158); white is the safe
// default since AlarmKit's `metadata` is Optional.
@available(iOS 26.0, *)
func dexterAlarmOnTint(for attributes: AlarmAttributes<Meta>) -> Color {
    attributes.metadata.flatMap { dexterColor(hex: $0.contentColor) } ?? .white
}

// `ProgressView(timerInterval:)` is driven by the system, not view updates,
// so it animates smoothly with no timeline of our own.
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
        // Static at whatever fraction is left — unreachable for focus blocks,
        // but a snoozed task alarm can land here.
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

// Same self-animating primitive as the ring, laid out flat. Nothing drawn
// for `.alert`/`.paused` — no remaining time to show.
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
            // iOS composites this with its own material, reading as a wash,
            // not a flat swatch. Ignored on the Island/StandBy (always black).
            .activityBackgroundTint(context.attributes.tintColor)
            // Without this, system affordances keep a default contrast a
            // themed background can swallow.
            .activitySystemActionForegroundColor(
                dexterAlarmOnTint(for: context.attributes)
            )
        } dynamicIsland: { context in
            let title = dexterAlarmTitle(for: context.attributes)
            let tint = context.attributes.tintColor
            return DynamicIsland {
                // Expanded keeps the readable figures; the ring lives in the
                // slots too small to print them.
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
                // No glyph — iOS already attributes the activity to Dexter.
                Text(dexterAlarmTitle(for: attributes))
                    .font(.headline)
                    .foregroundStyle(onTint)
                    .lineLimit(2)
                    // Let the title take the slack so it truncates only at
                    // the countdown, not clipped early by a Spacer.
                    .frame(maxWidth: .infinity, alignment: .leading)

                dexterAlarmCountdown(state: state)
                    .font(.system(size: 40, weight: .light, design: .rounded))
                    .foregroundStyle(onTint)
                    .lineLimit(1)
                    .multilineTextAlignment(.trailing)
                    .minimumScaleFactor(0.6)
                    .frame(width: 112, alignment: .trailing)
            }

            // The bar says "roughly half way" where the numerals say "12:04".
            // Only a timer has a countdown to draw.
            dexterAlarmProgressBar(state: state, tint: onTint)
        }
        .padding(16)
    }
}
