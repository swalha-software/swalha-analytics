# Swalha Analytics for iOS

Native iOS SDK for [Swalha Analytics](https://analytics.swalha.com). One Swift
file, no dependencies.

## Install

There is no package to depend on. Copy `Analytics.swift` into the app target:

```
YourApp/Analytics/Analytics.swift
```

It declares one type, `Analytics`. Nothing else refers to it, so it can sit
wherever the project keeps such things.

HTTP goes through `URLSession`, JSON through `JSONSerialization`, and identity
through `UserDefaults`. Nothing is added to the app's dependency graph: no
Swift package, no CocoaPod, no Alamofire. It needs iOS 14 or later, compiles in the Swift 5 and Swift 6 language modes, and asks
for no permission.

## Usage

Start it once, in the `App`'s `init` or the app delegate's
`didFinishLaunching`, on the main thread:

```swift
@main
struct MyApp: App {
    init() {
        #if DEBUG
        let debug = true
        #else
        let debug = false
        #endif
        Analytics.start(Analytics.Config(
            analyticsHost: "https://analytics.swalha.com/api",
            siteId: "your-site-id",
            appIdentifier: "com.example.app",
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
            debug: debug,
            initialScreenName: "Home"
        ))
    }
}
```

Then report from anywhere, on any thread:

```swift
Analytics.screen("Settings")
Analytics.event("signup_started", ["plan": "pro"])
Analytics.error(error)
Analytics.identify("user_123", traits: ["plan": "pro"])
```

Every call hands its work to a background queue and returns at once. Nothing
in this SDK throws at the caller, blocks the main thread, or touches the
network on it.

### SwiftUI

There is no navigation integration to install. Report the screen as a side
effect of showing it:

```swift
.onChange(of: tab, initial: true) { _, tab in Analytics.screen(tab.name) }
```

## What is collected

| | |
|---|---|
| `screen(name)` | a pageview at `/name`, titled `name` |
| `pageview(path)` | a pageview at `path` |
| `event(name, props)` | a custom event |
| `error(error)` | the error's type, message and the call site's stack |
| `identify(id, traits)` | names the person behind the anonymous id |
| `app_open` / `app_background` | automatic, unless `autoTrackAppLifecycle = false` |

Alongside each one: the anonymous install id, the app identifier, screen size
in pixels, language, and a user-agent string carrying the iOS version, device
model and app version.

`app_open` is reported when the app comes to the front after being away, not
every time it becomes active: a Control Centre pull or a system alert is not
the person coming back. `app_background` is sent under a background task, so
it gets out before iOS suspends the app.

The site's own settings are fetched on `start` and honoured: turning off error
tracking or initial page views in the dashboard turns them off here.

## Identity

An anonymous id is minted on first run and kept in `UserDefaults` under
`@swalha:{siteId}:anonymous-id`. It survives launches and updates; it does not
survive the app being deleted, and it is never sent anywhere but this server.

`identify()` names the person behind it. The server links their earlier
anonymous activity to that id, so identifying late still gathers up what came
before.

An app replacing an earlier one starts everyone fresh: this SDK mints its own
id and does not look for whatever the previous install was known by. The server
derives a person from `sha256(siteId:anonymous_id)`, so a new id is a new
person, and the day a rewrite ships is a discontinuity in the numbers.

## Limits

The server validates each event strictly and rejects the whole thing on an
overlong value, so the SDK cuts everything to fit first: event names at 256
characters, page titles at 512, error messages at 500 and stacks at 2000.

Properties are the exception. They travel as a JSON string capped at 2048
characters (4096 for errors), and a set that overruns is **dropped rather than
cut**: half a JSON document fails validation and would take the event down
with it. With `debug: true` the SDK says so in the log.

Events the network could not deliver are queued, newest kept, up to
`maxQueueSize`, and retried on the next start and each return to the front.
Unlike the Android SDK's, the queue is written to disk
(`Application Support/SwalhaAnalytics/{siteId}.queue.json`), because iOS ends a
backgrounded app far more readily. An event the server has seen and refused
(a 4xx other than 408 and 429) is dropped rather than queued: no retry would
fix it.

## Watching it work

With `debug: true` the SDK writes to the unified log under the app's bundle id
and the category `SwalhaAnalytics`: what it sent, at debug level, and what went
wrong, as warnings.

```sh
xcrun simctl spawn booted log stream --level debug \
  --predicate 'category == "SwalhaAnalytics"'
```

## Credits

Written for Swalha Analytics, which is built on the open-source
[Rybbit](https://github.com/rybbit-io/rybbit) project. It speaks the same
ingest protocol as [`../android`](../android) and
[`../react-native`](../react-native), so the three report into one site and
can be told apart with `tag`.

See [LICENSE](./LICENSE).
