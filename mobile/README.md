# Innovex Workspace for iPhone

The iOS app provides secure mobile access to the live Innovex workspace while native screens are introduced module by module. It uses the same production database, permissions, MFA and server-side session controls as the web application.

## Run on an iPhone

1. Install **Expo Go** from the iPhone App Store.
2. In this folder run `npm install`.
3. Run `npm start` and scan the QR code using the iPhone camera.

Both devices must be on the same network. If LAN discovery is unavailable, run `npx expo start --tunnel`.

## Configuration

Copy `.env.example` to `.env` to override the production web origin. The default is already the live Innovex site.

## iOS release

Use EAS Build so a Mac is not required for the cloud build:

```text
npx eas-cli login
npx eas-cli build --platform ios --profile preview
```

An Apple Developer membership and registered iPhone are required for an installable preview or TestFlight/App Store build. Do not commit Apple certificates or provisioning profiles.

## Android APK

The same app supports Android. The `preview` EAS profile produces a directly installable APK, so Play Store registration is not required for private testing:

```text
npx eas-cli build --platform android --profile preview
```

The production profile produces the store-ready release format.
