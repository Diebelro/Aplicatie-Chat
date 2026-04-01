package ro.align.app.data

import android.content.Context

/**
 * Stochează `align_sid` echivalent: tokenul de sesiune și userId pentru API Align.
 * Produție: populat din WebView după login (JavaScript bridge) sau OAuth device flow.
 */
class SessionStore(context: Context) {
    private val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    var sessionToken: String?
        get() = p.getString(KEY_SESSION, null)
        set(v) {
            p.edit().putString(KEY_SESSION, v).apply()
        }

    var userId: String?
        get() = p.getString(KEY_USER_ID, null)
        set(v) {
            p.edit().putString(KEY_USER_ID, v).apply()
        }

    fun clear() {
        p.edit().remove(KEY_SESSION).remove(KEY_USER_ID).apply()
    }

    fun isLoggedIn(): Boolean = !sessionToken.isNullOrBlank() && !userId.isNullOrBlank()

    companion object {
        private const val PREFS = "align_session"
        private const val KEY_SESSION = "session_token"
        private const val KEY_USER_ID = "user_id"
    }
}
