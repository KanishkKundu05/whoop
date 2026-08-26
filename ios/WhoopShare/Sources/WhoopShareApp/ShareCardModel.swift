import Foundation

@MainActor
final class ShareCardModel: ObservableObject {
    @Published private(set) var payload: ShareCardPayload?
    @Published var statusMessage: String = "Open the Vercel setup page, authenticate WHOOP, then tap Open in app."

    let setupURL = URL(string: "https://whoop-delta-sable.vercel.app/imessage")!

    init() {
        payload = ShareCardStore.load()
        if payload != nil {
            statusMessage = "WHOOP share card is ready for Messages."
        }
    }

    func importPayload(from url: URL) {
        do {
            let importedPayload = try ShareCardStore.decodeImportURL(url)
            try ShareCardStore.save(importedPayload)
            payload = importedPayload
            statusMessage = "Imported latest WHOOP share card. Open Messages and use the Whoop Share app."
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}
