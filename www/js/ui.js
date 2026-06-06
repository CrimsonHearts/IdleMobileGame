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
      stone: $('stone-amount'),
      egg: $('egg-amount'),
      sectPanel: $('tab-sect'),
      beastsPanel: $('tab-beasts'),
      trialsPanel: $('tab-trials'),
      realm: $('realm-name'),
      realmCN: $('realm-name-cn'),
      stageName: $('stage-name'),
      stageNameCN: $('stage-name-cn'),
      charName: $('char-name'),
      charRoot: $('char-root'),
      cbBonus: $('cb-bonus'),
      dao: $('dao-amount'),
      tapBtn: $('meditate-btn'),
      tapEmblem: $('tap-emblem'),
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
    this.el.tapEmblem.src = Game.genderInfo().emblem;
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
    if (this.activeTab === 'sect') this.renderSect();
    else if (this.activeTab === 'beasts') this.renderBeasts();
    else if (this.activeTab === 'trials') this.renderTrials();
  },

  renderResources() {
    this.el.qi.textContent = GameNumbers.formatNumber(Game.state.qi);
    this.el.qps.textContent = GameNumbers.formatRate(Game.qiPerSecond());
    this.el.stone.textContent = GameNumbers.formatNumber(Game.state.spiritStones);
    this.el.egg.textContent = GameNumbers.formatNumber(Game.state.beastEggs);
    this.el.dao.textContent = GameNumbers.formatNumber(Game.state.daoComprehension);
    this.el.tapGain.textContent = '+' + GameNumbers.formatNumber(Game.qiPerTap());
  },

  /** Called each frame by main loop: always refresh the strip + the live tab. */
  tickRender() {
    this.renderResources();
    switch (this.activeTab) {
      case 'cultivate': this.renderShop(); this.renderRealm(); break;
      case 'trials':    this.renderTrialsLive(); break;
      case 'techniques':this.renderUpgrades(); break;
      // sect/beasts are static enough to render on entry only.
    }
  },

  /** Full (re)render of whichever tab just became active. */
  renderActiveTab() {
    this.renderResources();
    switch (this.activeTab) {
      case 'cultivate':  this.renderShop(); this.renderRealm(); break;
      case 'sect':       this.renderSect(); break;
      case 'beasts':     this.renderBeasts(); break;
      case 'trials':     this.renderTrials(); break;
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
    this.el.charRoot.textContent = root.nameCN;
    this.el.charRoot.style.color = root.color;
    this.el.cbBonus.textContent = (Game.state.stagesCleared * GameData.stageBonusPerStage * 100).toFixed(0);

    // -- Realm + stage labels ---------------------------------------------
    const tier = Game.tierLabel();
    this.el.realm.textContent = tier.realm;
    this.el.realmCN.textContent = tier.realmCN;
    this.el.stageName.textContent = tier.stage;
    this.el.stageNameCN.textContent = tier.stageCN;

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
      const nextStageCN = realm.stagesCN[Game.state.stage];
      this.el.advanceBtn.textContent = canAdvance
        ? `⬆ Breakthrough → ${nextStage} (${nextStageCN})`
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
        ? `⚡ Face the Heavenly Tribulation to ascend to <b>${next.name} (${next.nameCN})</b> for <b>+${GameNumbers.formatNumber(gain)}</b> 道韵.`
        : `Advance through all stages of <b>${tier.realm}</b>, then face Tribulation to ascend to <b>${next.name}</b>.`;
    }
  },

  multAll() {
    const m = Game.multipliers();
    return m.allMult * m.root * m.stage * m.dao * m.sect * m.pet;
  },

  // Helper: an inline icon from the sprite.
  iconSvg(id, cls) { return `<svg class="${cls || ''}" viewBox="0 0 100 100"><use href="#${id}"/></svg>`; },

  // ======================================================================
  // SECT TAB
  // ======================================================================
  renderSect() {
    const el = this.el.sectPanel;
    const cur = Sect.current();
    if (!cur) {
      el.innerHTML = `
        <div class="section-title">⛩ Choose Your Sect 选择宗门</div>
        <p class="hint">Join one of the great cultivation orders for a permanent bonus.
          ${Sect.isOnline() ? 'Other cultivators share your sect online.' : 'Online sects with real members can be enabled later.'}</p>
        <div id="sect-grid"></div>`;
      const grid = el.querySelector('#sect-grid');
      Sect.data.forEach(s => {
        const card = document.createElement('div');
        card.className = 'sect-card';
        card.style.borderColor = s.color;
        card.innerHTML = `
          <div class="sect-seal" style="background:${s.color}">${s.seal}</div>
          <div class="sect-body">
            <div class="sect-name" style="color:${s.color}">${s.nameCN} <em>${s.name}</em></div>
            <div class="sect-desc">${s.desc}</div>
            <div class="sect-bonus">✦ ${s.bonusDesc}</div>
          </div>
          <button class="sect-join">Join 加入</button>`;
        card.querySelector('.sect-join').addEventListener('click', async () => {
          await Sect.join(s.id);
          this.renderSect(); this.renderResources();
          this.toast(`⛩ You have joined ${s.nameCN}!`);
        });
        grid.appendChild(card);
      });
      return;
    }

    // Member of a sect — show the hall.
    const rank = Sect.rank(), nextR = Sect.nextRank(), idx = Sect.rankIndex();
    const contrib = Sect.contribution();
    const prog = nextR ? Math.min(1, (contrib - rank.req) / (nextR.req - rank.req)) : 1;
    el.innerHTML = `
      <div class="sect-hall">
        <div class="sect-seal big" style="background:${cur.color}">${cur.seal}</div>
        <div class="sect-name" style="color:${cur.color}">${cur.nameCN} <em>${cur.name}</em></div>
        <div class="sect-rank">${rank.nameCN} · ${rank.name}</div>
        <div class="sect-bonus">✦ ${cur.bonusDesc}</div>
        <div class="progress-track small"><div class="fill" style="width:${(prog*100).toFixed(1)}%;background:${cur.color}"></div></div>
        <div class="hint">贡献 Contribution: ${GameNumbers.formatNumber(contrib)}${nextR ? ' / ' + GameNumbers.formatNumber(nextR.req) + ' → ' + nextR.nameCN : ' (max rank)'}</div>
      </div>
      <div class="section-title">Disciples 同门 ${Sect.isOnline() ? '' : '<small>(local)</small>'}</div>
      <div id="sect-members" class="members"></div>
      <button id="sect-leave" class="danger-btn">Leave Sect 退出宗门</button>`;
    el.querySelector('#sect-leave').addEventListener('click', async () => {
      if (confirm('Leave your sect? You will forfeit all Contribution (贡献).')) {
        await Sect.leave(); this.renderSect(); this.toast('You have left the sect.');
      }
    });
    Sect.backend.members(cur.id).then(members => {
      const box = el.querySelector('#sect-members');
      if (!box) return;
      box.innerHTML = `<div class="member you"><span>You · ${Game.state.name}</span><span>${rank.nameCN}</span></div>` +
        members.map(m => `<div class="member"><span>${m.name} <em>${m.realm.nameCN}</em></span><span>${m.rank.nameCN}</span></div>`).join('');
    });
  },

  // ======================================================================
  // BEASTS TAB
  // ======================================================================
  renderBeasts() {
    const el = this.el.beastsPanel;
    const active = Pets.active();
    el.innerHTML = `
      <div class="section-title">🐾 Spirit Beasts 灵兽阁</div>
      <div class="tame-bar">
        <div>兽蛋 Beast Eggs: <b>${GameNumbers.formatNumber(Game.state.beastEggs)}</b></div>
        <button id="tame-btn" ${Game.state.beastEggs < 1 ? 'disabled' : ''}>✦ Tame a Beast (1 兽蛋)</button>
      </div>
      <div class="hint">Active beasts (${active.length}/${Pets.MAX_ACTIVE}) fight in Trials. All owned beasts boost cultivation.</div>
      <div id="beast-grid"></div>`;
    el.querySelector('#tame-btn').addEventListener('click', () => {
      const r = Pets.tame();
      if (r) {
        const rar = PET_RARITY[r.pet.rarity];
        this.toast(`${r.duplicate ? '★ Duplicate! ' + r.pet.nameCN + ' levelled up' : 'Tamed ' + rar.nameCN + ' ' + r.pet.nameCN + ' ' + r.pet.name + '!'}`);
        this.renderBeasts(); this.renderResources();
      }
    });
    const grid = el.querySelector('#beast-grid');
    Pets.data.forEach(p => {
      const owned = Pets.isOwned(p.id);
      const rar = PET_RARITY[p.rarity];
      const lvl = Pets.levelOf(p.id);
      const card = document.createElement('div');
      card.className = 'beast-card' + (owned ? '' : ' locked') + (Pets.isActive(p.id) ? ' active' : '');
      card.style.borderColor = owned ? rar.color : 'rgba(255,255,255,0.12)';
      card.innerHTML = `
        <div class="beast-icon" style="color:${owned ? rar.color : '#5a5248'}">${this.iconSvg(p.icon, 'beast-svg')}</div>
        <div class="beast-main">
          <div class="beast-name" style="color:${owned ? rar.color : '#8a8278'}">${p.nameCN} <em>${p.name}</em>
            <span class="rar" style="color:${rar.color}">${rar.nameCN}</span></div>
          ${owned ? `<div class="beast-stats">Lv.${lvl} · +${(Pets.qiBonusOf(p.id)*100).toFixed(1)}% Qi · ⚔${GameNumbers.formatNumber(Pets.atkOf(p.id))} · ♥${GameNumbers.formatNumber(Pets.hpOf(p.id))}</div>`
                  : `<div class="beast-stats">${p.desc}</div>`}
        </div>
        <div class="beast-actions">
          ${owned ? `
            <button class="beast-active-btn ${Pets.isActive(p.id)?'on':''}">${Pets.isActive(p.id)?'Active':'Deploy'}</button>
            <button class="beast-lvl-btn" ${Game.state.spiritStones < Pets.levelUpCost(p.id) ? 'disabled':''}>Lv↑ ${GameNumbers.formatNumber(Pets.levelUpCost(p.id))}灵石</button>`
            : `<span class="locked-tag">未捕获</span>`}
        </div>`;
      if (owned) {
        card.querySelector('.beast-active-btn').addEventListener('click', () => { Pets.toggleActive(p.id); this.renderBeasts(); });
        card.querySelector('.beast-lvl-btn').addEventListener('click', () => { if (Pets.levelUp(p.id)) { this.renderBeasts(); this.renderResources(); } });
      }
      grid.appendChild(card);
    });
  },

  // ======================================================================
  // TRIALS TAB (idle combat)
  // ======================================================================
  renderTrials() {
    const el = this.el.trialsPanel;
    Combat.ensurePlayerHp(); Combat.mob();
    const c = Game.state.combat;
    el.innerHTML = `
      <div class="section-title">⚔ Trials 历练 <small>Zone <b id="trial-zone">${c.zone}</b> · Wave <b id="trial-wave">${c.wave}</b></small></div>
      <div class="battle">
        <div class="fighter">
          <div class="fighter-name">${Game.state.name} <em>${Game.tierLabel().realmCN}</em></div>
          <div class="hp-track"><div id="p-hp" class="hp player"></div></div>
          <div class="fighter-stats"><span id="p-hp-text"></span> · ⚔<span id="p-atk"></span></div>
        </div>
        <div class="vs">⚔</div>
        <div class="fighter">
          <div class="mob-icon" id="m-icon"></div>
          <div class="fighter-name" id="m-name"></div>
          <div class="hp-track"><div id="m-hp" class="hp mob"></div></div>
          <div class="fighter-stats"><span id="m-hp-text"></span> · ⚔<span id="m-atk"></span></div>
        </div>
      </div>
      <div class="trial-controls">
        <button id="trial-pause">${c.paused?'▶ Resume':'⏸ Pause'}</button>
        <button id="trial-retreat" ${c.zone<=1?'disabled':''}>◀ Zone</button>
        <button id="trial-push" ${(c.highestZone||1)<=c.zone?'disabled':''}>Zone ▶</button>
      </div>
      <div id="trial-log" class="trial-log"></div>`;
    el.querySelector('#trial-pause').addEventListener('click', () => { c.paused = !c.paused; this.renderTrials(); });
    el.querySelector('#trial-retreat').addEventListener('click', () => { Combat.retreatZone(); this.renderTrials(); });
    el.querySelector('#trial-push').addEventListener('click', () => { Combat.pushZone(); this.renderTrials(); });
    this.renderTrialsLive();
  },

  renderTrialsLive() {
    const el = this.el.trialsPanel;
    const z = el.querySelector('#trial-zone'); if (!z) return; // tab not built yet
    const c = Game.state.combat, mob = Combat.mob();
    const pMax = Combat.playerHpMax(), pHp = Math.max(0, c.playerHp || 0);
    z.textContent = c.zone; el.querySelector('#trial-wave').textContent = c.wave;
    el.querySelector('#p-hp').style.width = (pHp / pMax * 100).toFixed(1) + '%';
    el.querySelector('#p-hp-text').textContent = GameNumbers.formatNumber(pHp) + '/' + GameNumbers.formatNumber(pMax) + ' ♥';
    el.querySelector('#p-atk').textContent = GameNumbers.formatNumber(Combat.playerAtk());
    const mIcon = el.querySelector('#m-icon');
    mIcon.innerHTML = this.iconSvg(mob.icon, 'mob-svg');
    mIcon.classList.toggle('boss', !!mob.boss);
    el.querySelector('#m-name').innerHTML = `${mob.nameCN} <em>${mob.name}</em>${mob.boss?' <span class="boss-tag">BOSS</span>':''}`;
    el.querySelector('#m-hp').style.width = (Math.max(0, mob.hp) / mob.maxHp * 100).toFixed(1) + '%';
    el.querySelector('#m-hp-text').textContent = GameNumbers.formatNumber(Math.max(0, mob.hp)) + '/' + GameNumbers.formatNumber(mob.maxHp) + ' ♥';
    el.querySelector('#m-atk').textContent = GameNumbers.formatNumber(mob.atk);
    el.querySelector('#trial-log').innerHTML = Combat.log.map(l => `<div>${l}</div>`).join('');
  },

  // -- Minor breakthrough ---------------------------------------------------
  doAdvanceStage() {
    const result = Game.advanceStage();
    if (result) {
      Game.persist();
      this.renderAll();
      const tier = Game.tierLabel();
      this.toast(`修为精进 · Advanced to ${tier.realm} · ${tier.stage} (+${(GameData.stageBonusPerStage*100).toFixed(0)}% power)`);
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
          <p class="creation-sub">踏上仙途 · Forge your path to immortality.</p>

          <div class="creation-emblem"><img src="${g.emblem}" alt="cultivator"/></div>

          <div class="creation-field">
            <label>Dao Name 道号</label>
            <input id="creation-name" type="text" maxlength="20" placeholder="Enter a name…" value="${this._creationName || ''}"/>
          </div>

          <div class="creation-field">
            <label>Body 身</label>
            <div class="gender-row">
              <button class="gender-btn ${gender==='male'?'active':''}" data-g="male">男 Male</button>
              <button class="gender-btn ${gender==='female'?'active':''}" data-g="female">女 Female</button>
            </div>
          </div>

          <div class="creation-field">
            <label>Spiritual Root 灵根</label>
            <div class="root-display" style="border-color:${root.color}">
              <div class="root-name" style="color:${root.color}">${root.nameCN} · ${root.name}</div>
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
        this.toast(`☯ Welcome, ${Game.state.name}. Your ${root.nameCN} awaits its destiny.`);
      });
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
