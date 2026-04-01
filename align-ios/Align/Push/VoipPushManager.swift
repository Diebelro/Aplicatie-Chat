import Foundation
import PushKit
import UIKit

final class VoipPushManager: NSObject, PKPushRegistryDelegate {
    static let shared = VoipPushManager()
    private var registry: PKPushRegistry?

    func register() {
        let r = PKPushRegistry(queue: .main)
        r.delegate = self
        r.desiredPushTypes = [.voIP]
        registry = r
    }

    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        Task {
            guard SessionStore.isLoggedIn,
                  let session = SessionStore.sessionToken,
                  let uid = SessionStore.userId else { return }
            try? await AlignAPI.registerVoipToken(session: session, userId: uid, voipToken: token)
        }
    }

    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {}

    /// Apple: raportează imediat către CallKit; apelează `completion` la final.
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
        let d = payload.dictionaryPayload
        guard let roomId = d["roomId"] as? String,
              let callerId = d["callerId"] as? String else {
            completion()
            return
        }
        let name = (d["callerName"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Align"
        let audioOnly = (d["audioOnly"] as? String) == "1"
        let uuid = UUID()
        let meta = PendingCallMetadata(roomId: roomId, remoteUserId: callerId, audioOnly: audioOnly)
        PendingCallStore.save(uuid: uuid, meta: meta)

        CallKitManager.shared.reportIncomingCall(
            uuid: uuid,
            handleValue: callerId,
            localizedName: name,
            hasVideo: !audioOnly
        ) { err in
            if let err {
                NSLog("[Align] CallKit report error: \(err.localizedDescription)")
            }
            completion()
        }
    }
}
