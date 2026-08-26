import AuthenticationServices
import Foundation
import UIKit

@MainActor
final class ShareCardModel: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published private(set) var payload: ShareCardPayload?
    @Published var statusMessage: String = "Refresh from WHOOP, then send the card from the Messages app drawer."
    @Published private(set) var isRefreshing = false

    let setupURL = URL(string: "https://whoop-delta-sable.vercel.app/imessage")!
    private let authURL = URL(string: "https://whoop-delta-sable.vercel.app/api/auth/whoop?next=/api/whoop/mobile-import")!
    private var authSession: ASWebAuthenticationSession?

    override init() {
        payload = ShareCardStore.load()
        super.init()
        if payload != nil {
            statusMessage = "WHOOP share card is ready for Messages."
        }
    }

    func importPayload(from url: URL) {
        if let errorMessage = importErrorMessage(from: url) {
            statusMessage = errorMessage
            return
        }

        do {
            let importedPayload = try ShareCardStore.decodeImportURL(url)
            try ShareCardStore.save(importedPayload)
            payload = importedPayload
            statusMessage = "Imported latest WHOOP share card. Open Messages and use the Whoop Share app."
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func importErrorMessage(from url: URL) -> String? {
        guard url.scheme == "whoopshare", url.host == "import-error" else {
            return nil
        }

        let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "code" })?
            .value

        switch code {
        case "not_connected":
            return "WHOOP is not connected yet. Try Refresh from WHOOP again and complete sign-in."
        case "session_expired":
            return "The WHOOP session expired. Connect WHOOP again."
        case "refresh_failed":
            return "WHOOP token refresh failed. Connect WHOOP again."
        default:
            return "The WHOOP share-card import failed."
        }
    }

    func refreshFromWhoop() {
        isRefreshing = true
        statusMessage = "Connecting to WHOOP..."

        let session = ASWebAuthenticationSession(
            url: authURL,
            callbackURLScheme: "whoopshare"
        ) { [weak self] callbackURL, error in
            Task { @MainActor in
                guard let self else {
                    return
                }

                self.isRefreshing = false
                self.authSession = nil

                if let callbackURL {
                    self.importPayload(from: callbackURL)
                    return
                }

                if let authError = error as? ASWebAuthenticationSessionError,
                   authError.code == .canceledLogin {
                    self.statusMessage = "WHOOP connection was cancelled."
                    return
                }

                self.statusMessage = error?.localizedDescription ?? "WHOOP connection failed."
            }
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authSession = session

        if !session.start() {
            isRefreshing = false
            authSession = nil
            statusMessage = "Could not start the WHOOP sign-in session."
        }
    }

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }
}
