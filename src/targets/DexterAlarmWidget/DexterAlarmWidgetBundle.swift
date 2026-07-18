import SwiftUI
import WidgetKit

@main
struct DexterAlarmWidgetBundle: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        if #available(iOS 26.0, *) {
            DexterAlarmLiveActivity()
        }
    }
}
