import AppIntents
internal import ExpoAppIntents

/// All three query implementations share this shape: read the catalog
/// JavaScript published under the kind, rebuild entities from its records, and
/// fuzzy-match a spoken value against id/title/subtitle. The catalogs start
/// empty until the app has run and published, so Siri offers nothing (and the
/// parameterized shortcuts cannot run) before the first launch.

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
