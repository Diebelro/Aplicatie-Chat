import Foundation

struct PendingCallMetadata: Equatable {
    let roomId: String
    let remoteUserId: String
    let audioOnly: Bool
}

/// UUID CallKit → meta pentru WebRTC după răspuns.
enum PendingCallStore {
    private static var map: [UUID: PendingCallMetadata] = [:]
    private static let lock = NSLock()

    static func save(uuid: UUID, meta: PendingCallMetadata) {
        lock.lock()
        defer { lock.unlock() }
        map[uuid] = meta
    }

    static func consume(uuid: UUID) -> PendingCallMetadata? {
        lock.lock()
        defer { lock.unlock() }
        return map.removeValue(forKey: uuid)
    }

    static func peek(uuid: UUID) -> PendingCallMetadata? {
        lock.lock()
        defer { lock.unlock() }
        return map[uuid]
    }
}
