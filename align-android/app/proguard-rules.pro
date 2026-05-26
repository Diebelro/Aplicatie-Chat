# ── Manifest-declared components (instantiated via reflection by the system) ──
-keep class ro.diebel.chat.AlignApplication { *; }
-keep class ro.diebel.chat.MainActivity { *; }
-keep class ro.diebel.chat.DevToolsActivity { *; }
-keep class ro.diebel.chat.SecondaryScreenActivity { *; }
-keep class ro.diebel.chat.call.CallActivity { *; }
-keep class ro.diebel.chat.call.AlignConnectionService { *; }
-keep class ro.diebel.chat.call.CallForegroundService { *; }
-keep class ro.diebel.chat.call.CallActionReceiver { *; }
-keep class ro.diebel.chat.fcm.AlignFirebaseMessagingService { *; }

# ── BuildConfig + ViewBinding ──
-keep class ro.diebel.chat.BuildConfig { *; }
-keep class ro.diebel.chat.databinding.** { *; }

# ── OkHttp ──
-dontwarn okhttp3.internal.platform.**
-keep class okhttp3.internal.platform.** { *; }
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**

# ── Kotlin coroutines ──
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# ── AdMob + UMP (GDPR consent) ──
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.ump.** { *; }

# ── Firebase ──
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# ── WebRTC ──
-keep class org.webrtc.** { *; }
-dontwarn org.chromium.build.BuildHooks
-dontwarn org.chromium.build.AndroidWebViewBuildConfig
