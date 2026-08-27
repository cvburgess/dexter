import SwiftUI
import WidgetKit

// Every Dexter widget lives in this one extension. It keeps its alarm-era
// name on purpose — splitting it would buy nothing a user sees.
@main
struct DexterAlarmWidgetBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        // Today's tasks on the home screen and the lock screen (DEX-83). No
        // availability gate: the deployment target is already 26.1.
        DexterTasksWidget()
        DexterAddTaskWidget()

        // Today's habits, home screen only, with tappable rings (DEX-160).
        DexterHabitsWidget()

        if #available(iOS 26.0, *) {
            DexterAlarmLiveActivity()
        }
    }
}
