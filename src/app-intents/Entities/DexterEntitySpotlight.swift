import AppIntents
@preconcurrency import CoreSpotlight
internal import ExpoAppIntents

// Spotlight: registered via `registerIndexed` in AppIntentsSetup, so
// setEntityCatalogAsync keeps the index in step with the task/habit catalogs.

@available(iOS 18.0, macOS 15.0, *)
extension DexterTaskEntity: AppIntentEntityRecordConvertible {}

@available(iOS 18.0, macOS 15.0, *)
extension DexterTaskEntity: IndexedEntity {
    static let spotlightDomainIdentifier = "com.dexterplanner.task"

    var attributeSet: CSSearchableItemAttributeSet {
        let attributes = defaultAttributeSet
        attributes.displayName = displayTitle
        attributes.contentDescription = subtitle ?? displayTitle
        attributes.keywords = ["task", displayTitle]
        attributes.userCreated = true
        attributes.domainIdentifier = Self.spotlightDomainIdentifier
        return attributes
    }
}

@available(iOS 18.0, macOS 15.0, *)
extension DexterHabitEntity: AppIntentEntityRecordConvertible {}

@available(iOS 18.0, macOS 15.0, *)
extension DexterHabitEntity: IndexedEntity {
    static let spotlightDomainIdentifier = "com.dexterplanner.habit"

    var attributeSet: CSSearchableItemAttributeSet {
        let attributes = defaultAttributeSet
        attributes.displayName = displayTitle
        attributes.contentDescription = subtitle ?? displayTitle
        attributes.keywords = ["habit", displayTitle]
        attributes.userCreated = true
        attributes.domainIdentifier = Self.spotlightDomainIdentifier
        return attributes
    }
}
