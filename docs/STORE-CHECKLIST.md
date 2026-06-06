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
| 4 | Generate an **upload keystore** & sign the app | (you, 1 cmd) | `keytool -genkey ...` — guide below. Keep it safe forever. |
| 5 | Build a release **`.aab`** in Android Studio | (you) | Build → Generate Signed Bundle. |
| 6 | Create the app in **Play Console** | (you) | App name, category = Games > Casual. |
| 7 | Upload `.aab`, fill store listing | (you) | Title, description, screenshots, feature graphic. |
| 8 | **Privacy policy URL** | (you) | Host `docs/privacy-policy.md` (GitHub Pages is free). |
| 9 | **Data safety** form + **content rating** | (you) | Honest declarations. Ads = "yes, shares data". |
| 10 | Set up **AdMob** + **payments profile** | (you) | So Google can pay you. Free signup. |
| 11 | Submit for review | (you) | Usually live within a day. |

### Generating the signing key (step 4)
```bash
keytool -genkey -v -keystore xianxia-release.keystore \
  -alias xianxia -keyalg RSA -keysize 2048 -validity 10000
```
⚠️ **Back up this file and its passwords.** Losing it means you can never
update the app under the same listing.

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
