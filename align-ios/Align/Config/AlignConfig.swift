import Foundation

enum AlignConfig {
    static var apiBase: String {
        let raw = Bundle.main.object(forInfoDictionaryKey: "ALIGN_API_BASE") as? String ?? ""
        return raw.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    static var signalingWsBase: String {
        let raw = Bundle.main.object(forInfoDictionaryKey: "ALIGN_SIGNALING_WS_BASE") as? String ?? ""
        return raw.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}
