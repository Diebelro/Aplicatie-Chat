import Foundation

/// Token sesiune Align (`x-session-token` / valoare `align_sid`) + userId. Produție: WebView bridge sau ASWebAuthenticationSession.
enum SessionStore {
    private static let ud = UserDefaults.standard
    private enum K {
        static let session = "align_session_token"
        static let userId = "align_user_id"
    }

    static var sessionToken: String? {
        get { ud.string(forKey: K.session) }
        set { ud.set(newValue, forKey: K.session) }
    }

    static var userId: String? {
        get { ud.string(forKey: K.userId) }
        set { ud.set(newValue, forKey: K.userId) }
    }

    static var isLoggedIn: Bool {
        guard let s = sessionToken, let u = userId else { return false }
        return !s.isEmpty && !u.isEmpty
    }
}
