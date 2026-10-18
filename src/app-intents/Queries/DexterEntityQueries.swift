import AppIntents
internal import ExpoAppIntents

/// Rebuild entities from the JS-published catalog for a kind, fuzzy-matching
/// a spoken value against id/title/subtitle; empty until the app first runs.

struct DexterTaskEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [DexterTaskEntity] {
        try await AppIntentEntityStore.shared.entities(
            ofKind: "task",
            matching: identifiers
        ).map(DexterTaskEntity.init(record:))
    }

    func suggestedEntities() async throws -> [DexterTaskEntity] {
        try await AppIntentEntityStore.shared.entities(ofKind: "task")
            .map(DexterTaskEntity.init(record:))
    }

    func entities(matching string: String) async throws -> [DexterTaskEntity] {
        try await suggestedEntities().filter { $0.matches(string) }
    }
}

struct DexterHabitEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [DexterHabitEntity] {
        try await AppIntentEntityStore.shared.entities(
            ofKind: "habit",
            matching: identifiers
        ).map(DexterHabitEntity.init(record:))
    }

    func suggestedEntities() async throws -> [DexterHabitEntity] {
        try await AppIntentEntityStore.shared.entities(ofKind: "habit")
            .map(DexterHabitEntity.init(record:))
    }

    func entities(matching string: String) async throws -> [DexterHabitEntity] {
        try await suggestedEntities().filter { $0.matches(string) }
    }
}

struct DexterListEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [DexterListEntity] {
        try await AppIntentEntityStore.shared.entities(
            ofKind: "list",
            matching: identifiers
        ).map(DexterListEntity.init(record:))
    }

    func suggestedEntities() async throws -> [DexterListEntity] {
        try await AppIntentEntityStore.shared.entities(ofKind: "list")
            .map(DexterListEntity.init(record:))
    }

    func entities(matching string: String) async throws -> [DexterListEntity] {
        try await suggestedEntities().filter { $0.matches(string) }
    }
}
