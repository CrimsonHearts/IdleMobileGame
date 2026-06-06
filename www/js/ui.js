/* ===========================================================================
 * ui.js — Renders game state to the DOM and wires up interactions.
 * Kept separate from game logic so the engine stays testable / portable.
 * ========================================================================= */

const UI = {
  el: {},          // cached DOM refs
  buyAmount: 1,    // 1 | 10 | 'max'
  _builtShop: false,

  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      qi: $('qi-amount'),
      qps: $('qps'),
      realm: $('realm-name'),
      realmCN: $('realm-name-cn'),
      dao: $('dao-amount'),
      tapBtn: $('meditate-btn'),
      tapGain: $('tap-gain'),
      shop: $('shop-list'),
      upgrades: $('upgrade-list'),
      breakBtn: $('breakthrough-btn'),
      breakInfo: $('breakthrough-info'),
      progressFill: $('realm-progress-fill'),
      progressLabel: $('realm-progress-label'),
      buyButtons: document.querySelectorAll('.buy-amount-btn'),
      tabs: document.querySelectorAll('.tab-btn'),
      panels: document.querySelectorAll('.panel'),
    };

    // Meditate (tap).
    this.el.tapBtn.addEventListener('click', e => {
      const gain = Game.meditate();
      this.floatText(e, '+' + GameNumbers.formatNumber(gain) + ' ' + GameData.theme.currencyIcon);
      this.renderResources();
    });

    // Buy-amount selector.
    this.el.buyButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.buyAmount = btn.dataset.amount === 'max' ? 'max' : parseInt(btn.dataset.amount, 10);
        this.el.buyButtons.forEach(b => b.classList.toggle('active', b === btn));
        this.renderShop();
      });
    });

    // Tabs.
    this.el.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this.el.tabs.forEach(t => t.classList.toggle('active', t === tab));
        this.el.panels.forEach(p => p.classList.toggle('active', p.id === 'panel-' + target));
      });
    });

    // Breakthrough.
    this.el.breakBtn.addEventListener('click', () => this.doBreakthrough());

    this.buildShop();
    this.buildUpgrades();
    this.renderAll();
  },

  // -- Build static-ish lists once -----------------------------------------
  buildShop() {
    this.el.shop.innerHTML = '';
    GameData.generators.forEach(g => {
      const row = document.createElement('button');
      row.className = 'shop-item';
      row.id = 'gen-' + g.id;
      row.innerHTML = `
        <span class="gen-icon"><svg class="gen-icon-svg" viewBox="0 0 100 100"><use href="#ic-${g.id}"/></svg></span>
        <span class="gen-main">
          <span class="gen-name">${g.name} <em>${g.nameCN}</em></span>
          <span class="gen-sub" id="gen-sub-${g.id}"></span>
        </span>
        <span class="gen-buy">
          <span class="gen-cost" id="gen-cost-${g.id}"></span>
          <span class="gen-owned" id="gen-owned-${g.id}"></span>
        </span>`;
      row.addEventListener('click', () => this.buyGen(g.id));
      this.el.shop.appendChild(row);
    });
    this._builtShop = true;
  },

  buildUpgrades() {
    this.el.upgrades.innerHTML = '';
    GameData.upgrades.forEach(u => {
      const row = document.createElement('button');
      row.className = 'upgrade-item';
      row.id = 'upg-' + u.id;
      const cur = u.currency === 'dao' ? GameData.theme.prestigeIcon : GameData.theme.currencyIcon;
      row.innerHTML = `
        <span class="upg-icon">${u.icon}</span>
        <span class="upg-main">
          <span class="upg-name">${u.name} <em>${u.nameCN}</em></span>
          <span class="upg-desc">${u.desc}</span>
        </span>
        <span class="upg-cost" id="upg-cost-${u.id}">${GameNumbers.formatNumber(u.cost)} ${cur}</span>`;
      row.addEventListener('click', () => {
        if (Game.buyUpgrade(u.id)) { this.renderAll(); }
      });
      this.el.upgrades.appendChild(row);
    });
  },

  // -- Actions --------------------------------------------------------------
  buyGen(id) {
    let count = this.buyAmount === 'max' ? Game.maxAffordable(id) : this.buyAmount;
    if (count <= 0) return;
    if (Game.buyGenerator(id, count)) {
      this.renderResources();
      this.renderShop();
    }
  },

  doBreakthrough() {
    if (!Game.canBreakThrough()) return;
    const next = Game.nextRealm();
    const gain = Game.pendingDaoGain();
    const ok = confirm(
      `⚡ Heavenly Tribulation ⚡\n\n` +
      `Ascend to ${next.name} (${next.nameCN})?\n\n` +
      `You will gain ${GameNumbers.formatNumber(gain)} Dao Comprehension (道韵), ` +
      `granting +${(gain * GameData.daoBonusPerPoint * 100).toFixed(0)}% permanent production.\n\n` +
      `Your Qi and all generators will reset.`
    );
    if (!ok) return;
    const result = Game.breakThrough();
    if (result) {
      Game.persist();
      this.renderAll();
      this.toast(`☯ Ascended to ${result.realm.name}! +${GameNumbers.formatNumber(result.gain)} 道韵`);
      // Interstitial ad at a natural break point (skipped if ads removed).
      Monetization.showInterstitial();
    }
  },

  // -- Rendering ------------------------------------------------------------
  renderAll() {
    this.renderResources();
    this.renderShop();
    this.renderUpgrades();
    this.renderRealm();
  },

  renderResources() {
    const t = GameData.theme;
    this.el.qi.textContent = GameNumbers.formatNumber(Game.state.qi);
    this.el.qps.textContent = GameNumbers.formatRate(Game.qiPerSecond());
    this.el.dao.textContent = GameNumbers.formatNumber(Game.state.daoComprehension);
    this.el.tapGain.textContent = '+' + GameNumbers.formatNumber(Game.qiPerTap());
  },

  renderShop() {
    GameData.generators.forEach(g => {
      const owned = Game.state.owned[g.id];
      const row = document.getElementById('gen-' + g.id);
      // Hide generators far above what the player could know about yet.
      const cost1 = Game.generatorCost(g, 1);
      const visible = owned > 0 || Game.state.qi >= cost1 * 0.3 || g === GameData.generators[0]
                       || Game.state.lifetimeQi >= cost1 * 0.5;
      row.style.display = visible ? '' : 'none';
      if (!visible) return;

      let count = this.buyAmount === 'max' ? Math.max(1, Game.maxAffordable(g.id)) : this.buyAmount;
      const cost = Game.generatorCost(g, count);
      const affordable = Game.state.qi >= cost && (this.buyAmount !== 'max' ? true : Game.maxAffordable(g.id) > 0);

      document.getElementById('gen-cost-' + g.id).textContent =
        GameNumbers.formatNumber(cost) + ' ' + GameData.theme.currencyIcon +
        (this.buyAmount === 'max' ? ` ×${Game.maxAffordable(g.id)}` : (count > 1 ? ` ×${count}` : ''));
      document.getElementById('gen-owned-' + g.id).textContent = 'Owned: ' + owned;
      const each = g.baseProd * this.multAll();
      document.getElementById('gen-sub-' + g.id).textContent =
        GameNumbers.formatRate(each) + ' each' + (owned > 0 ? ` · ${GameNumbers.formatRate(each * owned)} total` : '');
      row.classList.toggle('affordable', affordable);
      row.disabled = !affordable;
    });
  },

  renderUpgrades() {
    GameData.upgrades.forEach(u => {
      const row = document.getElementById('upg-' + u.id);
      if (Game.state.upgrades[u.id]) {
        row.classList.add('owned');
        row.disabled = true;
        const costEl = document.getElementById('upg-cost-' + u.id);
        if (costEl) costEl.textContent = '✓ Learned';
        return;
      }
      const have = u.currency === 'dao' ? Game.state.daoComprehension : Game.state.qi;
      row.classList.toggle('affordable', have >= u.cost);
    });
  },

  renderRealm() {
    const realm = GameData.realms[Game.state.realm];
    this.el.realm.textContent = realm.name;
    this.el.realmCN.textContent = realm.nameCN;

    const next = Game.nextRealm();
    if (!next) {
      this.el.breakInfo.textContent = 'You have reached the peak of cultivation.';
      this.el.breakBtn.style.display = 'none';
      this.el.progressFill.style.width = '100%';
      this.el.progressLabel.textContent = 'Peak Realm';
      return;
    }
    const progress = Math.min(1, Game.state.runQi / next.reqQi);
    this.el.progressFill.style.width = (progress * 100).toFixed(1) + '%';
    this.el.progressLabel.textContent =
      GameNumbers.formatNumber(Game.state.runQi) + ' / ' + GameNumbers.formatNumber(next.reqQi) + ' Qi';

    const can = Game.canBreakThrough();
    this.el.breakBtn.style.display = '';
    this.el.breakBtn.disabled = !can;
    this.el.breakBtn.classList.toggle('ready', can);
    const gain = Game.pendingDaoGain();
    this.el.breakInfo.innerHTML = can
      ? `⚡ Ready to face the Heavenly Tribulation! Ascend to <b>${next.name}</b> for <b>+${GameNumbers.formatNumber(gain)}</b> 道韵.`
      : `Reach <b>${GameNumbers.formatNumber(next.reqQi)}</b> Qi this life to break through to <b>${next.name} (${next.nameCN})</b>.`;
  },

  multAll() {
    const m = Game.multipliers();
    return m.allMult * m.dao;
  },

  // -- Effects --------------------------------------------------------------
  floatText(e, text) {
    const span = document.createElement('span');
    span.className = 'float-text';
    span.textContent = text;
    const rect = this.el.tapBtn.getBoundingClientRect();
    const x = (e.clientX || rect.left + rect.width / 2);
    const y = (e.clientY || rect.top + rect.height / 2);
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 1000);
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3200);
  },

  showWelcomeBack(result) {
    if (result.cheated) {
      this.toast('⏳ Time anomaly detected — offline cultivation suspended.');
      return;
    }
    if (result.seconds < GameData.offline.minSecondsToShow || result.gained <= 0) return;
    const msg = `🧘 While you were away (${GameNumbers.formatDuration(result.seconds)}` +
      (result.capped ? ', capped at 8h' : '') +
      `) you cultivated <b>${GameNumbers.formatNumber(result.gained)}</b> ${GameData.theme.currencyIcon} Qi.`;
    // Rewarded-ad monetization hook: offline runs at 50% efficiency, so we
    // offer the other half in exchange for watching a rewarded video.
    this.modal('Welcome Back, Cultivator', msg, {
      rewardLabel: `📺 Watch ad → +${GameNumbers.formatNumber(result.gained)} more Qi`,
      onReward: async () => {
        const watched = await Monetization.showRewardedAd('offline_double');
        if (watched) {
          Game._addQi(result.gained); // grant the matching amount
          Game.persist();
          this.renderAll();
          this.toast(`☯ +${GameNumbers.formatNumber(result.gained)} Qi from your diligence!`);
        }
      },
    });
  },

  modal(title, html, reward) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const rewardBtn = reward
      ? `<button class="modal-reward">${reward.rewardLabel}</button>` : '';
    overlay.innerHTML = `
      <div class="modal">
        <h2>${title}</h2>
        <p>${html}</p>
        ${rewardBtn}
        <button class="modal-close">Continue Cultivating</button>
      </div>`;
    if (reward) {
      overlay.querySelector('.modal-reward').addEventListener('click', async () => {
        await reward.onReward();
        overlay.remove();
      });
    }
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },
};

window.UI = UI;
