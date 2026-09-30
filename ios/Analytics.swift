import Foundation
import UIKit
import os

/// Swalha Analytics for native iOS.
///
/// One file, no dependencies: HTTP through `URLSession`, JSON through
/// `JSONSerialization`, identity through `UserDefaults`. Copy it into the app
/// and nothing else changes.
///
/// Everything here is fire-and-forget. Calls hand work to a single serial
/// queue and return at once, and nothing this file does throws at the caller:
/// analytics that can crash or stall an app are worse than no analytics.
/// Before a successful `start`, and after a failed one, every call is a no-op.
///
/// ```swift
/// Analytics.start(Analytics.Config(
///     analyticsHost: "https://analytics.swalha.com/api",
///     siteId: "your-site-id",
///     appIdentifier: "com.example.app",
///     initialScreenName: "Home"
/// ))
///
/// Analytics.screen("Settings")
/// Analytics.event("signup_started", ["plan": "pro"])
/// ```
enum Analytics {
    static let sdkVersion = "0.1.0"

    /// How the app reports itself.
    struct Config {
        /// The API root, e.g. `https://analytics.swalha.com/api`.
        var analyticsHost: String
        /// The site this app reports as, from the dashboard.
        var siteId: String
        /// The application id, e.g. `com.example.app`. Sent as the hostname,
        /// which is how the dashboard groups one app's traffic.
        var appIdentifier = ""
        /// Written into the user agent, so releases can be compared.
        var appVersion = ""
        /// Sent with every event. Two builds reporting to one site, a rewrite
        /// alongside the app it replaces, can be told apart by it.
        var tag = ""
        /// Logs what the SDK is doing to the unified log under
        /// `SwalhaAnalytics`. Off in release: it is the only thing here that
        /// writes to the log.
        var debug = false
        /// Reports `app_open` and `app_background`.
        var autoTrackAppLifecycle = true
        /// Reported once on `start`, unless the site has initial page views
        /// turned off.
        var initialScreenName: String? = nil
        /// How long to wait for the site's settings before assuming everything
        /// is permitted.
        var configTimeout: TimeInterval = 3
        /// How many refused payloads to keep. Unlike Android's, they are
        /// written to disk, because iOS ends a backgrounded app far more
        /// readily and an event lost to that is the one the dashboard misses.
        var maxQueueSize = 100
        /// Namespaces the stored identity. Change it only to keep two sites
        /// apart inside one app.
        var storageKeyPrefix = "@swalha"
    }

    /// One serial queue is the whole threading model: everything below the
    /// public surface runs on it, so no state here needs a lock, and requests
    /// go out in the order they were made.
    private static let worker = DispatchQueue(label: "swalha-analytics", qos: .utility)

    // The state below is marked unsafe for the compiler's sake and is not:
    // each piece has one home. The worker owns everything it reads and
    // writes; the two lifecycle fields belong to the main thread; the user
    // id is behind its lock. The configuration is set once, in `start`,
    // before the worker is handed anything.

    nonisolated(unsafe) private static var config: Config?
    nonisolated(unsafe) private static var anonymousId: String?

    /// Read from any thread through `userId`, so this one is locked.
    private static let userIdLock = NSLock()
    nonisolated(unsafe) private static var currentUserId: String?

    /// What the site says may be collected. Permissive until the first fetch answers.
    nonisolated(unsafe) private static var trackErrors = true
    nonisolated(unsafe) private static var trackInitialPageView = true

    /// Payloads the network refused, kept in the order they were made, and
    /// mirrored to `queueFile` after every change.
    nonisolated(unsafe) private static var queue: [[String: Any]] = []
    nonisolated(unsafe) private static var queueFile: URL?

    /// Physical pixels, as Android reports them. 1x1 until a scene exists to
    /// read them from, which is before any screen a person can see.
    nonisolated(unsafe) private static var display = (width: 1, height: 1)
    nonisolated(unsafe) private static var foregrounded = false
    nonisolated(unsafe) private static var observers: [NSObjectProtocol] = []

    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "swalha-analytics", category: "SwalhaAnalytics")

    private static let session: URLSession = {
        // Ephemeral: cookies and a cache would only ever get in the way of a
        // POST that is either taken or not.
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = requestTimeout
        configuration.timeoutIntervalForResource = requestTimeout * 2
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }()

    /// The identified user, or nil while only the anonymous id is known.
    static var userId: String? {
        userIdLock.lock()
        defer { userIdLock.unlock() }
        return currentUserId
    }

    /// Reads identity off disk, asks the site what it may collect, and, unless
    /// the site says otherwise, reports `Config.initialScreenName`.
    ///
    /// Main actor because the lifecycle is watched through UIKit. Safe to call
    /// from `App.init`. Calling it twice replaces the configuration rather
    /// than doubling the reporting.
    @MainActor
    static func start(_ config: Config) {
        var settings = config
        while settings.analyticsHost.hasSuffix("/") { settings.analyticsHost.removeLast() }
        if settings.analyticsHost.isEmpty || settings.siteId.isEmpty {
            // Not thrown: a misconfigured build should report nothing, not
            // die. Logged from the configuration being offered rather than
            // through log(), which reads the accepted one, still nil on a
            // first call, which would make this silence itself.
            if config.debug { logger.warning("analyticsHost and siteId are required; analytics stays off") }
            return
        }

        self.config = settings
        readDisplay()
        if settings.autoTrackAppLifecycle { watchLifecycle() }

        let accepted = settings
        worker.async {
            let settings = accepted
            anonymousId = readOrCreateAnonymousId()
            setUserId(read("user-id"))
            queueFile = queueLocation(for: settings)
            queue = loadQueue()
            readRemoteConfig()

            if let opening = settings.initialScreenName, !opening.isEmpty, trackInitialPageView {
                sendScreen(opening, nil)
            }
            drainQueue()
        }
    }

    /// A screen the person is looking at, reported as this app's pageview.
    static func screen(_ name: String, _ properties: [String: Any]? = nil) {
        worker.async { sendScreen(name, properties) }
    }

    /// A screen named by path rather than by title, for router-shaped navigation.
    static func pageview(_ path: String, title: String? = nil) {
        worker.async {
            guard let body = payload("pageview", pathname: asPath(path), title: title ?? "") else { return }
            send(body)
        }
    }

    /// Something the person did. `name` is what the dashboard will group by.
    static func event(_ name: String, _ properties: [String: Any]? = nil) {
        if name.isEmpty { return }
        worker.async {
            guard var body = payload("custom_event", eventName: cut(name, maxEventName)) else { return }
            if let properties { putProperties(properties, limit: maxProperties, into: &body) }
            send(body)
        }
    }

    /// Something that went wrong. The site can turn error reporting off, and
    /// this honours that.
    static func error(_ failure: Error, _ properties: [String: Any]? = nil) {
        // A Swift error carries no trace of where it was thrown, so the call
        // site's stack is the nearest thing, and it has to be taken here, on
        // the caller's thread, before the work moves to the worker.
        let stack = Thread.callStackSymbols.dropFirst().joined(separator: "\n")
        worker.async {
            guard trackErrors else { return }
            var name = String(describing: type(of: failure))
            if name.isEmpty { name = "Error" }
            guard var body = payload("error", eventName: cut(name, maxEventName)) else { return }
            var fields: [String: Any] = properties ?? [:]
            // message is the one field the server requires of an error, so it
            // is written last and cannot be displaced by a caller's key.
            let message = describe(failure)
            fields["message"] = cut(message.isEmpty ? "Unknown error" : message, maxErrorMessage)
            fields["stack"] = cut("\(name): \(message)\n\(stack)", maxErrorStack)
            putProperties(fields, limit: maxErrorProperties, into: &body)
            send(body)
        }
    }

    /// Names the person behind the anonymous id. The server links what they
    /// did before this call to the id given here, so identifying late still
    /// gathers up the earlier visits.
    static func identify(_ userId: String, traits: [String: Any]? = nil) {
        let id = userId.trimmingCharacters(in: .whitespacesAndNewlines)
        if id.isEmpty { return }
        let accepted = cut(id, maxUserId)
        setUserId(accepted)
        worker.async {
            write("user-id", accepted)
            sendIdentify(accepted, traits, isNew: true)
        }
    }

    /// Adds to what is known about the identified person. A no-op before `identify`.
    static func setTraits(_ traits: [String: Any]) {
        worker.async {
            guard let id = self.userId else { return log("setTraits before identify; ignored") }
            sendIdentify(id, traits, isNew: false)
        }
    }

    /// Forgets the identified person. The anonymous id is kept, as the install has not changed.
    static func clearUserId() {
        setUserId(nil)
        worker.async { write("user-id", nil) }
    }

    /// Tries the payloads the network refused. Called for you on `start` and on each return to the app.
    static func flush() {
        worker.async { drainQueue() }
    }

    // MARK: - identity

    private static func setUserId(_ id: String?) {
        userIdLock.lock()
        currentUserId = id
        userIdLock.unlock()
    }

    private static func readOrCreateAnonymousId() -> String {
        if let known = read("anonymous-id") { return known }

        // The same shape the Android and web SDKs mint, so nothing downstream
        // can tell the platforms' ids apart by their form.
        let millis = Int64(Date().timeIntervalSince1970 * 1000)
        let minted = "an_\(String(millis, radix: 36))_\(String(Int64.random(in: 0..<Int64.max), radix: 36))"
        write("anonymous-id", minted)
        return minted
    }

    private static func key(_ name: String) -> String {
        "\(config?.storageKeyPrefix ?? ""):\(config?.siteId ?? ""):\(name)"
    }

    private static func read(_ name: String) -> String? {
        let value = UserDefaults.standard.string(forKey: key(name)) ?? ""
        return value.isEmpty ? nil : value
    }

    private static func write(_ name: String, _ value: String?) {
        if let value { UserDefaults.standard.set(value, forKey: key(name)) }
        else { UserDefaults.standard.removeObject(forKey: key(name)) }
    }

    // MARK: - lifecycle

    /// Android counts started activities because it has no single foreground
    /// signal; iOS has one, but "active" also follows a Control Centre pull
    /// or a system alert, and those are not the person coming back. Only an
    /// activation after a background counts as an opening.
    @MainActor
    private static func watchLifecycle() {
        let center = NotificationCenter.default
        observers.forEach { center.removeObserver($0) }
        observers = [
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { readDisplay() }
                if foregrounded { return }
                foregrounded = true
                event("app_open")
                flush()
            },
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
                foregrounded = false
                // iOS suspends the app moments after this, and a request cut
                // off there is the end of every visit going missing. Time is
                // asked for until the worker has sent what it holds.
                var task = UIBackgroundTaskIdentifier.invalid
                MainActor.assumeIsolated {
                    task = UIApplication.shared.beginBackgroundTask(withName: "swalha-analytics") {
                        UIApplication.shared.endBackgroundTask(task)
                        task = .invalid
                    }
                }
                event("app_background")
                worker.async {
                    DispatchQueue.main.async {
                        if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
                        task = .invalid
                    }
                }
            },
        ]
    }

    /// `UIScreen.main` is gone in iOS 26, so the screen is the one a scene
    /// is on. There is none at `App.init`, hence the retry on activation.
    @MainActor
    private static func readDisplay() {
        let scene = UIApplication.shared.connectedScenes.lazy.compactMap { $0 as? UIWindowScene }.first
        guard let bounds = scene?.screen.nativeBounds else { return }
        let width = Int(bounds.width), height = Int(bounds.height)
        // Written where it is read, on the worker, like everything else here.
        if width > 0, height > 0 { worker.async { display = (width, height) } }
    }

    // MARK: - payloads

    private static func sendScreen(_ name: String, _ properties: [String: Any]?) {
        guard var body = payload("pageview", pathname: asPath(name), title: cut(name, maxTitle)) else { return }
        if let properties { putProperties(properties, limit: maxProperties, into: &body) }
        send(body)
    }

    /// The fields every event carries. The server validates this shape
    /// strictly and rejects the whole event on an unknown key or an overlong
    /// value, so nothing is added here that it does not name, and everything
    /// is cut to fit.
    private static func payload(_ type: String, pathname: String = "/", title: String = "", eventName: String? = nil) -> [String: Any]? {
        guard let settings = config else {
            log("not started; dropped")
            return nil
        }
        var body: [String: Any] = [
            "type": type,
            "site_id": settings.siteId,
            "hostname": cut(settings.appIdentifier.isEmpty ? settings.siteId : settings.appIdentifier, maxHostname),
            "pathname": cut(pathname, maxPathname),
            "screenWidth": min(max(display.width, 1), maxScreenDimension),
            "screenHeight": min(max(display.height, 1), maxScreenDimension),
            "language": cut(language(), maxLanguage),
            "page_title": title,
            "user_agent": cut(userAgent(), maxUserAgent),
        ]
        if let anonymousId { body["anonymous_id"] = anonymousId }
        if let userId { body["user_id"] = userId }
        if !settings.tag.isEmpty { body["tag"] = cut(settings.tag, maxTag) }
        if let eventName { body["event_name"] = eventName }
        return body
    }

    /// Properties travel as a JSON string with a length the server enforces.
    /// An overlong set is dropped rather than cut, because half a JSON
    /// document fails validation and would take the whole event down with it.
    private static func putProperties(_ properties: [String: Any], limit: Int, into body: inout [String: Any]) {
        let clean = jsonSafe(properties)
        if clean.isEmpty { return }
        guard let data = try? JSONSerialization.data(withJSONObject: clean, options: [.sortedKeys]),
              let encoded = String(data: data, encoding: .utf8) else { return log("properties not encodable; dropped") }
        if encoded.count <= limit { body["properties"] = encoded } else { log("properties too long; dropped") }
    }

    /// What `JSONSerialization` will take. Nils are dropped, as the Kotlin
    /// drops them; anything else it cannot write, a Date or an enum, is
    /// written as its description, because a property reported oddly is
    /// worth more than one that is not reported at all.
    private static func jsonSafe(_ properties: [String: Any]) -> [String: Any] {
        var clean: [String: Any] = [:]
        for (key, raw) in properties {
            guard let value = unwrap(raw) else { continue }
            clean[key] = jsonSafe(value)
        }
        return clean
    }

    private static func jsonSafe(_ value: Any) -> Any {
        switch value {
        case let text as String: return text
        case let number as NSNumber: return number
        case let list as [Any]: return list.compactMap(unwrap).map { jsonSafe($0) }
        case let map as [String: Any]: return jsonSafe(map)
        default: return String(describing: value)
        }
    }

    /// An `Any` holding an `Optional` still reads as non-nil, so the optional
    /// has to be looked through to find the nils a caller meant.
    private static func unwrap(_ value: Any) -> Any? {
        let mirror = Mirror(reflecting: value)
        guard mirror.displayStyle == .optional else { return value }
        return mirror.children.first.map { $0.value }
    }

    // MARK: - network

    private static func send(_ body: [String: Any]) {
        guard let settings = config,
              let data = try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys]) else { return }
        let status = post("\(settings.analyticsHost)/track", data, language: body["language"] as? String ?? "", agent: body["user_agent"] as? String ?? "")
        switch status {
        case .some(200...299):
            note("sent \(body["type"] as? String ?? "") \(body["event_name"] as? String ?? body["pathname"] as? String ?? "")")
            return
        case .some(400...407), .some(409...428), .some(430...499):
            // The server has seen it and refused its shape. Android keeps it
            // anyway, but its queue dies with the process; this one is on
            // disk, and a payload no retry can fix would sit there for good.
            log("track refused the payload; dropped")
        default:
            enqueue(body)
        }
    }

    private static func sendIdentify(_ userId: String, _ traits: [String: Any]?, isNew: Bool) {
        guard let settings = config else { return }
        let agent = cut(userAgent(), maxUserAgent)
        var body: [String: Any] = [
            "site_id": settings.siteId,
            "user_id": userId,
            "is_new_identify": isNew,
            "user_agent": agent,
        ]
        if let anonymousId { body["anonymous_id"] = anonymousId }
        if let traits, !traits.isEmpty {
            let clean = jsonSafe(traits)
            // The server measures traits in bytes, not characters, and
            // Arabic traits are two to three bytes a letter.
            if let encoded = try? JSONSerialization.data(withJSONObject: clean), encoded.count <= maxTraits {
                body["traits"] = clean
            } else {
                log("traits over 2KB; dropped")
            }
        }
        guard let data = try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys]) else { return }
        // Identify is not queued: it is meaningful only next to the visit it
        // names, and a stale one replayed later would alias the wrong session.
        _ = post("\(settings.analyticsHost)/identify", data, language: language(), agent: agent)
    }

    /// The status the server answered with, or nil for no answer at all.
    private static func post(_ url: String, _ body: Data, language: String, agent: String) -> Int? {
        guard let target = URL(string: url) else { return nil }
        var request = URLRequest(url: target)
        request.httpMethod = "POST"
        request.httpBody = body
        request.timeoutInterval = requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(acceptLanguage(language), forHTTPHeaderField: "Accept-Language")
        if !agent.isEmpty { request.setValue(agent, forHTTPHeaderField: "User-Agent") }

        let answer = perform(request)
        switch answer.status {
        case .some(let code) where (200...299).contains(code): break
        case .some(let code): log("\(url) answered \(code)")
        case .none: log("\(url) unreachable", answer.failure)
        }
        return answer.status
    }

    /// What this site allows. A site that cannot be reached is taken to allow
    /// everything, so a configuration outage does not silently stop reporting.
    private static func readRemoteConfig() {
        guard let settings = config,
              let target = URL(string: "\(settings.analyticsHost)/site/tracking-config/\(settings.siteId)") else { return }
        var request = URLRequest(url: target)
        request.timeoutInterval = settings.configTimeout
        let answer = perform(request)
        guard let code = answer.status else { return log("tracking config unreachable", answer.failure) }
        guard (200...299).contains(code), let data = answer.body,
              let remote = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        if let allowed = remote["trackErrors"] as? Bool { trackErrors = allowed }
        if let allowed = remote["trackInitialPageView"] as? Bool { trackInitialPageView = allowed }
    }

    private final class Answer: @unchecked Sendable {
        var status: Int?
        var body: Data?
        var failure: Error?
    }

    /// Waits for the request on the worker, the way the Android SDK's blocking
    /// connection does: the queue is serial and never the main thread, and
    /// waiting is what keeps events in order and lets a refusal be queued
    /// before the next one goes out. The session answers on its own queue,
    /// so the wait cannot deadlock; the deadline is for a task that never
    /// answers at all, which the session's own timeouts should already rule out.
    private static func perform(_ request: URLRequest) -> Answer {
        let answer = Answer()
        let done = DispatchSemaphore(value: 0)
        session.dataTask(with: request) { data, response, error in
            answer.status = error == nil ? (response as? HTTPURLResponse)?.statusCode : nil
            answer.body = data
            answer.failure = error
            done.signal()
        }.resume()
        _ = done.wait(timeout: .now() + request.timeoutInterval * 3 + 5)
        return answer
    }

    private static func enqueue(_ body: [String: Any]) {
        let limit = config?.maxQueueSize ?? defaultMaxQueue
        queue.append(body)
        // The newest events are the ones worth keeping when a device has been
        // offline longer than the queue is deep.
        if queue.count > limit { queue.removeFirst(queue.count - limit) }
        saveQueue()
    }

    private static func drainQueue() {
        if queue.isEmpty { return }
        let waiting = queue
        queue.removeAll()
        saveQueue()
        waiting.forEach(send)
    }

    private static func queueLocation(for settings: Config) -> URL? {
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let folder = support.appendingPathComponent("SwalhaAnalytics", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("\(settings.siteId).queue.json")
    }

    private static func loadQueue() -> [[String: Any]] {
        guard let file = queueFile, let data = try? Data(contentsOf: file),
              let saved = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { return [] }
        return saved
    }

    private static func saveQueue() {
        guard let file = queueFile else { return }
        if queue.isEmpty {
            try? FileManager.default.removeItem(at: file)
            return
        }
        guard let data = try? JSONSerialization.data(withJSONObject: queue) else { return log("queue not encodable; not saved") }
        do { try data.write(to: file, options: .atomic) } catch { log("queue not saved", error) }
    }

    // MARK: - device

    /// Shaped like Safari's, because the server reads the device, OS and
    /// version out of it with a user-agent parser. A plain Swift string here
    /// would leave every install reported as an unknown device.
    private static func userAgent() -> String {
        let os = ProcessInfo.processInfo.operatingSystemVersion
        var release = "\(os.majorVersion)_\(os.minorVersion)"
        if os.patchVersion > 0 { release += "_\(os.patchVersion)" }
        let model = hardwareModel()
        let family = model.hasPrefix("iPad") ? "iPad" : "iPhone"
        let version = config?.appVersion ?? ""
        return "Mozilla/5.0 (\(family); CPU \(family == "iPad" ? "OS" : "iPhone OS") \(release) like Mac OS X; \(model)) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) SwalhaAnalyticsIOS/\(sdkVersion)\(version.isEmpty ? "" : " \(version)")"
    }

    /// `iPhone17,1` and the like: the closest thing iOS has to `Build.MODEL`.
    /// The simulator answers with the Mac's architecture, so it is asked for
    /// the model it pretends to be instead.
    private static func hardwareModel() -> String {
        if let simulated = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] { return simulated }
        var system = utsname()
        uname(&system)
        let machine = system.machine
        return withUnsafePointer(to: machine) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: MemoryLayout.size(ofValue: machine)) { String(cString: $0) }
        }
    }

    private static func language() -> String {
        Locale.preferredLanguages.first ?? Locale.current.identifier.replacingOccurrences(of: "_", with: "-")
    }

    private static func acceptLanguage(_ language: String) -> String {
        let clean = language.replacingOccurrences(of: "_", with: "-")
            .split(separator: ";", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
        let first = clean.split(separator: ",", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
        let trimmed = first.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? "en-US,en;q=0.9" : trimmed
    }

    private static func asPath(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "/" }
        return trimmed.hasPrefix("/") ? trimmed : "/\(trimmed)"
    }

    /// `localizedDescription` of a plain Swift error is "The operation
    /// couldn't be completed", which says nothing; its description names the
    /// case. Foundation's errors describe themselves well either way.
    private static func describe(_ failure: Error) -> String {
        if let described = (failure as? LocalizedError)?.errorDescription, !described.isEmpty { return described }
        return String(describing: failure)
    }

    private static func cut(_ value: String, _ limit: Int) -> String {
        String(value.prefix(limit))
    }

    private static func log(_ message: String, _ failure: Error? = nil) {
        guard config?.debug == true else { return }
        if let failure {
            logger.warning("\(message, privacy: .public): \(String(describing: failure), privacy: .public)")
        } else {
            logger.warning("\(message, privacy: .public)")
        }
    }

    /// What went right, for watching the SDK work. Debug level, so it shows
    /// only when the log is asked for it.
    private static func note(_ message: String) {
        guard config?.debug == true else { return }
        logger.debug("\(message, privacy: .public)")
    }

    // Mirrors the server's own limits (services/tracker/trackingPayload.ts and
    // identifyService.ts). A value over one of these fails validation and the
    // whole event is dropped, so everything is cut to fit before it is sent.
    private static let maxHostname = 253
    private static let maxPathname = 2048
    private static let maxTitle = 512
    private static let maxLanguage = 35
    private static let maxUserId = 255
    private static let maxTag = 256
    private static let maxUserAgent = 512
    private static let maxEventName = 256
    private static let maxProperties = 2048
    private static let maxErrorProperties = 4096
    private static let maxErrorMessage = 500
    private static let maxErrorStack = 2000
    private static let maxTraits = 2048
    private static let maxScreenDimension = 65_535

    private static let requestTimeout: TimeInterval = 10
    private static let defaultMaxQueue = 100
}
