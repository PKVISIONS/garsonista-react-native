# GarsonistaKiosk (Expo-first)

This branch is configured for an Expo-first workflow.

## Install

```sh
npm install
```

## Start the app

```sh
npm run start
```

From the Expo CLI prompt:

- press `i` for iOS simulator
- press `a` for Android emulator

Or run directly:

```sh
npm run ios
npm run android
```

## Development build mode

If your setup needs a custom dev client (native modules), run:

```sh
npm run start:dev-client
```

## Regenerate native projects when needed

```sh
npm run prebuild
```

## Checks

```sh
npm run doctor
npm run lint
npm test
```
