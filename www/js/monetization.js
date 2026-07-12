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
  // Your AdMob App ID (the "~" one). NOTE: this also has to be declared in the
  // native projects — see docs/ADMOB-SETUP.md. It is not secret.
  appIdAndroid: 'ca-app-pub-9713010573550006~4519454223',
  appIdiOS:     '', // create an iOS app in AdMob and paste its App ID (~) here

  /* ⚠️ SAFETY SWITCH ⚠️
   * Keep this FALSE during all development/testing. Tapping your own LIVE ads
   * is the #1 cause of AdMob bans. It should only ever be true in a real
   * release build (and even then, register your phone as a test device).
   * When false, Google's official TEST ad units are used instead. */
  useLiveAds: false,

  // Your real ad units (the "/" ones). Fill these in as you create them.
  live: {
    rewardedAndroid:     'ca-app-pub-9713010573550006/7400082676', // ← your Rewarded unit
    rewardediOS:         '', // create an iOS rewarded unit and paste here
    interstitialAndroid: '', // create in AdMob, then paste
    interstitialiOS:     '',
    bannerAndroid:       '',
    banneriOS:           '',
  },

  // Google's official TEST ad units — always safe to click, used when !useLiveAds.
  test: {
    rewardedAndroid:     'ca-app-pub-3940256099942544/5224354917',
    rewardediOS:         'ca-app-pub-3940256099942544/1712485313',
    interstitialAndroid: 'ca-app-pub-3940256099942544/1033173712',
    interstitialiOS:     'ca-app-pub-3940256099942544/4411468910',
    bannerAndroid:       'ca-app-pub-3940256099942544/6300978111',
    banneriOS:           'ca-app-pub-3940256099942544/2934735716',
  },

  /** Resolve the right ad-unit id for a format on the current platform. */
  unit(format, isIOS) {
    const set = this.useLiveAds ? this.live : this.test;
    const key = format + (isIOS ? 'iOS' : 'Android');
    // Fall back to a test unit if a live id hasn't been filled in yet, so the
    // app never crashes from an empty id.
    return set[key] || this.test[key];
  },
};

const IAP_PRODUCTS = {
  removeAds:   'remove_ads',          // non-consumable
  qiPouch:     'qi_pouch_small',      // consumable
  doubleProd:  'permanent_double',    // non-consumable
  // Spirit Root Packs (consumable — one-time use but consumable for repeated purchase flow)
  spiritWanderer: 'spirit_pack_wanderer',  // $2.99
  spiritSeeker:   'spirit_pack_seeker',    // $4.99
  spiritRadiant:  'spirit_pack_radiant',   // $5.99
  spiritSaint:    'spirit_pack_saint',     // $10.99
  spiritChaos:    'spirit_pack_chaos',     // $19.99
};

const Monetization = {
  adsRemoved: false,         // flips true after the "remove ads" purchase
  _isNative: false,
  _isIOS: false,
  _admob: null,              // the AdMob plugin, if installed

  async init() {
    // Detect Capacitor native runtime + platform.
    const cap = window.Capacitor;
    this._isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    this._isIOS = !!(cap && cap.getPlatform && cap.getPlatform() === 'ios');
    this.adsRemoved = localStorage.getItem('ads_removed') === '1';

    if (this._isNative && cap.Plugins && cap.Plugins.AdMob) {
      this._admob = cap.Plugins.AdMob;
      try {
        await this._admob.initialize({
          // When not shipping live ads, run the SDK in test mode.
          initializeForTesting: !AD_CONFIG.useLiveAds,
        });
        // No persistent banner — it overlaps the bottom navigation. We only
        // show ads the player opts into (rewarded) + the occasional interstitial.
      } catch (e) {
        console.warn('AdMob init failed', e);
      }
      // IAP: configure your purchase plugin here (see docs/ADMOB-SETUP.md).
    }
    // If the plugin isn't present (e.g. browser), we run in simulated mode.
  },

  /**
   * Show a rewarded video ad. Resolves true if the player earned the reward
   * (watched to completion), false if dismissed/failed.
   * @param {string} reason  label for analytics, e.g. 'offline_double'
   */
  async showRewardedAd(reason = 'reward') {
    // Ad-removal purchasers should never see another ad prompt, period —
    // grant the reward as if the ad were watched instead of gating it.
    if (this.adsRemoved) return true;
    if (this._admob) {
      try {
        const adId = AD_CONFIG.unit('rewarded', this._isIOS);
        await this._admob.prepareRewardVideoAd({ adId });
        const reward = await this._admob.showRewardVideoAd();
        return !!reward; // truthy reward object => watched to completion
      } catch (e) {
        console.warn('Rewarded ad failed', e);
        return false;
      }
    }
    // --- SIMULATED: confirm dialog stands in for the video ---------------
    return new Promise(resolve => {
      const ok = confirm('📺 [Test Ad]\n\nWatch a 30s rewarded ad to claim your reward?\n\n(In the real app this is a real video.)');
      resolve(ok);
    });
  },

  /** Full-screen ad shown at natural breaks (e.g. after a breakthrough).
   *  DISABLED by design: monetization is rewarded-only (player opts in).
   *  Flip `autoInterstitials` to true to re-enable. */
  autoInterstitials: false,
  async showInterstitial() {
    if (!this.autoInterstitials || this.adsRemoved) return;
    if (this._admob) {
      try {
        const adId = AD_CONFIG.unit('interstitial', this._isIOS);
        await this._admob.prepareInterstitial({ adId });
        await this._admob.showInterstitial();
      } catch (e) {
        console.warn('Interstitial failed', e);
      }
      return;
    }
    console.log('[SIM] interstitial ad shown');
  },

  /** Banner ads are DISABLED by design — they cover the bottom navigation.
   *  Monetization is rewarded-only (player opts in) + occasional interstitial.
   *  Kept as a no-op so any legacy callers don't break or show a banner. */
  async showBanner() { /* intentionally disabled */ },
  async hideBanner() { if (this._admob && this._admob.hideBanner) { try { await this._admob.hideBanner(); } catch (e) {} } },

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

      // No real IAP plugin is wired in yet — fail closed instead of falling
      // through to the simulated confirm()-grants-it-free path below, which
      // would let every "purchase" succeed for free on a shipped native build.
      console.error(`Monetization.purchase("${productId}"): native platform detected but no IAP plugin is wired in. Refusing to grant for free — see monetization.js comments.`);
      if (window.UI) UI.toast('🛠 Purchases aren\'t available in this build yet.');
      return false;
    }
    // --- SIMULATED (browser/dev only) -------------------------------------
    const ok = confirm(`💳 [Test Purchase]\n\nBuy "${productId}"?\n\n(In the real app this opens the Play/App Store payment sheet.)`);
    if (ok) this._grant(productId);
    return ok;
  },

  _grant(productId) {
    if (productId === IAP_PRODUCTS.removeAds) {
      this.adsRemoved = true;
      localStorage.setItem('ads_removed', '1');
      if (window.UI) UI.toast('🚫 Ads removed — thank you for supporting the game!');
    } else if (productId === IAP_PRODUCTS.qiPouch) {
      // Grant 1 hour of current Qi production as an instant bonus
      if (window.Game) {
        const bonus = Math.max(500, Game.qiPerSecond() * 3600);
        Game._addQi(bonus);
        Game.persist();
        if (window.UI) {
          UI.renderResources();
          UI.toast(`☯ +${GameNumbers.formatNumber(bonus)} Qi poured into your meridians!`);
        }
      }
    } else if (productId === IAP_PRODUCTS.doubleProd) {
      if (window.Game) {
        Game.state.permanentDouble = true;
        Game.persist();
        if (window.UI) {
          UI.renderAll();
          UI.toast('⚡ Permanent 2× Production unlocked — your Dao is doubled forever!');
        }
      }
    } else {
      // Spirit Root Packs — look up in GameData
      const pack = window.GameData && GameData.spiritRootPacks && GameData.spiritRootPacks.find(p => p.productId === productId);
      if (pack && window.Game) {
        this._grantSpiritPack(pack);
      }
    }
  },

  _grantSpiritPack(pack) {
    // Roll the root
    const root = GameData.rollSpiritualRoot(pack.guaranteedRoot || pack.rollMode || 'paid');
    // Apply bonuses
    if (pack.bonusQi) Game._addQi(pack.bonusQi);
    if (pack.bonusDao) Game.state.daoComprehension += pack.bonusDao;
    if (pack.bonusMoney) Game.state.spiritStones = (Game.state.spiritStones || 0) + pack.bonusMoney;
    if (pack.extraRolls) Game.state.freeRollsLeft = (Game.state.freeRollsLeft || 0) + pack.extraRolls;
    if (pack.productionBonus) Game.state.packProductionBonus = (Game.state.packProductionBonus || 0) + pack.productionBonus;
    Game.persist();
    if (window.UI) {
      UI.renderAll();
      UI.showPackGrantResult(pack, root);
    }
  },

  /** Purchase a spirit root pack by pack id (looks up productId from GameData). */
  async purchaseSpiritPack(packId) {
    const pack = window.GameData && GameData.spiritRootPacks && GameData.spiritRootPacks.find(p => p.id === packId);
    if (!pack) return false;
    return this.purchase(pack.productId);
  },

  /**
   * Grant a timed 2× Qi production boost via rewarded ad.
   * Duration: 5 minutes. Shows the ad first; boost applies only on completion.
   */
  async showAdBoost() {
    const watched = await this.showRewardedAd('qi_boost');
    if (!watched) return false;
    if (window.Game) {
      // Extend from whichever is later (now or an existing boost still running)
      // instead of overwriting — back-to-back ad-watches should stack, not reset.
      const base = Math.max(Game.state.qiBoostEndsAt || 0, TimeService.now());
      Game.state.qiBoostEndsAt = base + 5 * 60 * 1000; // 5 min
      Game.persist();
      if (window.UI) {
        UI.renderAll();
        UI.toast('⚡ 2× Qi Production active for 5 minutes!');
      }
    }
    return true;
  },
};

window.Monetization = Monetization;
window.IAP_PRODUCTS = IAP_PRODUCTS;
