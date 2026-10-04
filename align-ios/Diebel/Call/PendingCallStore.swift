import Foundation

struct PendingCall {
    let roomId: String
    let callerId: String
    let callerName: String
    let audioOnly: Bool
}

extension Notification.Name {
    /// Utilizatorul a răspuns din ecranul CallKit → deschidem apelul în WebView.
    static let diebelOpenCall = Notification.Name("diebel.openCall")
    /// Apel încheiat din CallKit după ce era activ (buton roșu / sistem).
    static let diebelEndCall = Notification.Name("diebel.endCall")
    /// Respingere din CallKit înainte de răspuns.
    static let diebelDeclineCall = Notification.Name("diebel.declineCall")
    /// Token VoIP nou primit de la APNs.
    static let diebelVoipTokenUpdated = Notification.Name("diebel.voipTokenUpdated")
}

/// Apeluri raportate la CallKit, în așteptarea răspunsului. Acces din thread-ul push + main.
enum PendingCallStore {
    private static var items: [UUID: PendingCall] = [:]
    /// Răspuns acceptat înainte ca WebShell să fie gata (app pornit din kill).
    private static var answeredAwaitingUI: PendingCall?
    private static let lock = NSLock()

    static func save(uuid: UUID, call: PendingCall) {
        lock.lock()
        defer { lock.unlock() }
        items[uuid] = call
    }

    static func consume(uuid: UUID) -> PendingCall? {
        lock.lock()
        defer { lock.unlock() }
        return items.removeValue(forKey: uuid)
    }

    static func setAnsweredAwaitingUI(_ call: PendingCall) {
        lock.lock()
        defer { lock.unlock() }
        answeredAwaitingUI = call
    }

    static func takeAnsweredAwaitingUI() -> PendingCall? {
        lock.lock()
        defer { lock.unlock() }
        let call = answeredAwaitingUI
        answeredAwaitingUI = nil
        return call
    }
}
