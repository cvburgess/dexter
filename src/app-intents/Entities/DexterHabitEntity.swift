import AppIntents
internal import ExpoAppIntents

/// A habit, offered to Siri and Shortcuts as the "Log habit step" parameter.
/// Values come from the `habit` catalog JavaScript publishes; subtitle carries
/// the emoji so a spoken name is disambiguated by what the user sees.
struct DexterHabitEntity: AppEntity {
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
