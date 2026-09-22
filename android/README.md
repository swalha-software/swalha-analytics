# Swalha Analytics for Android

Native Android SDK for [Swalha Analytics](https://analytics.swalha.com). One
Kotlin file, no dependencies.

## Install

There is no artifact to depend on. Copy `Analytics.kt` into the app:

```
app/src/main/java/com/swalha/analytics/Analytics.kt
```

The file declares `package com.swalha.analytics`. Change the package line if you
would rather keep it somewhere else — nothing else refers to it.

It needs one permission, which most apps already have:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

HTTP goes through `HttpURLConnection`, JSON through the platform's `org.json`,
and identity through `SharedPreferences`. Nothing is added to the app's
dependency graph, and no version of Ktor, OkHttp, coroutines or
kotlinx-serialization is forced on it.

## Usage

Start it once, in `Application.onCreate`:

```kotlin
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Analytics.init(
            context = this,
            config = Config(
                analyticsHost = "https://analytics.swalha.com/api",
                siteId = "your-site-id",
                appIdentifier = "com.example.app",
                appVersion = BuildConfig.VERSION_NAME,
                initialScreenName = "Home",
                debug = BuildConfig.DEBUG,
            ),
        )
    }
}
```

Then report from anywhere:

```kotlin
Analytics.screen("Settings")
Analytics.event("signup_started", mapOf("plan" to "pro"))
Analytics.error(throwable)
Analytics.identify("user_123", mapOf("plan" to "pro"))
```

Every call hands its work to a background thread and returns at once. Nothing
in this SDK throws at the caller, blocks the main thread, or touches the
network on it.

### Compose

There is no navigation integration to install — report the screen as a side
effect of showing it:

```kotlin
LaunchedEffect(tab) { Analytics.screen(tab.name) }
```

## What is collected

| | |
|---|---|
| `screen(name)` | a pageview at `/name`, titled `name` |
| `pageview(path)` | a pageview at `path` |
| `event(name, props)` | a custom event |
| `error(throwable)` | the exception's type, message and stack |
| `identify(id, traits)` | names the person behind the anonymous id |
| `app_open` / `app_background` | automatic, unless `autoTrackAppLifecycle = false` |

Alongside each one: the anonymous install id, the app identifier, screen size,
language, and a user-agent string carrying the Android version, device model
and app version.

The site's own settings are fetched on `init` and honoured — turning off error
tracking or initial page views in the dashboard turns them off here.

## Identity

An anonymous id is minted on first run and kept in `SharedPreferences` under
`@swalha:{siteId}:anonymous-id`. It survives launches and updates; it does not
survive an uninstall, and it is never sent anywhere but this server.

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
cut** — half a JSON document fails validation and would take the event down
with it. With `debug = true` the SDK says so in logcat.

Events the network refuses are queued in memory, newest kept, and retried when
the app next comes to the foreground. The queue does not survive the process
being killed.

## Credits

Written for Swalha Analytics, which is built on the open-source
[Rybbit](https://github.com/rybbit-io/rybbit) project. It speaks the same
ingest protocol as [`../react-native`](../react-native), so the two report into
one site and can be told apart with `tag`.

See [LICENSE](./LICENSE).
