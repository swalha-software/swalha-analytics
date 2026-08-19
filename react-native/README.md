# swalha-analytics-react-native

React Native analytics SDK for [Swalha Analytics](https://analytics.swalha.com).

## Install

```sh
npm install swalha-analytics-react-native @react-native-async-storage/async-storage
```

## Usage

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import analytics from "swalha-analytics-react-native";

await analytics.init({
  analyticsHost: "https://analytics.swalha.com/api",
  siteId: "your-site-id",
  appIdentifier: "com.example.app",
  storage: AsyncStorage,
  initialScreenName: "Home",
});

await analytics.event("signup_started", { plan: "pro" });
await analytics.identify("user_123", { plan: "pro" });
```

## React Navigation

```tsx
const navigationTracker = analytics.createNavigationTracker();

<NavigationContainer
  ref={navigationRef}
  onReady={() => navigationTracker.onReady(navigationRef.current)}
  onStateChange={() => navigationTracker.onStateChange(navigationRef.current)}
>
  {/* screens */}
</NavigationContainer>;
```

## Identity

The SDK generates an anonymous install ID and stores it through the provided
storage adapter, so it survives app launches. Pass AsyncStorage or a compatible
storage object — without one the ID lives in memory and resets on every launch.

The ID is stored under `@swalha:{siteId}:anonymous-id`. Installs that predate
this package's rename read through to the old `@rybbit:` key once and carry the
value forward, so upgrading does not make existing users look new.

## Credits

This package is a fork of [`@rybbit/react-native`](https://github.com/rybbit-io/rybbit),
the React Native SDK of the open-source Rybbit project, adapted for Swalha
Analytics. See [LICENSE](./LICENSE).
