import SwiftUI

struct ContentView: View {
    @ObservedObject var model: ShareCardModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("WHOOP Share")
                            .font(.largeTitle.weight(.semibold))
                        Text("Import your authenticated Vercel share card, then send it from the Messages app drawer.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }

                    Link(destination: model.setupURL) {
                        Label("Open Vercel setup", systemImage: "safari")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Text(model.statusMessage)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    ShareCardPreview(payload: model.payload ?? .preview)

                    VStack(alignment: .leading, spacing: 10) {
                        Label("Install this app on your iPhone from Xcode.", systemImage: "1.circle")
                        Label("Open Vercel setup and connect WHOOP.", systemImage: "2.circle")
                        Label("Tap Open in app on the Vercel page.", systemImage: "3.circle")
                        Label("Open Messages, select Whoop Share, and send the card.", systemImage: "4.circle")
                    }
                    .font(.callout)
                    .foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("Setup")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct ShareCardPreview: View {
    let payload: ShareCardPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("WHOOP check-in")
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(.secondary)
                    Text(payload.card.memberName ?? "WHOOP member")
                        .font(.headline)
                }
                Spacer()
                Image(systemName: "heart.fill")
                    .foregroundStyle(recoveryColor)
            }

            HStack(spacing: 12) {
                metric("Recovery", payload.recoveryText)
                metric("Sleep", payload.sleepDurationText)
                metric("Woke", payload.card.wakeTime)
            }

            Text(payload.summary)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(.separator), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var recoveryColor: Color {
        guard let score = payload.card.recoveryScore else {
            return .secondary
        }

        if score >= 67 {
            return .green
        }

        if score >= 34 {
            return .yellow
        }

        return .red
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.headline.monospacedDigit())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
