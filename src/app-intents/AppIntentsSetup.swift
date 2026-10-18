internal import ExpoAppIntents
internal import ExpoModulesCore

/// Registered Expo inline module that wires app-target App Intents code to
/// expo-app-intents. Do not change the name of this class.
final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("AppIntentsSetup")
    OnCreate {
      // Siri resolves a shortcut phrase's parameters against the values it
      // was last given, so poking the provider whenever JS republishes a
      // catalog keeps phrases like "Add <task> to Dexter" current.
      Task {
        await AppIntentDispatcher.shared.setShortcutsRefreshHandler {
          AppShortcuts.updateAppShortcutParameters()
        }
        AppShortcuts.updateAppShortcutParameters()
      }
      if #available(iOS 18.0, macOS 15.0, *) {
        // Spotlight indexing for the task/habit entities (registerIndexed) and
        // the intent donations that drive Siri suggestions. gated for
        // Catalyst, where the APIs arrived a release later.
        AppEntityIdentifierRegistry.shared.registerIndexed(
          "task",
          as: DexterTaskEntity.self
        )
        AppEntityIdentifierRegistry.shared.registerIndexed(
          "habit",
          as: DexterHabitEntity.self
        )
        AppIntentDonationRegistry.shared.register("addTask", as: AddTaskIntent.self)
        AppIntentDonationRegistry.shared.register(
          "completeTask",
          as: CompleteTaskIntent.self
        )
      }
    }
  }
}
