import Foundation

/// Același algoritm ca `getVideoRoomId` din web: `align-` + ids sortate lexicografic.
enum AlignPairRoom {
    static func roomId(userId1: String, userId2: String) -> String {
        let sorted = [userId1, userId2].sorted()
        return "align-\(sorted[0])__\(sorted[1])"
    }
}
