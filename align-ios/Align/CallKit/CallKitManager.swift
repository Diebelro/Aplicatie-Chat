import CallKit
import Foundation

final class CallKitManager: NSObject, CXProviderDelegate {
    static let shared = CallKitManager()
    /// UUID activ după răspuns — pentru închidere sincronă cu sistemul.
    private(set) static var currentCallUUID: UUID?

    private var provider: CXProvider!
    private let callController = CXCallController()

    func prepare() {
        let cfg = CXProviderConfiguration(localizedName: "Align")
        cfg.supportsVideo = true
        cfg.maximumCallGroups = 1
        cfg.maximumCallsPerCallGroup = 1
        cfg.supportedHandleTypes = [.generic]
        cfg.includesCallsInRecents = true
        provider = CXProvider(configuration: cfg)
        provider.setDelegate(self, queue: nil)
    }

    func reportIncomingCall(
        uuid: UUID,
        handleValue: String,
        localizedName: String,
        hasVideo: Bool,
        completion: @escaping (Error?) -> Void
    ) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: handleValue)
        update.localizedCallerName = localizedName
        update.hasVideo = hasVideo
        provider.reportNewIncomingCall(with: uuid, update: update, completion: completion)
    }

    func endCall(uuid: UUID) {
        let action = CXEndCallAction(call: uuid)
        let tr = CXTransaction(action: action)
        callController.request(tr) { _ in }
    }

    // MARK: CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {}

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        let uuid = action.callUUID
        guard let meta = PendingCallStore.consume(uuid: uuid) else {
            action.fail()
            return
        }
        action.fulfill()
        CallKitManager.currentCallUUID = uuid
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .alignStartNativeCall, object: meta)
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        PendingCallStore.consume(uuid: action.callUUID)
        if CallKitManager.currentCallUUID == action.callUUID {
            CallKitManager.currentCallUUID = nil
        }
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        action.fulfill()
    }
}
