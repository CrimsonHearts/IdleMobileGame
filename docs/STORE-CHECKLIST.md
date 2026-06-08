# 📦 Store Launch Checklist

Everything needed to publish **Path to Immortality** on Google Play and the
Apple App Store. Items marked **(you)** require your identity/payment and can
only be done by you; everything else is already done or can be done in-repo.

---

## A. Google Play (Android) — cheapest, do this first

| # | Step | Who | Notes |
|---|------|-----|-------|
| 1 | Create a **Google Play Developer account** | **(you)** | One-time **$25**. Needs name, address, ID. |
| 2 | Install **Android Studio** | (you) | Free. Any OS. |
| 3 | `npm install && npm run cap:add:android` | done by repo | Generates the Android project. |
| 4 | Generate an **upload keystore** | done (`xianxia-release.keystore`) | `keytool -genkey ...` — guide below. **Keep it safe forever.** |
| 5 | Build a signed **APK** (testing) / **`.aab`** (upload) | (you, 1 cmd) | `bash tools/build-apk.sh` for sideload testing; `gradlew bundleRelease` for the store. See below. |
| 6 | Create the app in **Play Console** | (you) | App name, category = Games > Casual. |
| 7 | Upload `.aab`, fill store listing | (you) | Title, description, screenshots, feature graphic. |
| 8 | **Privacy policy URL** | (you) | Host `docs/privacy-policy.md` (GitHub Pages is free). |
| 9 | **Data safety** form + **content rating** | (you) | Honest declarations. Ads = "yes, shares data". |
| 10 | Set up **AdMob** + **payments profile** | (you) | So Google can pay you. Free signup. |
| 11 | Submit for review | (you) | Usually live within a day. |

### Signing & building (steps 4–5)

**The keystore** (already created — `xianxia-release.keystore` in the repo root):
```bash
keytool -genkey -v -keystore xianxia-release.keystore \
  -alias xianxia -keyalg RSA -keysize 2048 -validity 10000
# alias: xianxia   ·   store & key password: CrimsonHearts@2026
```
⚠️ **Back up this file and its password.** Losing it means you can never
update the app under the same Play listing.

> 🚨 **DO NOT use `npx cap build android --keystore...` for a sideload APK.**
> That command signs with the **legacy v1 (JAR) scheme only**. Because the app
> targets **SDK 36**, Android **refuses to install a v1-only APK** — you'll get
> a generic **"App not installed."** (This is the bug that blocked earlier test
> installs.) Always sign sideload APKs with **apksigner (v2 + v3)** instead.

**A) Test APK for sideloading / your phone — use the build script:**
```bash
bash tools/build-apk.sh        # → ~/Desktop/PathToImmortality.apk (v2+v3 signed)
```
This syncs web assets, runs `gradlew assembleRelease`, then `zipalign` +
`apksigner sign --v2-signing-enabled --v3-signing-enabled`. Verify with:
```bash
$ANDROID_HOME/build-tools/35.0.0/apksigner verify ~/Desktop/PathToImmortality.apk
# must report: Verified using v2 scheme: true  /  v3 scheme: true
```

**B) Play Store upload — build an App Bundle (`.aab`):**
```bash
npx cap sync android
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab  (sign it, or let
#   Play App Signing manage delivery — Play re-signs delivered APKs as v2/v3)
```
For an `.aab`, the v1-only concern does **not** apply: Google Play re-signs the
APKs it delivers to devices via **Play App Signing**, so the upload just needs a
valid signature. Sideloaded `.apk`s (path A) are what require v2/v3 directly.

> Bump `versionCode` in `android/app/build.gradle` before every new build (Play
> rejects duplicate version codes; current = 2 / `versionName` 1.1).

---

## B. Apple App Store (iOS) — needs a Mac + yearly fee

| # | Step | Who | Notes |
|---|------|-----|-------|
| 1 | **Apple Developer Program** | **(you)** | **$99/year**. Needs Apple ID + identity. |
| 2 | A **Mac with Xcode** | **(you)** | Mandatory — iOS only builds on macOS. |
| 3 | `npm run cap:add:ios` | done by repo | Generates the iOS project. |
| 4 | Open in Xcode, set bundle id & team | (you) | `com.crimsonhearts.xianxiaidle`. |
| 5 | Add **App Tracking Transparency** prompt | done in code | Required by Apple for ad tracking. |
| 6 | Archive & upload to **App Store Connect** | (you) | Product → Archive. |
| 7 | Store listing + screenshots + privacy | (you) | Apple wants several screenshot sizes. |
| 8 | Define IAP products in App Store Connect | (you) | Use IDs from `IAP_PRODUCTS`. |
| 9 | Submit for review | (you) | Stricter; 1–3 days, may request changes. |

---

## C. Assets still to create (can be done in-repo)

- [ ] App icon (1024×1024 master → all sizes)
- [ ] Feature graphic (1024×500, Play)
- [ ] Screenshots (phone + tablet)
- [ ] Short & full store descriptions (EN + 中文)
- [ ] Promo/preview video (optional)

> Current art is CSS + emoji placeholders. Real illustrated assets can be
> dropped into `www/assets/` and referenced from the CSS/HTML.

---

## D. What only YOU can ultimately do (recap)

1. Create & pay for the developer accounts ($25 Google one-time, $99/yr Apple).
2. Provide identity, tax, and bank details so the stores can pay you.
3. Hold the signing keys.
4. Click the final **Submit / Publish** buttons (tied to your logins).
5. Provide a Mac for the iOS build.

Everything else — the game, monetization code, build config, store text
drafts, privacy policy — is in this repo.
