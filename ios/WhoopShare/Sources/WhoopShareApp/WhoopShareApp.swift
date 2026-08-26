import SwiftUI

@main
struct WhoopShareApp: App {
    @StateObject private var model = ShareCardModel()

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
                .onOpenURL { url in
                    model.importPayload(from: url)
                }
        }
    }
}
