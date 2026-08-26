import Foundation

struct ShareCardPayload: Codable, Equatable {
    struct Card: Codable, Equatable {
        var memberName: String?
        var recoveryLabel: String
        var recoveryScore: Int?
        var sleepDurationMilli: Int?
        var sleepPerformancePercentage: Int?
        var wakeTime: String
        var hrvRmssdMilli: Double?
        var restingHeartRate: Int?
    }

    struct Privacy: Codable, Equatable {
        var expiresAt: String
        var includesRawRecords: Bool
    }

    var generatedAt: String
    var summary: String
    var card: Card
    var privacy: Privacy

    static let preview = ShareCardPayload(
        generatedAt: "2026-08-26T08:00:00.000Z",
        summary: "I'm feeling ready: 82% recovery, 7h 34m sleep, woke up at 7:12 AM.",
        card: Card(
            memberName: "Demo",
            recoveryLabel: "feeling ready",
            recoveryScore: 82,
            sleepDurationMilli: 27_240_000,
            sleepPerformancePercentage: 91,
            wakeTime: "7:12 AM",
            hrvRmssdMilli: 68.4,
            restingHeartRate: 49
        ),
        privacy: Privacy(
            expiresAt: "2026-08-27T08:00:00.000Z",
            includesRawRecords: false
        )
    )

    var sleepDurationText: String {
        guard let sleepDurationMilli = card.sleepDurationMilli else {
            return "--"
        }

        let totalMinutes = Int((Double(sleepDurationMilli) / 60_000).rounded())
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60
        return "\(hours)h \(minutes)m"
    }

    var recoveryText: String {
        guard let recoveryScore = card.recoveryScore else {
            return "--"
        }

        return "\(recoveryScore)%"
    }

    var sleepPerformanceText: String {
        guard let sleepPerformancePercentage = card.sleepPerformancePercentage else {
            return "--"
        }

        return "\(sleepPerformancePercentage)%"
    }
}
