import AppIntents
internal import ExpoModulesCore
internal import ExpoAppIntents

// DonatableAppIntent lets JavaScript tell the system "the user just did this
// in the app" so Siri can suggest it later. The registered name must match the
// one useTasks' mutations pass to donateIntentAsync().

extension AddTaskIntent: DonatableAppIntent {
    struct DonationParams: Record {
        @Field(.required) var title: String = ""
    }

    init(donationParams: DonationParams) {
        self.init()
        self.taskTitle = donationParams.title
    }
}

extension CompleteTaskIntent: DonatableAppIntent {
    struct DonationParams: Record {
        @Field(.required) var taskId: String = ""
        @Field(.required) var taskTitle: String = ""
    }

    init(donationParams: DonationParams) {
        self.init()
        self.task = DexterTaskEntity(
            record: AppIntentEntityRecord(
                id: donationParams.taskId,
                title: donationParams.taskTitle,
                subtitle: nil
            )
        )
    }
}
