import UIKit
import WebRTC

/// UI apel în curs — WebRTC nativ; închide și sesiunea CallKit.
final class ActiveCallViewController: UIViewController {
    private let meta: PendingCallMetadata
    private var rtc: WebRtcCallManager?

    private let remoteView = RTCMTLVideoView(frame: .zero)
    private let localView = RTCMTLVideoView(frame: .zero)
    private let hangUp = UIButton(type: .system)

    init(meta: PendingCallMetadata) {
        self.meta = meta
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        remoteView.translatesAutoresizingMaskIntoConstraints = false
        localView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(remoteView)
        view.addSubview(localView)
        hangUp.translatesAutoresizingMaskIntoConstraints = false
        hangUp.setTitle("Închide", for: .normal)
        hangUp.titleLabel?.font = .boldSystemFont(ofSize: 18)
        hangUp.addTarget(self, action: #selector(endTapped), for: .touchUpInside)
        view.addSubview(hangUp)

        NSLayoutConstraint.activate([
            remoteView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            remoteView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            remoteView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            remoteView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            localView.widthAnchor.constraint(equalToConstant: 120),
            localView.heightAnchor.constraint(equalToConstant: 160),
            localView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            localView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),

            hangUp.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            hangUp.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
        ])

        if meta.audioOnly {
            remoteView.isHidden = true
            localView.isHidden = true
        }

        guard SessionStore.isLoggedIn, let s = SessionStore.sessionToken, let u = SessionStore.userId else {
            dismiss(animated: true)
            return
        }

        let mgr = WebRtcCallManager()
        mgr.onEnded = { [weak self] in
            DispatchQueue.main.async { self?.finishDismiss() }
        }
        mgr.onError = { [weak self] msg in
            DispatchQueue.main.async {
                let a = UIAlertController(title: "Eroare", message: msg, preferredStyle: .alert)
                a.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                    self?.finishDismiss()
                })
                self?.present(a, animated: true)
            }
        }
        mgr.start(
            meta: meta,
            session: s,
            myUserId: u,
            localView: meta.audioOnly ? nil : localView,
            remoteView: meta.audioOnly ? nil : remoteView
        )
        rtc = mgr
    }

    @objc private func endTapped() {
        finishDismiss()
    }

    private func finishDismiss() {
        rtc?.endCall()
        rtc = nil
        if let u = CallKitManager.currentCallUUID {
            CallKitManager.shared.endCall(uuid: u)
            CallKitManager.currentCallUUID = nil
        }
        dismiss(animated: true)
    }
}
