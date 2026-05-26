package ro.diebel.chat

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp

/**
 * Inițializare Firebase doar când [google-services.json] nu mai e placeholder.
 * Fără asta, FirebaseInitProvider + API key invalid pot opri aplicația la prima deschidere.
 */
object FirebaseBootstrap {
    private const val TAG = "FirebaseBootstrap"
    private const val PLACEHOLDER_KEY = "REPLACE_WITH_FIREBASE_ANDROID_KEY"

    fun initializeIfConfigured(context: Context) {
        if (!isGoogleServicesConfigured(context)) {
            Log.i(TAG, "Skipping Firebase init (placeholder google-services.json)")
            return
        }
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context)
                Log.i(TAG, "Firebase initialized")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Firebase init failed", e)
        }
    }

    private fun isGoogleServicesConfigured(context: Context): Boolean {
        val id = context.resources.getIdentifier("google_api_key", "string", context.packageName)
        if (id == 0) return false
        val key = context.getString(id)
        return key.isNotBlank() && !key.contains(PLACEHOLDER_KEY, ignoreCase = true)
    }
}
