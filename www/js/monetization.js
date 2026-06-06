/* ===========================================================================
 * monetization.js — Ads + In-App Purchases.
 *
 * This is the single integration point for making money. Right now it runs in
 * SIMULATED mode (works in the browser with no accounts) so the game is fully
 * playable and the monetization *hooks* are real. To go live you swap the
 * stubbed bodies for the Capacitor plugin calls noted in each method and drop
 * in your real AdMob / Play Billing IDs below.
 *
 *   Android/iOS ads : @capacitor-community/admob
 *   In-app purchase : @capacitor-community/in-app-purchases (or RevenueCat)
 *
 * Replace these TEST ids with your real ones before publishing:
 * ------------------------------------------------------------------------- */
const AD_CONFIG = {
  // Google's official TEST ad unit ids (safe to use during development).
  rewardedAndroid:    'ca-app-pub-3940256099942544/5224354917',
  rewardediOS:        'ca-app-pub-3940256099942544/1712485313',
  interstitialAndroid:'ca-app-pub-3940256099942544/1033173712',
  interstitialiOS:    'ca-app-pub-3940256099942544/4411468910',
  bannerAndroid:      'ca-app-pub-3940256099942544/6300978111',
  banneriOS:          'ca-app-pub-3940256099942544/2934735716',
  testMode: true, // set false when shipping with your own ids
};

const IAP_PRODUCTS = {
  removeAds:   'remove_ads',          // non-consumable
  qiPouch:     'qi_pouch_small',      // consumable
  doubleProd:  'permanent_double',    // non-consumable
};

const Monetization = {
  adsRemoved: false,         // flips true after the "remove ads" purchase
  _isNative: false,

  async init() {
    // Detect Capacitor native runtime.
    this._isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    this.adsRemoved = localStorage.getItem('ads_removed') === '1';

    if (this._isNative) {
      // --- REAL SETUP (uncomment once the plugin is installed) ------------
      // const { AdMob } = window.Capacitor.Plugins;
      // await AdMob.initialize({ initializeForTesting: AD_CONFIG.testMode });
      // await this.showBanner();
      // await Purchases.configure(...) // for IAP
    }
    // In simulated mode there's nothing to initialise.
  },

  /**
   * Show a rewarded video ad. Resolves true if the player earned the reward
   * (watched to completion), false if dismissed/failed.
   * @param {string} reason  label for analytics, e.g. 'offline_double'
   */
  async showRewardedAd(reason = 'reward') {
    if (this._isNative) {
      // --- REAL ----------------------------------------------------------
      // const { AdMob } = window.Capacitor.Plugins;
      // const id = isIOS ? AD_CONFIG.rewardediOS : AD_CONFIG.rewardedAndroid;
      // await AdMob.prepareRewardVideoAd({ adId: id });
      // const result = await AdMob.showRewardVideoAd();
      // return !!result; // reward granted
    }
    // --- SIMULATED: confirm dialog stands in for the video ---------------
    return new Promise(resolve => {
      const ok = confirm('📺 [Test Ad]\n\nWatch a 30s rewarded ad to claim your reward?\n\n(In the real app this is a real video.)');
      resolve(ok);
    });
  },

  /** Full-screen ad shown at natural breaks (e.g. after a breakthrough). */
  async showInterstitial() {
    if (this.adsRemoved) return;
    if (this._isNative) {
      // const { AdMob } = window.Capacitor.Plugins;
      // const id = isIOS ? AD_CONFIG.interstitialiOS : AD_CONFIG.interstitialAndroid;
      // await AdMob.prepareInterstitial({ adId: id });
      // await AdMob.showInterstitial();
      return;
    }
    console.log('[SIM] interstitial ad shown');
  },

  async showBanner() {
    if (this.adsRemoved || !this._isNative) return;
    // const { AdMob } = window.Capacitor.Plugins;
    // await AdMob.showBanner({ adId: isIOS ? AD_CONFIG.banneriOS : AD_CONFIG.bannerAndroid, position: 'BOTTOM_CENTER' });
  },

  /**
   * Trigger an in-app purchase. Resolves true on success.
   * @param {string} productId  one of IAP_PRODUCTS
   */
  async purchase(productId) {
    if (this._isNative) {
      // --- REAL (Capacitor IAP / RevenueCat) -----------------------------
      // const result = await Purchases.purchaseProduct(productId);
      // const success = !!result;
      // if (success) this._grant(productId);
      // return success;
    }
    // --- SIMULATED -------------------------------------------------------
    const ok = confirm(`💳 [Test Purchase]\n\nBuy "${productId}"?\n\n(In the real app this opens the Play/App Store payment sheet.)`);
    if (ok) this._grant(productId);
    return ok;
  },

  _grant(productId) {
    if (productId === IAP_PRODUCTS.removeAds) {
      this.adsRemoved = true;
      localStorage.setItem('ads_removed', '1');
    }
    // Other products (qiPouch, doubleProd) are granted by the caller in game.js
    // so the economy logic stays in one place.
  },
};

window.Monetization = Monetization;
window.IAP_PRODUCTS = IAP_PRODUCTS;
