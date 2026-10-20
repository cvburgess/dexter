import AppIntents
internal import ExpoAppIntents

/// An optional "Add task" destination, resolved from the `list` catalog.
struct DexterListEntity: AppEntity, DexterCatalogEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "List"
    static let defaultQuery = DexterListEntityQuery()

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
