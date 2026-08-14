import SwiftUI
import WidgetKit

// Every Dexter widget lives in this one extension. The target keeps its
// alarm-era name and bundle id on purpose: it shipped in v2.0.0, a second
// target would mean a second extension bundle id and provisioning profile, and
// the widget gallery groups by app and labels each entry with its own
// `configurationDisplayName` — so splitting them would buy nothing a user sees.
@main
struct DexterAlarmWidgetBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        // Today's tasks on the home screen and the lock screen (DEX-83). No
        // availability gate: the deployment target is already 26.1.
        DexterTasksWidget()
        DexterAddTaskWidget()

        if #available(iOS 26.0, *) {
            DexterAlarmLiveActivity()
        }
    }
}
