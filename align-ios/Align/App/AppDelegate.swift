import UIKit
import AVFoundation

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        VoipPushManager.shared.register()
        CallKitManager.shared.prepare()
        configureAudioSession()
        NotificationCenter.default.addObserver(
            forName: .alignStartNativeCall,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let meta = note.object as? PendingCallMetadata else { return }
            self?.presentCall(meta: meta)
        }
        return true
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
        try? session.setActive(true)
    }

    private func presentCall(meta: PendingCallMetadata) {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows)
            .first(where: { $0.isKeyWindow }) else { return }
        let vc = ActiveCallViewController(meta: meta)
        vc.modalPresentationStyle = .fullScreen
        window.rootViewController?.present(vc, animated: true)
    }
}
