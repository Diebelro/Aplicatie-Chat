import Foundation
import PushKit

/// PushKit VoIP — declanșează ecranul de apel nativ chiar dacă aplicația e închisă.
/// Serverul trimite payload-ul din `align-app/lib/apnsVoipPush.ts`
/// (`roomId`, `callerId`, `callerName`, `audioOnly`), pe topicul `{bundleId}.voip`.
final class VoipPushManager: NSObject, PKPushRegistryDelegate {
    static let shared = VoipPushManager()

    private var registry: PKPushRegistry?
    /// Ultimul token primit; îl trimitem la server când WebView-ul are sesiune activă.
    private(set) var voipToken: String?

    func register() {
        let created = PKPushRegistry(queue: .main)
        created.delegate = self
        created.desiredPushTypes = [.voIP]
        registry = created
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        voipToken = token
        NotificationCenter.default.post(name: .diebelVoipTokenUpdated, object: token)
    }

    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        guard type == .voIP else { return }
        voipToken = nil
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }

        let data = payload.dictionaryPayload
        let roomId = (data["roomId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let callerId = (data["callerId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        // iOS cere raportare CallKit la FIECARE push VoIP, altfel sistemul oprește aplicația.
        guard !roomId.isEmpty, !callerId.isEmpty else {
            reportAndImmediatelyEnd(completion: completion)
            return
        }

        let callerName = (data["callerName"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Diebel"
        let audioOnly = (data["audioOnly"] as? String) == "1"
        let call = PendingCall(
            roomId: roomId,
            callerId: callerId,
            callerName: callerName,
            audioOnly: audioOnly
        )
        let uuid = UUID()
        PendingCallStore.save(uuid: uuid, call: call)
        CallKitManager.shared.reportIncomingCall(uuid: uuid, call: call) { error in
            if let error {
                NSLog("[Diebel] CallKit report error: %@", error.localizedDescription)
                CallKitManager.shared.reportCallEnded(uuid: uuid)
            }
            completion()
        }
    }

    private func reportAndImmediatelyEnd(completion: @escaping () -> Void) {
        let uuid = UUID()
        let placeholder = PendingCall(
            roomId: "",
            callerId: "diebel",
            callerName: "Diebel",
            audioOnly: true
        )
        CallKitManager.shared.reportIncomingCall(uuid: uuid, call: placeholder) { _ in
            CallKitManager.shared.reportCallEnded(uuid: uuid)
            completion()
        }
    }
}
