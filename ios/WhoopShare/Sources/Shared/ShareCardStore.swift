import Foundation

enum ShareCardStore {
    static let appGroupIdentifier = "group.com.kanishkkundu.whoopshare"
    private static let payloadKey = "whoopShareCardPayload"

    static func load() -> ShareCardPayload? {
        guard
            let defaults = UserDefaults(suiteName: appGroupIdentifier),
            let data = defaults.data(forKey: payloadKey)
        else {
            return nil
        }

        return try? JSONDecoder().decode(ShareCardPayload.self, from: data)
    }

    static func save(_ payload: ShareCardPayload) throws {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            throw StoreError.appGroupUnavailable
        }

        let data = try JSONEncoder().encode(payload)
        defaults.set(data, forKey: payloadKey)
    }

    static func decodeImportURL(_ url: URL) throws -> ShareCardPayload {
        guard
            url.scheme == "whoopshare",
            url.host == "import",
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let encodedPayload = components.queryItems?.first(where: { $0.name == "payload" })?.value,
            let data = Data(base64URLEncoded: encodedPayload)
        else {
            throw StoreError.invalidImportURL
        }

        return try JSONDecoder().decode(ShareCardPayload.self, from: data)
    }
}

enum StoreError: LocalizedError {
    case appGroupUnavailable
    case invalidImportURL

    var errorDescription: String? {
        switch self {
        case .appGroupUnavailable:
            return "The App Group container is unavailable. Check the App Groups capability on both targets."
        case .invalidImportURL:
            return "The import link did not include a valid WHOOP share-card payload."
        }
    }
}

extension Data {
    init?(base64URLEncoded value: String) {
        var base64 = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        let padding = 4 - base64.count % 4
        if padding < 4 {
            base64.append(String(repeating: "=", count: padding))
        }

        self.init(base64Encoded: base64)
    }
}
