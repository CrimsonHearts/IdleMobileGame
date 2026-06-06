# 📺 AdMob Setup

Your IDs are already in `www/js/monetization.js`:

| Type | Your ID |
|---|---|
| **App ID** (Android) | `ca-app-pub-9713010573550006~4519454223` |
| **Rewarded Ad Unit** (Android) | `ca-app-pub-9713010573550006/7400082676` |

These ship inside the app and are **public, not secret** — safe to commit.

---

## ⚠️ Read this first — don't get your account banned

- **Never tap your own LIVE ads.** It's the #1 reason AdMob bans accounts.
- The code has a safety switch: `AD_CONFIG.useLiveAds` in `monetization.js`.
  - **`false` (default)** → uses Google's official **test ads**. Use this for ALL development.
  - **`true`** → uses your real ad units. Flip this **only** for the production
    release you upload to the Play Store.
- Even with live ads, register your phone as a **test device** so you can
  safely verify (see step 5).

---

## Step 1 — Install the plugins (one time)

```bash
npm install
npm i @capacitor-community/admob
npm run cap:add:android      # generates android/ (any OS)
npm run cap:sync
```

## Step 2 — Declare the App ID in the Android project

After `cap add android`, open
`android/app/src/main/AndroidManifest.xml` and add this **inside** the
`<application>` tag:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-9713010573550006~4519454223"/>
```

> The app will crash on launch if this is missing or doesn't match your App ID.

## Step 3 — (iOS, later) Declare the App ID + tracking prompt

In `ios/App/App/Info.plist` add:

```xml
<key>GADApplicationIdentifier</key>
<string>YOUR_IOS_APP_ID_HERE</string>
<key>NSUserTrackingUsageDescription</key>
<string>This identifier will be used to deliver personalized ads to you.</string>
```

Create a separate **iOS app** + ad units in AdMob, then paste their IDs into
`AD_CONFIG.appIdiOS` and `AD_CONFIG.live.*iOS` in `monetization.js`.

## Step 4 — Create the remaining ad units (recommended)

In the AdMob console, create one unit per format and paste the IDs into
`AD_CONFIG.live` in `monetization.js`:

| Format | Used for | Field to fill |
|---|---|---|
| Rewarded | ✅ already set — "claim offline bonus" | `rewardedAndroid` ✓ |
| Interstitial | full-screen ad after a Tribulation | `interstitialAndroid` |
| Banner | strip at bottom of screen | `bannerAndroid` |

> Until you fill these in, the code automatically falls back to Google **test**
> ads for those formats, so nothing breaks.

## Step 5 — Test safely on your phone

1. Build & run the debug app: `npm run cap:sync && npm run open:android`
   (Run from Android Studio). With `useLiveAds: false` you'll see **test ads**.
2. To verify your **real** units before launch, in AdMob add your device as a
   **test device** (Settings → Test devices), then you may briefly set
   `useLiveAds: true`. Test-device live ads don't count as invalid traffic.

## Step 6 — Go live

1. Set `AD_CONFIG.useLiveAds = true`.
2. `npm run cap:sync`, build a signed release `.aab`, upload to Play Console.
3. In AdMob, link your app to the Play listing and complete the **payments /
   tax profile** so Google can pay you.

---

## Where each ad fires in the game

| Ad | Trigger | File |
|---|---|---|
| **Rewarded** | "Watch ad → claim the other 50% of offline Qi" popup | `ui.js` → `showWelcomeBack()` |
| **Interstitial** | after a Heavenly Tribulation | `ui.js` → `doBreakthrough()` |
| **Banner** | shown on launch (native only) | `monetization.js` → `init()` |

All routed through `Monetization` in `www/js/monetization.js`.
