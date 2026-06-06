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
      money: $('money-amount'),
      age: $('age-val'),
      studyPanel: $('tab-study'),
      workPanel: $('tab-work'),
      lifePanel: $('tab-life'),
      realm: $('realm-name'),
      stageName: $('stage-name'),
      charName: $('char-name'),
      charRoot: $('char-root'),
      cbBonus: $('cb-bonus'),
      dao: $('dao-amount'),
      tapBtn: $('meditate-btn'),
      tapEmblem: $('tap-emblem'),
      avatar: $('avatar-img'),
      tapGain: $('tap-gain'),
      shop: $('shop-list'),
      upgrades: $('upgrade-list'),
      advanceBtn: $('advance-btn'),
      breakBtn: $('breakthrough-btn'),
      breakInfo: $('breakthrough-info'),
      progressFill: $('realm-progress-fill'),
      progressLabel: $('realm-progress-label'),
      buyButtons: document.querySelectorAll('.buy-amount-btn'),
      navBtns: document.querySelectorAll('.nav-btn'),
      tabPanels: document.querySelectorAll('.tab-panel'),
    };
    this.activeTab = 'cultivate';

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

    // Bottom navigation.
    this.el.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        this.activeTab = target;
        this.el.navBtns.forEach(b => b.classList.toggle('active', b === btn));
        this.el.tabPanels.forEach(p => p.classList.toggle('active', p.id === 'tab-' + target));
        this.renderActiveTab();
      });
    });

    // Minor + major breakthroughs.
    this.el.advanceBtn.addEventListener('click', () => this.doAdvanceStage());
    this.el.breakBtn.addEventListener('click', () => this.doBreakthrough());

    this.buildShop();
    this.buildUpgrades();
    this.applyGenderEmblem();
    this.renderAll();

    // First-run character creation.
    if (!Game.state.characterCreated) this.showCharacterCreation();
  },

  applyGenderEmblem() {
    const fallback = Game.genderInfo().emblem;
    const painted = Game.portraitSrc(Game.state.gender, Game.state.spiritualRoot && Game.state.spiritualRoot.key);
    [this.el.tapEmblem, this.el.avatar].forEach(img => this.setPortrait(img, painted, fallback));
  },

  /** Try a painted portrait; if it isn't present yet, fall back to the vector art. */
  setPortrait(img, painted, fallback) {
    if (!img) return;
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    img.src = painted;
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
          <span class="gen-name">${g.name}</span>
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
          <span class="upg-name">${u.name}</span>
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
      `Ascend to ${next.name}?\n\n` +
      `You will gain ${GameNumbers.formatNumber(gain)} Dao Comprehension, ` +
      `granting +${(gain * GameData.daoBonusPerPoint * 100).toFixed(0)}% permanent production.\n\n` +
      `Your Qi and all generators will reset.`
    );
    if (!ok) return;
    const result = Game.breakThrough();
    if (result) {
      Game.persist();
      this.renderAll();
      this.toast(`☯ Ascended to ${result.realm.name}! +${GameNumbers.formatNumber(result.gain)} Dao`);
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
    if (this.activeTab === 'study') Life.renderStudy(this.el.studyPanel);
    else if (this.activeTab === 'work') Life.renderWork(this.el.workPanel);
    else if (this.activeTab === 'life') Family.render(this.el.lifePanel);
  },

  renderResources() {
    this.el.qi.textContent = GameNumbers.formatNumber(Game.state.qi);
    this.el.qps.textContent = GameNumbers.formatRate(Game.qiPerSecond());
    if (this.el.money && Game.state.life) this.el.money.textContent = GameNumbers.formatNumber(Game.state.life.money);
    if (this.el.age && Game.state.life) this.el.age.textContent = Game.state.life.age;
    this.el.dao.textContent = GameNumbers.formatNumber(Game.state.daoComprehension);
    this.el.tapGain.textContent = '+' + GameNumbers.formatNumber(Game.qiPerTap());
  },

  /** Called each frame by main loop: always refresh the strip + the live tab. */
  tickRender() {
    this.renderResources();
    switch (this.activeTab) {
      case 'cultivate':  this.renderShop(); this.renderRealm(); break;
      case 'study':      if (Life.isStudying()) Life.renderStudy(this.el.studyPanel); break;
      case 'techniques': this.renderUpgrades(); break;
    }
  },

  /** Full (re)render of whichever tab just became active. */
  renderActiveTab() {
    this.renderResources();
    switch (this.activeTab) {
      case 'cultivate':  this.renderShop(); this.renderRealm(); break;
      case 'study':      Life.renderStudy(this.el.studyPanel); break;
      case 'work':       Life.renderWork(this.el.workPanel); break;
      case 'life':       Family.render(this.el.lifePanel); break;
      case 'techniques': this.renderUpgrades(); break;
    }
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
    // -- Character header --------------------------------------------------
    const g = Game.genderInfo();
    const root = Game.state.spiritualRoot;
    this.el.charName.textContent = Game.state.name;
    this.el.charRoot.textContent = root.name;
    this.el.charRoot.style.color = root.color;
    this.el.cbBonus.textContent = (Game.state.stagesCleared * GameData.stageBonusPerStage * 100).toFixed(0);

    // -- Realm + stage labels ---------------------------------------------
    const tier = Game.tierLabel();
    this.el.realm.textContent = tier.realm;
    this.el.stageName.textContent = tier.stage;

    const next = Game.nextRealm();
    const realmComplete = Game.realmComplete();
    const canAdvance = Game.canAdvanceStage();
    const canBreak = Game.canBreakThrough();

    // -- Progress bar: toward next minor stage, or toward Tribulation ------
    if (!realmComplete) {
      const req = Game.nextStageReq();
      this.el.progressFill.style.width = (Math.min(1, Game.state.runQi / req) * 100).toFixed(1) + '%';
      this.el.progressLabel.textContent =
        GameNumbers.formatNumber(Game.state.runQi) + ' / ' + GameNumbers.formatNumber(req) + ' Qi (this life)';
    } else {
      this.el.progressFill.style.width = '100%';
      this.el.progressLabel.textContent = next ? 'Cultivation perfected — Tribulation awaits' : 'Peak of cultivation';
    }

    // -- Minor breakthrough button ----------------------------------------
    this.el.advanceBtn.style.display = (!realmComplete) ? '' : 'none';
    this.el.advanceBtn.disabled = !canAdvance;
    this.el.advanceBtn.classList.toggle('ready', canAdvance);
    if (!realmComplete) {
      const realm = Game.currentRealm();
      const nextStage = realm.stages[Game.state.stage];
      this.el.advanceBtn.textContent = canAdvance
        ? `⬆ Breakthrough → ${nextStage}`
        : `Need ${GameNumbers.formatNumber(Game.nextStageReq())} Qi → ${nextStage}`;
    }

    // -- Major Tribulation button -----------------------------------------
    if (!next) {
      this.el.breakBtn.style.display = realmComplete ? 'none' : 'none';
      this.el.breakInfo.innerHTML = realmComplete
        ? '☯ You have reached the peak of immortal cultivation.'
        : 'Climb every stage of this realm to perfect your cultivation.';
    } else {
      this.el.breakBtn.style.display = realmComplete ? '' : 'none';
      this.el.breakBtn.disabled = !canBreak;
      this.el.breakBtn.classList.toggle('ready', canBreak);
      const gain = Game.pendingDaoGain();
      this.el.breakInfo.innerHTML = realmComplete
        ? `⚡ Face the Heavenly Tribulation to ascend to <b>${next.name}</b> for <b>+${GameNumbers.formatNumber(gain)}</b> Dao.`
        : `Advance through all stages of <b>${tier.realm}</b>, then face Tribulation to ascend to <b>${next.name}</b>.`;
    }
  },

  multAll() {
    const m = Game.multipliers();
    return m.allMult * m.root * m.stage * m.dao * m.sect * m.pet * m.talent * m.family;
  },


  // -- Minor breakthrough ---------------------------------------------------
  doAdvanceStage() {
    const result = Game.advanceStage();
    if (result) {
      Game.persist();
      this.renderAll();
      const tier = Game.tierLabel();
      this.toast(`Cultivation deepened · Advanced to ${tier.realm} · ${tier.stage} (+${(GameData.stageBonusPerStage*100).toFixed(0)}% power)`);
    }
  },

  // -- Character creation ---------------------------------------------------
  showCharacterCreation() {
    let gender = 'male';
    let root = GameData.rollSpiritualRoot();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'creation-overlay';

    const render = () => {
      const g = GameData.genders[gender];
      overlay.innerHTML = `
        <div class="modal creation">
          <h2>Begin Your Cultivation</h2>
          <p class="creation-sub">Forge your path to immortality.</p>

          <div class="creation-emblem"><img id="creation-portrait" src="${g.emblem}" alt="cultivator"/></div>

          <div class="creation-field">
            <label>Dao Name</label>
            <input id="creation-name" type="text" maxlength="20" placeholder="Enter a name…" value="${this._creationName || ''}"/>
          </div>

          <div class="creation-field">
            <label>Body</label>
            <div class="gender-row">
              <button class="gender-btn ${gender==='male'?'active':''}" data-g="male">Male</button>
              <button class="gender-btn ${gender==='female'?'active':''}" data-g="female">Female</button>
            </div>
          </div>

          <div class="creation-field">
            <label>Spiritual Root</label>
            <div class="root-display" style="border-color:${root.color}">
              <div class="root-name" style="color:${root.color}">${root.name}</div>
              <div class="root-mult">Production ×${root.mult.toFixed(1)}</div>
              <div class="root-desc">${root.desc}</div>
            </div>
            <button id="reroll-root" class="reroll-btn">🎲 Re-divine Fate</button>
          </div>

          <button id="begin-cultivation" class="modal-close">Begin Cultivation ☯</button>
        </div>`;

      overlay.querySelectorAll('.gender-btn').forEach(b =>
        b.addEventListener('click', () => {
          gender = b.dataset.g;
          this._creationName = overlay.querySelector('#creation-name').value;
          render();
        }));
      overlay.querySelector('#reroll-root').addEventListener('click', () => {
        this._creationName = overlay.querySelector('#creation-name').value;
        root = GameData.rollSpiritualRoot();
        render();
      });
      overlay.querySelector('#begin-cultivation').addEventListener('click', () => {
        const name = overlay.querySelector('#creation-name').value;
        Game.createCharacter(gender, name, root);
        this.applyGenderEmblem();
        this.renderAll();
        overlay.remove();
        this.toast(`☯ Welcome, ${Game.state.name}. Your ${root.name} awaits its destiny.`);
      });
      // Painted portrait for the rolled root, with vector fallback.
      this.setPortrait(overlay.querySelector('#creation-portrait'), Game.portraitSrc(gender, root.key), g.emblem);
    };

    render();
    document.body.appendChild(overlay);
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
