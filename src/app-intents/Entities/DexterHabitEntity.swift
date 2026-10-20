import AppIntents
internal import ExpoAppIntents

/// A habit, the "Log habit step" parameter. Values come from the `habit`
/// catalog; the subtitle carries the emoji for spoken disambiguation.
struct DexterHabitEntity: AppEntity, DexterCatalogEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Habit"
    static let defaultQuery = DexterHabitEntityQuery()

    var id: String
    var displayTitle: String
    var subtitle: String?

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(displayTitle)",
            subtitle: subtitle.map { "\($0)" }
        )
    }

    init(record: AppIntentEntityRecord) {
        id = record.id
        displayTitle = record.title
        subtitle = record.subtitle
    }
}
