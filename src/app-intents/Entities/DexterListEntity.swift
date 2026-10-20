import AppIntents
internal import ExpoAppIntents

/// An optional "Add task" destination, resolved from the `list` catalog.
struct DexterListEntity: AppEntity {
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
