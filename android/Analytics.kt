package com.swalha.analytics

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.ArrayDeque
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory

/**
 * Swalha Analytics for native Android.
 *
 * One file, no dependencies: HTTP through [HttpURLConnection], JSON through the
 * platform's `org.json`, identity through [SharedPreferences]. Copy it into the
 * app and nothing else changes.
 *
 * Everything here is fire-and-forget. Calls hand work to a single background
 * thread and return at once, and nothing this file does throws at the caller —
 * analytics that can crash or stall an app are worse than no analytics. Before
 * a successful [init], and after a failed one, every call is a no-op.
 *
 * ```kotlin
 * Analytics.init(
 *     context = this,
 *     config = Config(
 *         analyticsHost = "https://analytics.swalha.com/api",
 *         siteId = "your-site-id",
 *         appIdentifier = "com.example.app",
 *         initialScreenName = "Home",
 *     ),
 * )
 *
 * Analytics.screen("Settings")
 * Analytics.event("signup_started", mapOf("plan" to "pro"))
 * ```
 */
object Analytics {
    const val SDK_VERSION = "0.1.0"

    private val worker = Executors.newSingleThreadExecutor(
        ThreadFactory { task -> Thread(task, "swalha-analytics").apply { isDaemon = true } },
    )

    private var config: Config? = null
    private var app: Application? = null
    private var store: SharedPreferences? = null

    private var anonymousId: String? = null

    @Volatile
    private var currentUserId: String? = null

    /** What the site says may be collected. Empty until the first fetch answers. */
    private var trackErrors = true
    private var trackInitialPageView = true

    /** Payloads the network refused, kept in the order they were made. */
    private val queue = ArrayDeque<JSONObject>()

    /** The identified user, or null while only the anonymous id is known. */
    val userId: String? get() = currentUserId

    /**
     * Reads identity off disk, asks the site what it may collect, and — unless
     * the site says otherwise — reports [Config.initialScreenName].
     *
     * Safe to call from `Application.onCreate`. Calling it twice replaces the
     * configuration rather than doubling the reporting.
     */
    fun init(context: Context, config: Config) {
        val host = config.analyticsHost.trimEnd('/')
        if (host.isEmpty() || config.siteId.isEmpty()) {
            // Not thrown: a misconfigured build should report nothing, not die.
            // Logged from the configuration being offered rather than through
            // log(), which reads the accepted one — still null on a first call,
            // which would make this silence itself.
            if (config.debug) android.util.Log.w(TAG, "analyticsHost and siteId are required; analytics stays off")
            return
        }

        val application = context.applicationContext as? Application
        this.config = config.copy(analyticsHost = host)
        this.app = application
        this.store = context.applicationContext
            .getSharedPreferences("${config.storageKeyPrefix}.analytics", Context.MODE_PRIVATE)

        if (config.autoTrackAppLifecycle) application?.watchLifecycle()

        worker.execute {
            runCatching {
                anonymousId = readOrCreateAnonymousId()
                currentUserId = read("user-id")
                readRemoteConfig()

                val opening = config.initialScreenName
                if (!opening.isNullOrEmpty() && trackInitialPageView) sendScreen(opening, null)
                drainQueue()
            }.onFailure { log("init failed", it) }
        }
    }

    /** A screen the person is looking at, reported as this app's pageview. */
    fun screen(name: String, properties: Map<String, Any?>? = null) {
        worker.execute { runCatching { sendScreen(name, properties) }.onFailure { log("screen failed", it) } }
    }

    /** A screen named by path rather than by title, for router-shaped navigation. */
    fun pageview(path: String, title: String? = null) {
        worker.execute {
            runCatching {
                send(payload("pageview", pathname = asPath(path), title = title.orEmpty()))
            }.onFailure { log("pageview failed", it) }
        }
    }

    /** Something the person did. [name] is what the dashboard will group by. */
    fun event(name: String, properties: Map<String, Any?>? = null) {
        if (name.isEmpty()) return
        worker.execute {
            runCatching {
                val body = payload("custom_event", eventName = name.take(MAX_EVENT_NAME))
                properties?.let { body.putProperties(it, MAX_PROPERTIES) }
                send(body)
            }.onFailure { log("event failed", it) }
        }
    }

    /**
     * Something that went wrong. The site can turn error reporting off, and
     * this honours that.
     */
    fun error(throwable: Throwable, properties: Map<String, Any?>? = null) {
        worker.execute {
            runCatching {
                if (!trackErrors) return@runCatching
                val name = (throwable::class.java.simpleName ?: "Error").ifEmpty { "Error" }
                val body = payload("error", eventName = name.take(MAX_EVENT_NAME))
                val fields = LinkedHashMap<String, Any?>()
                properties?.let(fields::putAll)
                // message is the one field the server requires of an error, so
                // it is written last and cannot be displaced by a caller's key.
                fields["message"] = (throwable.message ?: "Unknown error").take(MAX_ERROR_MESSAGE)
                fields["stack"] = throwable.stackTraceToString().take(MAX_ERROR_STACK)
                body.putProperties(fields, MAX_ERROR_PROPERTIES)
                send(body)
            }.onFailure { log("error failed", it) }
        }
    }

    /**
     * Names the person behind the anonymous id. The server links what they did
     * before this call to the id given here, so identifying late still gathers
     * up the earlier visits.
     */
    fun identify(userId: String, traits: Map<String, Any?>? = null) {
        val id = userId.trim()
        if (id.isEmpty()) return
        currentUserId = id.take(MAX_USER_ID)
        worker.execute {
            runCatching {
                write("user-id", currentUserId)
                sendIdentify(currentUserId ?: return@runCatching, traits, isNew = true)
            }.onFailure { log("identify failed", it) }
        }
    }

    /** Adds to what is known about the identified person. A no-op before [identify]. */
    fun setTraits(traits: Map<String, Any?>) {
        worker.execute {
            runCatching {
                val id = currentUserId ?: return@runCatching log("setTraits before identify; ignored")
                sendIdentify(id, traits, isNew = false)
            }.onFailure { log("setTraits failed", it) }
        }
    }

    /** Forgets the identified person. The anonymous id is kept, as the install has not changed. */
    fun clearUserId() {
        currentUserId = null
        worker.execute { runCatching { write("user-id", null) }.onFailure { log("clearUserId failed", it) } }
    }

    /** Tries the payloads the network refused. Called for you on [init] and on each return to the app. */
    fun flush() {
        worker.execute { runCatching { drainQueue() }.onFailure { log("flush failed", it) } }
    }

    // --- identity -----------------------------------------------------------

    private fun readOrCreateAnonymousId(): String {
        read("anonymous-id")?.let { return it }

        val minted = "an_${java.lang.Long.toString(System.currentTimeMillis(), 36)}_" +
            java.lang.Long.toString((Math.random() * Long.MAX_VALUE).toLong(), 36)
        write("anonymous-id", minted)
        return minted
    }

    private fun key(name: String): String = "${config?.storageKeyPrefix}:${config?.siteId}:$name"

    private fun read(name: String): String? = store?.getString(key(name), null)?.takeIf { it.isNotEmpty() }

    private fun write(name: String, value: String?) {
        val edit = store?.edit() ?: return
        if (value == null) edit.remove(key(name)) else edit.putString(key(name), value)
        edit.apply()
    }

    // --- lifecycle ----------------------------------------------------------

    /**
     * Counts what is on screen. Android has no single "app is foregrounded"
     * signal without a lifecycle library, and started activities are the
     * dependency-free equivalent: none started means the app is away.
     */
    private fun Application.watchLifecycle() {
        registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            private var started = 0

            override fun onActivityStarted(activity: Activity) {
                if (started++ == 0) {
                    event("app_open")
                    flush()
                }
            }

            override fun onActivityStopped(activity: Activity) {
                // A rotation stops and starts an activity, so the count — not
                // the single event — is what says the app actually went away.
                if (--started <= 0) {
                    started = 0
                    event("app_background")
                }
            }

            override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
            override fun onActivityResumed(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, out: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }

    // --- payloads -----------------------------------------------------------

    private fun sendScreen(name: String, properties: Map<String, Any?>?) {
        val body = payload("pageview", pathname = asPath(name), title = name.take(MAX_TITLE))
        properties?.let { body.putProperties(it, MAX_PROPERTIES) }
        send(body)
    }

    /**
     * The fields every event carries. The server validates this shape strictly
     * and rejects the whole event on an unknown key or an overlong value, so
     * nothing is added here that it does not name, and everything is cut to fit.
     */
    private fun payload(type: String, pathname: String = "/", title: String = "", eventName: String? = null): JSONObject {
        val settings = config ?: error("not initialized")
        val metrics = app?.resources?.displayMetrics
        return JSONObject().apply {
            put("type", type)
            put("site_id", settings.siteId)
            anonymousId?.let { put("anonymous_id", it) }
            put("hostname", settings.appIdentifier.ifEmpty { settings.siteId }.take(MAX_HOSTNAME))
            put("pathname", pathname.take(MAX_PATHNAME))
            put("screenWidth", (metrics?.widthPixels ?: 1).coerceIn(1, MAX_SCREEN_DIMENSION))
            put("screenHeight", (metrics?.heightPixels ?: 1).coerceIn(1, MAX_SCREEN_DIMENSION))
            put("language", language().take(MAX_LANGUAGE))
            put("page_title", title)
            put("user_agent", userAgent().take(MAX_USER_AGENT))
            currentUserId?.let { put("user_id", it) }
            settings.tag.takeIf { it.isNotEmpty() }?.let { put("tag", it.take(MAX_TAG)) }
            eventName?.let { put("event_name", it) }
        }
    }

    /**
     * Properties travel as a JSON string with a length the server enforces. An
     * overlong set is dropped rather than cut, because half a JSON document
     * fails validation and would take the whole event down with it.
     */
    private fun JSONObject.putProperties(properties: Map<String, Any?>, limit: Int) {
        if (properties.isEmpty()) return
        val encoded = JSONObject(properties.filterValues { it != null }).toString()
        if (encoded.length <= limit) put("properties", encoded) else log("properties too long; dropped")
    }

    // --- network ------------------------------------------------------------

    private fun send(body: JSONObject) {
        val settings = config ?: return
        val sent = post("${settings.analyticsHost}/track", body.toString(), body.optString("language"), body.optString("user_agent"))
        if (!sent) enqueue(body)
    }

    private fun sendIdentify(userId: String, traits: Map<String, Any?>?, isNew: Boolean) {
        val settings = config ?: return
        val agent = userAgent().take(MAX_USER_AGENT)
        val body = JSONObject().apply {
            put("site_id", settings.siteId)
            anonymousId?.let { put("anonymous_id", it) }
            put("user_id", userId)
            put("is_new_identify", isNew)
            put("user_agent", agent)
            traits?.filterValues { it != null }?.takeIf { it.isNotEmpty() }?.let {
                val encoded = JSONObject(it)
                // The server measures traits in bytes, not characters, and
                // Arabic traits are two to three bytes a letter.
                if (encoded.toString().toByteArray().size <= MAX_TRAITS) put("traits", encoded)
                else log("traits over 2KB; dropped")
            }
        }
        // Identify is not queued: it is meaningful only next to the visit it
        // names, and a stale one replayed later would alias the wrong session.
        post("${settings.analyticsHost}/identify", body.toString(), language(), agent)
    }

    /** True when the server took it. Anything else — refusal or no network — is false. */
    private fun post(url: String, body: String, language: String, agent: String): Boolean {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = REQUEST_TIMEOUT_MS
                readTimeout = REQUEST_TIMEOUT_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Accept-Language", acceptLanguage(language))
                if (agent.isNotEmpty()) setRequestProperty("User-Agent", agent)
            }
            connection.outputStream.use { it.write(body.toByteArray()) }
            val code = connection.responseCode
            if (code !in 200..299) log("$url answered $code")
            code in 200..299
        } catch (failure: Exception) {
            log("$url unreachable", failure)
            false
        } finally {
            connection?.disconnect()
        }
    }

    /**
     * What this site allows. A site that cannot be reached is taken to allow
     * everything, so a configuration outage does not silently stop reporting.
     */
    private fun readRemoteConfig() {
        val settings = config ?: return
        var connection: HttpURLConnection? = null
        try {
            connection = (URL("${settings.analyticsHost}/site/tracking-config/${settings.siteId}").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = settings.configTimeoutMs
                readTimeout = settings.configTimeoutMs
            }
            if (connection.responseCode !in 200..299) return
            val text = connection.inputStream.bufferedReader().use(BufferedReader::readText)
            val remote = JSONObject(text)
            if (remote.has("trackErrors")) trackErrors = remote.optBoolean("trackErrors", true)
            if (remote.has("trackInitialPageView")) trackInitialPageView = remote.optBoolean("trackInitialPageView", true)
        } catch (failure: Exception) {
            log("tracking config unreachable", failure)
        } finally {
            connection?.disconnect()
        }
    }

    private fun enqueue(body: JSONObject) {
        val limit = config?.maxQueueSize ?: DEFAULT_MAX_QUEUE
        queue.addLast(body)
        // The newest events are the ones worth keeping when a device has been
        // offline longer than the queue is deep.
        while (queue.size > limit) queue.removeFirst()
    }

    private fun drainQueue() {
        if (queue.isEmpty()) return
        val waiting = ArrayList(queue)
        queue.clear()
        waiting.forEach { send(it) }
    }

    // --- device -------------------------------------------------------------

    /**
     * Shaped like a browser's, because the server reads the device, OS and
     * version out of it with a user-agent parser. A plain Kotlin string here
     * would leave every install reported as an unknown device.
     */
    private fun userAgent(): String {
        val version = config?.appVersion.orEmpty().let { if (it.isEmpty()) "" else " $it" }
        return "Mozilla/5.0 (Linux; Android ${Build.VERSION.RELEASE}; ${Build.MODEL}) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) SwalhaAnalyticsAndroid/$SDK_VERSION$version"
    }

    private fun language(): String = runCatching {
        val locale = Locale.getDefault()
        if (locale.country.isEmpty()) locale.language else "${locale.language}-${locale.country}"
    }.getOrDefault("")

    private fun acceptLanguage(language: String): String =
        language.replace('_', '-').substringBefore(';').substringBefore(',').trim()
            .ifEmpty { "en-US,en;q=0.9" }

    private fun asPath(value: String): String {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return "/"
        return if (trimmed.startsWith("/")) trimmed else "/$trimmed"
    }

    private fun log(message: String, failure: Throwable? = null) {
        if (config?.debug != true) return
        android.util.Log.w(TAG, message, failure)
    }

    private const val TAG = "SwalhaAnalytics"

    // Mirrors the server's own limits (services/tracker/trackingPayload.ts and
    // identifyService.ts). A value over one of these fails validation and the
    // whole event is dropped, so everything is cut to fit before it is sent.
    private const val MAX_HOSTNAME = 253
    private const val MAX_PATHNAME = 2048
    private const val MAX_TITLE = 512
    private const val MAX_LANGUAGE = 35
    private const val MAX_USER_ID = 255
    private const val MAX_TAG = 256
    private const val MAX_USER_AGENT = 512
    private const val MAX_EVENT_NAME = 256
    private const val MAX_PROPERTIES = 2048
    private const val MAX_ERROR_PROPERTIES = 4096
    private const val MAX_ERROR_MESSAGE = 500
    private const val MAX_ERROR_STACK = 2000
    private const val MAX_TRAITS = 2048
    private const val MAX_SCREEN_DIMENSION = 65_535

    private const val REQUEST_TIMEOUT_MS = 10_000
    private const val DEFAULT_MAX_QUEUE = 100
}

/**
 * How the app reports itself.
 *
 * @property analyticsHost the API root, e.g. `https://analytics.swalha.com/api`.
 * @property siteId the site this app reports as, from the dashboard.
 * @property appIdentifier the application id, e.g. `com.example.app`. Sent as
 *   the hostname, which is how the dashboard groups one app's traffic.
 * @property appVersion written into the user agent, so releases can be compared.
 * @property tag sent with every event. Two builds reporting to one site — a
 *   rewrite alongside the app it replaces — can be told apart by it.
 * @property debug logs what the SDK is doing to logcat under `SwalhaAnalytics`.
 *   Off in release: it is the only thing here that writes to the log.
 * @property autoTrackAppLifecycle reports `app_open` and `app_background`.
 * @property initialScreenName reported once on [Analytics.init], unless the
 *   site has initial page views turned off.
 * @property configTimeoutMs how long to wait for the site's settings before
 *   assuming everything is permitted.
 * @property maxQueueSize how many refused payloads to keep. They live in
 *   memory, so they are lost if the process dies before the app is reopened.
 * @property storageKeyPrefix namespaces the stored identity. Change it only to
 *   keep two sites apart inside one app.
 */
data class Config(
    val analyticsHost: String,
    val siteId: String,
    val appIdentifier: String = "",
    val appVersion: String = "",
    val tag: String = "",
    val debug: Boolean = false,
    val autoTrackAppLifecycle: Boolean = true,
    val initialScreenName: String? = null,
    val configTimeoutMs: Int = 3_000,
    val maxQueueSize: Int = 100,
    val storageKeyPrefix: String = "@swalha",
)
