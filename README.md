# Safe To Go

A React Native mobile app built with Expo that provides real-time, fairness-aware traffic navigation: live GPS tracking, turn-by-turn routing with traffic-coloured routes (OSRM by default, Google Directions optionally), weather-hazard and driver-fatigue alerts, and crowdsourced incident reporting. UI matches the [Safe To Go Figma file](https://www.figma.com/design/e0dQ0iWSgSOGm4f0SXf3ZV/Safe-to-Go). Supports iOS and Android via Expo Go or native builds.

**Tech stack:** React Native · Expo · TypeScript · React Navigation · Google Maps · OSRM / Google Directions · Photon · Open-Meteo · Supabase · expo-location

## Feature coverage

| Requirement | Where |
| --- | --- |
| Email sign up | `src/screens/SignUpScreen.tsx` (Supabase Auth) |
| Real-time GPS + interval updates | `src/hooks/useLocation.ts` |
| Destination entry + place autocomplete | `src/screens/HomeScreen.tsx`, `src/lib/places.ts` (Photon, no API key required) |
| Speed/location collection, traffic classification | `src/hooks/useLocation.ts`, `src/lib/directions.ts` (`buildTrafficSegments`) |
| Route optimization + alternatives, auto-reroute | `src/lib/directions.ts`, `src/screens/RouteSelectScreen.tsx`, `src/screens/NavigationScreen.tsx` |
| Fairness-aware routing (road load, distribution) | `supabase/schema.sql` (`active_route_assignments`, `route_usage_counts`), used in `RouteSelectScreen`/`NavigationScreen` |
| Alerts: traffic / weather / fatigue | `src/components/AlertCard.tsx`, `src/hooks/useDrivingSession.ts`, `src/hooks/useWeatherHazard.ts` |
| Weather hazard detection | `src/lib/weather.ts` (Open-Meteo, no API key required) |
| Driver fatigue detection | `src/hooks/useDrivingSession.ts` |
| Map visualization with traffic colours | `src/components/TrafficMap.tsx` |
| Incident reporting & feedback | `src/components/ReportIncidentSheet.tsx`, `supabase/schema.sql` (`incident_reports`) |

---

## Table of Contents

- [Prerequisites](#prerequisites)
  - [macOS](#prerequisites-macos)
  - [Windows](#prerequisites-windows)
- [Project Setup](#project-setup)
- [Environment Variables](#environment-variables)
- [Routing provider](#routing-provider)
- [Google Maps API Keys](#google-maps-api-keys)
- [Running the App](#running-the-app)
  - [Expo Go (fastest — no build required)](#expo-go-fastest--no-build-required)
  - [Android Emulator](#android-emulator)
  - [iOS Simulator (macOS only)](#ios-simulator-macos-only)
  - [Web Browser](#web-browser)
- [Native Builds (optional)](#native-builds-optional)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Prerequisites — macOS

1. **Homebrew** (package manager)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Node.js** (v18 or later)
   ```bash
   brew install node
   node --version   # should print v18+
   ```

3. **Git**
   ```bash
   brew install git
   ```

4. **Watchman** (file watcher used by React Native)
   ```bash
   brew install watchman
   ```

5. **Expo CLI** (optional global install — you can also use `npx expo` instead)
   ```bash
   npm install -g expo-cli
   ```

6. **Xcode** *(only needed for iOS Simulator or native iOS build)*
   - Download from the Mac App Store
   - After install, open Xcode once to accept the license agreement
   - Install Command Line Tools:
     ```bash
     xcode-select --install
     ```
   - Install iOS Simulator: Xcode → Settings → Platforms → add iOS

7. **Android Studio** *(only needed for Android Emulator or native Android build)*
   - Download from https://developer.android.com/studio
   - During setup wizard, make sure **Android SDK**, **Android SDK Platform**, and **Android Virtual Device** are checked
   - After install, create a virtual device: AVD Manager → Create Virtual Device → choose a device → Pixel 8 → download a system image (API 34 recommended)
   - Add Android SDK to your shell profile (`~/.zshrc` or `~/.bash_profile`):
     ```bash
     export ANDROID_HOME=$HOME/Library/Android/sdk
     export PATH=$PATH:$ANDROID_HOME/emulator
     export PATH=$PATH:$ANDROID_HOME/platform-tools
     ```
   - Reload your shell:
     ```bash
     source ~/.zshrc
     ```

---

### Prerequisites — Windows

1. **Node.js** (v18 or later)
   - Download the LTS installer from https://nodejs.org
   - During install, check **"Add to PATH"**
   - Verify:
     ```powershell
     node --version   # should print v18+
     npm --version
     ```

2. **Git**
   - Download from https://git-scm.com/download/win
   - Use default settings during install

3. **Expo CLI** (optional global install)
   ```powershell
   npm install -g expo-cli
   ```

4. **Android Studio** *(needed for Android Emulator or native Android build — iOS is not available on Windows)*
   - Download from https://developer.android.com/studio
   - During setup wizard, make sure **Android SDK**, **Android SDK Platform**, and **Android Virtual Device** are checked
   - After install, create a virtual device: AVD Manager → Create Virtual Device → choose Pixel 8 → download API 34 system image
   - Add Android SDK to your environment variables:
     - Open **System Properties** → **Environment Variables**
     - Add new **User variable**:
       - Name: `ANDROID_HOME`
       - Value: `C:\Users\<YourUser>\AppData\Local\Android\Sdk`
     - Edit the **Path** variable and add:
       - `%ANDROID_HOME%\emulator`
       - `%ANDROID_HOME%\platform-tools`
   - Restart your terminal after setting these

5. **Windows Subsystem for Linux (optional but recommended)**
   - WSL2 with Ubuntu gives a better developer experience for React Native
   - Run in PowerShell as Administrator:
     ```powershell
     wsl --install
     ```

> **Note:** iOS builds and the iOS Simulator are **not available on Windows**. To run on an iPhone from Windows, use the Expo Go app on your phone instead.

---

## Project Setup

**1. Clone the repository**

```bash
git clone <your-repo-url>
cd safe-to-go
```

**2. Install dependencies**

```bash
npm install
```

---

## Environment Variables

The app requires a Supabase project for authentication and data.

**1. Create your `.env` file**

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

**2. Fill in your Supabase credentials**

Open `.env` and replace the placeholder values:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

To get these values:
- Go to https://supabase.com and open your project (or create a new one)
- Navigate to **Project Settings → API**
- Copy the **Project URL** and **anon / public** key

**3. Run the database schema**

Open **Project → SQL Editor → New query** in Supabase, paste the contents of
[supabase/schema.sql](supabase/schema.sql), and run it. This creates the
tables backing recent searches, incident reports, and fairness-aware route
assignments (see [Feature coverage](#feature-coverage)).

---

## Routing provider

Routing is pluggable, selected by `EXPO_PUBLIC_DIRECTIONS_PROVIDER` in `.env`
and implemented in [src/lib/directions.ts](src/lib/directions.ts). Both
providers return the same `RouteOption` shape, so the screens don't care which
one is active.

| | `osrm` (default) | `google` |
|---|---|---|
| Setup | none — no key, no account | API key + **billing enabled** |
| ETAs | static, from road speeds | live traffic-aware (`duration_in_traffic`) |
| Alternatives | yes (up to 3) | yes |
| Toll avoidance | no (demo server rejects `exclude=toll`) | yes (`avoid=tolls`) |
| Vehicle profiles | car only; bicycle ETAs are re-timed estimates on car geometry | car + bicycle |
| Reliability | shared public demo server, best-effort | production SLA |

The default needs no configuration and routes on first run. Switch to Google
for live traffic once billing is set up:

```env
EXPO_PUBLIC_DIRECTIONS_PROVIDER=google
```

Where the provider has no live traffic feed, the UI degrades honestly rather
than inventing numbers: route colours fall back to road pace, toll status
shows as unknown instead of "No tolls", and the heavy-traffic alert drops its
delay estimate.

---

## Google Maps API Keys

The app uses Google Maps for the map view on both iOS and Android. The
Directions API is additionally required only when
`EXPO_PUBLIC_DIRECTIONS_PROVIDER=google`.

**1. Create an API key**

- Go to https://console.cloud.google.com
- Create a new project (or select an existing one)
- Navigate to **APIs & Services → Library**
- Enable:
  - **Maps SDK for Android**
  - **Maps SDK for iOS**
  - **Directions API** (only for the `google` routing provider)
- Go to **APIs & Services → Credentials → Create Credentials → API Key**
- Attach a **billing account** to the project (**Billing → Link a billing
  account**). Google rejects both Maps SDK and Directions calls without one,
  even inside the free monthly quota.

**2. Add the key to `.env`**

Unlike the old `app.json`, [app.config.js](app.config.js) reads the Maps key
from the environment at build time — nothing to edit in the config file
itself:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
```

Directions calls are plain HTTP requests from JS, not native SDK calls, so an
iOS/Android app-restricted key will reject them. Use a second key restricted
by API only:

```env
EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY=YOUR_UNRESTRICTED_KEY_HERE
```

It falls back to `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` when unset.

> **Security tip:** For production, restrict your API key in the Google Cloud Console by platform (iOS bundle ID / Android package name / HTTP referrer) to prevent unauthorized use. Because `EXPO_PUBLIC_*` variables are bundled into the client, treat this key as public and rely on Google Cloud Console restrictions rather than secrecy.

---

## Running the App

### Expo Go (fastest — no build required)

This is the easiest way to run the app on a real device. No Xcode or Android Studio needed.

**1. Install the Expo Go app on your phone**
- iOS: https://apps.apple.com/app/expo-go/id982107779
- Android: https://play.google.com/store/apps/details?id=host.exp.exponent

**2. Start the development server**

```bash
npx expo start
```

**3. Connect your device**
- Make sure your phone and computer are on the **same Wi-Fi network**
- **iOS:** Open the Camera app and scan the QR code shown in the terminal
- **Android:** Open the Expo Go app and tap **Scan QR code**

The app will load and hot-reload whenever you save a file.

---

### Android Emulator

Requires Android Studio and a configured virtual device (see [Prerequisites](#prerequisites)).

**1. Start the emulator**

- Open Android Studio → **Device Manager** → click the play button on your virtual device

  Or from the terminal:
  ```bash
  # macOS
  $ANDROID_HOME/emulator/emulator -avd <your_avd_name>

  # Windows (PowerShell)
  & "$env:ANDROID_HOME\emulator\emulator.exe" -avd <your_avd_name>
  ```

**2. Start the app**

```bash
npx expo start --android
```

Or start the dev server first with `npx expo start`, then press `a` in the terminal.

---

### iOS Simulator (macOS only)

Requires Xcode (see [Prerequisites — macOS](#prerequisites-macos)).

```bash
npx expo start --ios
```

Or start the dev server first with `npx expo start`, then press `i` in the terminal.

To choose a specific simulator device:
```bash
npx expo start --ios --simulator="iPhone 16 Pro"
```

> **Note:** The iOS Simulator does not support real GPS. Location will be simulated. For location features, use a real device via Expo Go.

---

### Web Browser

The app has limited web support. Maps functionality may be restricted in the browser.

```bash
npx expo start --web
```

---

## Native Builds (optional)

Use native builds when you need full native performance, custom native modules, or want to submit to the App Store / Play Store. This replaces Expo Go.

**Android**

```bash
# macOS
npx expo run:android

# Windows
npx expo run:android
```

**iOS (macOS only)**

```bash
npx expo run:ios
```

> These commands generate the native `android/` and `ios/` folders and compile the app. Requires a connected device or running emulator/simulator.

---

## Project Structure

```
safe-to-go/
├── App.tsx                       # App entry point, navigation setup
├── index.ts                      # Expo entry point
├── app.config.js                 # Expo config (reads API keys from env)
├── .env                          # Environment variables (git-ignored)
├── .env.example                  # Template for environment variables
├── supabase/schema.sql           # Tables + RLS for recents/incidents/fairness routing
├── assets/                       # Icons, splash screen images
└── src/
    ├── screens/
    │   ├── SplashScreen.tsx      # Branded loading screen
    │   ├── SignInScreen.tsx      # Login screen
    │   ├── SignUpScreen.tsx      # Registration screen
    │   ├── HomeScreen.tsx        # Destination search + recents
    │   ├── RouteSelectScreen.tsx # Vehicle mode + route alternatives
    │   └── NavigationScreen.tsx  # Turn-by-turn nav + alerts + reporting
    ├── components/
    │   ├── TrafficMap.tsx        # Map: routes, traffic colours, incidents
    │   ├── AlertCard.tsx         # Traffic/weather/fatigue/reroute alert UI
    │   ├── TurnBanner.tsx        # Top turn-by-turn instruction banner
    │   ├── NavStatsBar.tsx       # ETA/distance/speed bottom bar
    │   ├── VehicleModeSelector.tsx
    │   ├── ReportIncidentSheet.tsx
    │   └── ShieldLogo.tsx        # "Safe To Go" mark
    ├── navigation/
    │   └── RootNavigator.tsx     # Stack navigation config
    ├── hooks/
    │   ├── useLocation.ts        # GPS permission + tracking (incl. speed/heading)
    │   ├── useDrivingSession.ts  # Fatigue detection
    │   ├── usePlaceSuggestions.ts # Debounced search-as-you-type place lookup
    │   └── useWeatherHazard.ts   # Weather hazard polling
    ├── lib/
    │   ├── supabase.ts           # Supabase client + data helpers
    │   ├── directions.ts         # Routing providers (OSRM/Google), route/traffic classification
    │   ├── places.ts             # Photon place autocomplete + geocoding fallback
    │   ├── weather.ts            # Open-Meteo hazard classification
    │   └── geo.ts                # Distance helpers
    └── theme/
        └── colors.ts             # Design tokens from Figma
```

---

## Troubleshooting

**`Unable to find expo in this project` error**
```bash
npm install
```

**Metro bundler port conflict**
```bash
npx expo start --port 8082
```

**Android emulator not detected**
- Make sure the emulator is fully booted before running `npx expo start`
- Check `adb devices` returns your emulator
- Restart ADB: `adb kill-server && adb start-server`

**iOS Simulator not opening (macOS)**
- Run `xcode-select --install` to ensure CLI tools are installed
- Open Xcode once manually to accept the license agreement

**Location permissions denied**
- On a real device, go to Settings → Safe To Go → Location → set to "While Using" or "Always"
- On Android Emulator, open the emulator settings and enable Location

**Supabase connection errors**
- Double-check your `.env` values match the Supabase project dashboard
- Ensure the `.env` file is in the project root (same folder as `package.json`)
- Restart the dev server after editing `.env`: `npx expo start --clear`

**Routing fails with `REQUEST_DENIED — You must enable Billing...`**
- The Google Cloud project behind the Directions key has no billing account. Link one at **Billing → Link a billing account**; Google refuses every Directions call without it, even within the free quota
- Or switch to the keyless provider: set `EXPO_PUBLIC_DIRECTIONS_PROVIDER=osrm` in `.env` and restart with `npx expo start --clear`

**Google Maps not loading**
- Verify `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env` is correct and the Maps SDK is enabled in Google Cloud Console
- Make sure billing is enabled on your Google Cloud project (Maps requires a billing account even for free-tier usage)
- For Android: ensure the API key matches the app's package name restriction if you set one (`com.yourname.trafficpilot`)
