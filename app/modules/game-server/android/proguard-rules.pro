# Keep rules for release builds (R8). They travel with this module into the app.

# The game server and its Android wrapper: the service is named in the manifest and the module is
# found by name through Expo's autolinking.
-keep class com.queaura.** { *; }

# The HTTP and WebSocket libraries.
-keep class fi.iki.elonen.** { *; }
-keep class org.java_websocket.** { *; }

# Java-WebSocket logs through SLF4J; no logging backend is bundled, so its optional classes are absent.
-dontwarn org.slf4j.**
