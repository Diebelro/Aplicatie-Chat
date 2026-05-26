package ro.diebel.chat.ads

import android.app.Application
import android.content.Context
import android.content.SharedPreferences

/**
 * Contor cold start. Cerință produs: fără banner la prima deschidere ever a aplicației.
 * După al doilea cold start, ecranul secundar poate afișa banner (dacă ads + consimțământ OK).
 */
object LaunchTracker {
    private const val PREFS = "align_app_launch"
    private const val KEY_COUNT = "cold_start_count"

    private fun prefs(app: Context): SharedPreferences =
        app.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Apelăm din [Application.onCreate] o dată per proces. */
    fun incrementColdStart(app: Application) {
        val p = prefs(app)
        p.edit().putInt(KEY_COUNT, p.getInt(KEY_COUNT, 0) + 1).apply()
    }

    /** 1 = prima sesiune după instalare, 2+ = utilizări ulterioare. */
    fun coldStartCount(context: Context): Int =
        prefs(context).getInt(KEY_COUNT, 0)

    /** Banner strict interzis la prima lansare (count == 1 după primul increment). */
    fun isFirstLaunchSession(context: Context): Boolean = coldStartCount(context) <= 1
}
