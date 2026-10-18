import AppIntents
internal import ExpoAppIntents

/// An open task, offered to Siri and Shortcuts as a "Complete task" parameter.
/// Values come from the `task` catalog JavaScript publishes via
/// `setEntityCatalogAsync("task", ...)`; subtitle carries the list name to
/// disambiguate like-titled tasks.
struct DexterTaskEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Task"
    static let defaultQuery = DexterTaskEntityQuery()

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

    func matches(_ searchText: String) -> Bool {
        let normalized = dexterIntentNormalize(searchText)
        guard !normalized.isEmpty else { return false }
        let terms = ([id, displayTitle] + (subtitle.map { [$0] } ?? [])).map(
            dexterIntentNormalize
        )
        return terms.contains { term in
            normalized == term
                || normalized.contains(term)
                || term.contains(normalized)
        }
    }
}
