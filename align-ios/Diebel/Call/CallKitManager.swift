import AVFoundation
import CallKit
import Foundation
import UIKit

/// Ecran de apel nativ iOS pentru apelurile primite prin push VoIP.
/// După „Răspunde", apelul propriu-zis rulează în WebView (`/app/call/{roomId}`),
/// exact ca pe Android — folosim același stack WebRTC deja testat în producție.
final class CallKitManager: NSObject, CXProviderDelegate {
    static let shared = CallKitManager()

    private var provider: CXProvider?
    private let controller = CXCallController()
    private(set) var activeUUID: UUID?

    func prepare() {
        let configuration = CXProviderConfiguration(localizedName: "Diebel Chat")
        configuration.supportsVideo = true
        configuration.maximumCallGroups = 1
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.generic]
        configuration.includesCallsInRecents = true
        // Sonerie de sistem CallKit (ca WhatsApp / Phone).
        if let icon = UIImage(systemName: "phone.fill") {
            configuration.iconTemplateImageData = icon.pngData()
        }
        let created = CXProvider(configuration: configuration)
        created.setDelegate(self, queue: nil)
        provider = created
    }

    func reportIncomingCall(uuid: UUID, call: PendingCall, completion: @escaping (Error?) -> Void) {
        guard let provider else {
            completion(NSError(domain: "DiebelCallKit", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "CallKit provider missing",
            ]))
            return
        }
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: call.callerId)
        update.localizedCallerName = call.callerName
        update.hasVideo = !call.audioOnly
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsDTMF = false
        provider.reportNewIncomingCall(with: uuid, update: update, completion: completion)
    }

    /// Închide un apel raportat, fără interacțiunea utilizatorului (payload invalid, expirat etc.).
    func reportCallEnded(uuid: UUID, reason: CXCallEndedReason = .failed) {
        provider?.reportCall(with: uuid, endedAt: Date(), reason: reason)
        if activeUUID == uuid { activeUUID = nil }
    }

    /// Închiderea apelului din interfața web trebuie să închidă și ecranul de sistem.
    func endActiveCall() {
        guard let uuid = activeUUID else { return }
        activeUUID = nil
        let transaction = CXTransaction(action: CXEndCallAction(call: uuid))
        controller.request(transaction) { _ in }
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        activeUUID = nil
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let call = PendingCallStore.consume(uuid: action.callUUID) else {
            action.fail()
            return
        }
        activeUUID = action.callUUID
        PendingCallStore.setAnsweredAwaitingUI(call)
        action.fulfill()
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .diebelOpenCall, object: call)
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        let wasActive = activeUUID == action.callUUID
        let pending = PendingCallStore.consume(uuid: action.callUUID)
        if activeUUID == action.callUUID { activeUUID = nil }
        action.fulfill()
        DispatchQueue.main.async {
            if wasActive {
                NotificationCenter.default.post(name: .diebelEndCall, object: nil)
            } else if pending != nil {
                NotificationCenter.default.post(name: .diebelDeclineCall, object: pending)
            }
        }
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // Sesiunea e deja activată de CallKit; categoria a fost setată înainte de a deschide
        // apelul în WebView. Reactivarea aici e contraindicată de Apple.
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        AudioSessionController.deactivateAfterCall()
    }
}
