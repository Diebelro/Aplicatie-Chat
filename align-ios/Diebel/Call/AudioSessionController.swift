import AVFoundation
import Foundation

/// Rutare audio pentru apeluri WebRTC din WebView (echivalentul `prepareCallAudioRouting` de pe Android).
enum AudioSessionController {
    static func activateForCall() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetooth, .allowBluetoothA2DP]
            )
            try session.setActive(true, options: [])
        } catch {
            NSLog("[Diebel] activateForCall: %@", error.localizedDescription)
        }
    }

    static func deactivateAfterCall() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setActive(false, options: [.notifyOthersOnDeactivation])
        } catch {
            NSLog("[Diebel] deactivateAfterCall: %@", error.localizedDescription)
        }
    }
}
