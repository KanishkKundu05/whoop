import Messages
import UIKit

final class MessagesViewController: MSMessagesAppViewController {
    private let stackView = UIStackView()
    private let titleLabel = UILabel()
    private let summaryLabel = UILabel()
    private let sendButton = UIButton(type: .system)
    private var payload: ShareCardPayload = ShareCardStore.load() ?? .preview

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        renderPayload()
    }

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        payload = ShareCardStore.load() ?? .preview
        renderPayload()
    }

    private func configureView() {
        view.backgroundColor = .systemBackground

        stackView.axis = .vertical
        stackView.spacing = 14
        stackView.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.numberOfLines = 0

        summaryLabel.font = .preferredFont(forTextStyle: .subheadline)
        summaryLabel.textColor = .secondaryLabel
        summaryLabel.numberOfLines = 0

        sendButton.setTitle("Send WHOOP card", for: .normal)
        sendButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        sendButton.addTarget(self, action: #selector(sendCard), for: .touchUpInside)

        stackView.addArrangedSubview(titleLabel)
        stackView.addArrangedSubview(makeMetricRow())
        stackView.addArrangedSubview(summaryLabel)
        stackView.addArrangedSubview(sendButton)
        view.addSubview(stackView)

        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stackView.topAnchor.constraint(equalTo: view.layoutMarginsGuide.topAnchor, constant: 12),
            stackView.bottomAnchor.constraint(lessThanOrEqualTo: view.layoutMarginsGuide.bottomAnchor)
        ])
    }

    private func makeMetricRow() -> UIStackView {
        let row = UIStackView(arrangedSubviews: [
            metricView(label: "Recovery", value: payload.recoveryText),
            metricView(label: "Sleep", value: payload.sleepDurationText),
            metricView(label: "Woke", value: payload.card.wakeTime)
        ])
        row.axis = .horizontal
        row.spacing = 8
        row.distribution = .fillEqually
        row.tag = 42
        return row
    }

    private func metricView(label: String, value: String) -> UIView {
        let valueLabel = UILabel()
        valueLabel.font = .preferredFont(forTextStyle: .headline)
        valueLabel.text = value
        valueLabel.adjustsFontSizeToFitWidth = true
        valueLabel.minimumScaleFactor = 0.75

        let labelView = UILabel()
        labelView.font = .preferredFont(forTextStyle: .caption1)
        labelView.textColor = .secondaryLabel
        labelView.text = label

        let metricStack = UIStackView(arrangedSubviews: [valueLabel, labelView])
        metricStack.axis = .vertical
        metricStack.spacing = 3
        metricStack.layoutMargins = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        metricStack.isLayoutMarginsRelativeArrangement = true
        metricStack.backgroundColor = .secondarySystemBackground
        metricStack.layer.cornerRadius = 10
        return metricStack
    }

    private func renderPayload() {
        titleLabel.text = "WHOOP check-in"
        summaryLabel.text = payload.summary

        if let metricRow = stackView.arrangedSubviews.first(where: { $0.tag == 42 }) {
            stackView.removeArrangedSubview(metricRow)
            metricRow.removeFromSuperview()
        }

        stackView.insertArrangedSubview(makeMetricRow(), at: 1)
    }

    @objc private func sendCard() {
        let message = MSMessage(session: MSSession())
        let layout = MSMessageTemplateLayout()
        layout.caption = "WHOOP check-in"
        layout.subcaption = payload.summary
        layout.trailingCaption = payload.recoveryText
        layout.trailingSubcaption = "Recovery"
        layout.image = renderCardImage(payload)
        message.layout = layout
        message.summaryText = payload.summary
        message.url = URL(string: "https://whoop-delta-sable.vercel.app/imessage")

        activeConversation?.insert(message) { error in
            if let error {
                self.summaryLabel.text = error.localizedDescription
            }
        }
    }

    private func renderCardImage(_ payload: ShareCardPayload) -> UIImage {
        let size = CGSize(width: 640, height: 360)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size)
            UIColor.systemBackground.setFill()
            context.fill(rect)

            let accent = recoveryColor(payload.card.recoveryScore)
            accent.setFill()
            context.fill(CGRect(x: 0, y: 0, width: size.width, height: 92))

            draw("WHOOP check-in", at: CGPoint(x: 28, y: 24), font: .boldSystemFont(ofSize: 28), color: .white)
            draw(payload.card.memberName ?? "WHOOP member", at: CGPoint(x: 28, y: 58), font: .systemFont(ofSize: 20), color: .white)

            drawMetric("Recovery", payload.recoveryText, x: 28)
            drawMetric("Sleep", payload.sleepDurationText, x: 230)
            drawMetric("Woke", payload.card.wakeTime, x: 432)

            draw(payload.summary, in: CGRect(x: 28, y: 252, width: 584, height: 80), font: .systemFont(ofSize: 22), color: .secondaryLabel)
        }
    }

    private func drawMetric(_ label: String, _ value: String, x: CGFloat) {
        draw(value, at: CGPoint(x: x, y: 134), font: .boldSystemFont(ofSize: 32), color: .label)
        draw(label, at: CGPoint(x: x, y: 174), font: .systemFont(ofSize: 18), color: .secondaryLabel)
    }

    private func draw(_ text: String, at point: CGPoint, font: UIFont, color: UIColor) {
        draw(text, in: CGRect(origin: point, size: CGSize(width: 560, height: 36)), font: font, color: color)
    }

    private func draw(_ text: String, in rect: CGRect, font: UIFont, color: UIColor) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byWordWrapping
        (text as NSString).draw(
            in: rect,
            withAttributes: [
                .font: font,
                .foregroundColor: color,
                .paragraphStyle: paragraph
            ]
        )
    }

    private func recoveryColor(_ score: Int?) -> UIColor {
        guard let score else {
            return .systemGray
        }

        if score >= 67 {
            return .systemGreen
        }

        if score >= 34 {
            return .systemYellow
        }

        return .systemRed
    }
}
