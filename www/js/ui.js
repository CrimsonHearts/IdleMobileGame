/* ===========================================================================
 * ui.js — Renders game state to the DOM and wires up interactions.
 * Kept separate from game logic so the engine stays testable / portable.
 * ========================================================================= */

const UI = {
  el: {},          // cached DOM refs
  buyAmount: 1,    // 1 | 10 | 'max'
  _builtShop: false,
  _breakthroughCount: 0,   // show interstitial every 3rd breakthrough
  _stageAidActive: false,  // 30% stage requirement reduction from ad

  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      qi: $('qi-amount'),
      qps: $('qps'),
      money: $('money-amount'),
      age: $('age-val'),
      gen: $('gen-val'),
      studyPanel: $('tab-study'),
      workPanel: $('tab-work'),
      lifePanel: $('lsub-partner'),
      lineagePanel: $('lsub-lineage'),
      realm: $('realm-name'),
      stageName: $('stage-name'),
      charName: $('char-name'),
      charRoot: $('char-root'),
      cbBonus: $('cb-bonus'),
      mps: $('mps'),
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
      shards: $('res-shards'),
      shardsChip: $('shards-chip'),
    };
    this.activeTab = 'cultivate';

    // Meditate (tap).
    this.el.tapBtn.addEventListener('click', e => {
      const res = Game.meditate();
      const gain = (res && typeof res === 'object') ? res.gain : res;
      const crit = !!(res && res.crit);
      if (navigator.vibrate) navigator.vibrate(crit ? [12, 8, 20] : 12);
      this.floatText(e, (crit ? '✦ CRIT +' : '+') + GameNumbers.formatNumber(gain) + ' ' + GameData.theme.currencyIcon, crit);
      this.flashQiCounter();
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

    // World sub-navigation (Trials / Beasts / Sect).
    this.worldSub = 'trials';
    document.querySelectorAll('#world-subnav .subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.worldSub = btn.dataset.sub;
        document.querySelectorAll('#world-subnav .subnav-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('#tab-world .subpanel').forEach(p =>
          p.classList.toggle('active', p.id === 'sub-' + this.worldSub));
        this.renderWorld();
      });
    });

    // Arts sub-navigation (Techniques / Meridians).
    this.artsSub = 'techniques';
    document.querySelectorAll('#arts-subnav .subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.artsSub = btn.dataset.asub;
        document.querySelectorAll('#arts-subnav .subnav-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('#tab-techniques .subpanel').forEach(p =>
          p.classList.toggle('active', p.id === 'asub-' + this.artsSub));
        if (this.artsSub === 'meridians') this.renderMeridians();
        else if (this.artsSub === 'blood') this.renderBlood();
        else if (this.artsSub === 'spirit') this.renderSpirit();
        else if (this.artsSub === 'heaven') this.renderHeaven();
        else if (this.artsSub === 'alchemy') this.renderAlchemy();
        else this.renderUpgrades();
      });
    });

    // Life sub-navigation (Partner / Lineage).
    this.lifeSub = 'partner';
    document.querySelectorAll('#life-subnav .subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.lifeSub = btn.dataset.lsub;
        document.querySelectorAll('#life-subnav .subnav-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('#tab-life .subpanel').forEach(p =>
          p.classList.toggle('active', p.id === 'lsub-' + this.lifeSub));
        if (this.lifeSub === 'lineage') this.renderLineage();
        else Family.render(this.el.lifePanel);
      });
    });

    // Minor + major breakthroughs.
    this.el.advanceBtn.addEventListener('click', () => this.doAdvanceStage());
    this.el.breakBtn.addEventListener('click', () => this.doBreakthrough());

    // Shop button in topbar.
    const shopBtn = document.getElementById('shop-btn');
    if (shopBtn) shopBtn.addEventListener('click', () => this.showShop());

    // Quest button in topbar.
    const questBtn = document.getElementById('quest-btn');
    if (questBtn) questBtn.addEventListener('click', () => this.showQuests());

    // Daily rewards button.
    const dailyBtn = document.getElementById('daily-btn');
    if (dailyBtn) dailyBtn.addEventListener('click', () => this.showDaily());

    // Avatar → Cultivation Record
    if (this.el.avatar) this.el.avatar.addEventListener('click', () => this.showStats());

    // Cultivation % → multiplier breakdown
    const cultWrap = document.getElementById('cult-bonus-wrap');
    if (cultWrap) cultWrap.addEventListener('click', () => this.showCultivationBreakdown());

    // Ad boost buttons on Cultivate tab.
    const boostQiBtn = document.getElementById('boost-qi-btn');
    if (boostQiBtn) boostQiBtn.addEventListener('click', () => this.doAdBoostQi());
    const boostStageBtn = document.getElementById('boost-stage-btn');
    if (boostStageBtn) boostStageBtn.addEventListener('click', () => this.doAdBoostStage());

    this.buildShop();
    this.buildUpgrades();
    this.applyGenderEmblem();
    this.renderAll();
    this._startAmbientParticles();

    // First-run character creation.
    if (!Game.state.characterCreated) {
      this.showCharacterCreation();
    } else {
      // Returning player: surface the daily reward if it's a new day
      // (not while the Daily feature is still onboarding-locked).
      this.updateDailyBadge();
      if (Game.dailyAvailable()) setTimeout(() => {
        if (!window.Onboarding || Onboarding.isUnlocked('daily')) this.showDaily();
      }, 600);
    }
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
      this.bounceGen(id);
    }
  },

  doBreakthrough() {
    if (!Game.canBreakThrough()) return;
    const overlay = this._openModal();
    if (!overlay) return;
    const next = Game.nextRealm();
    const gain = Game.pendingDaoGain();
    // Preview foundation quality so the player can make an informed choice.
    const realm = Game.currentRealm();
    const fqRatio = realm.reqQi > 0 ? Game.state.runQi / realm.reqQi : 0;
    const fq = GameData.foundationQualities.find(q => fqRatio >= q.minRatio);
    const nextFq = GameData.foundationQualities.slice().reverse().find(q => q.minRatio > fqRatio);
    const fqHtml = fq ? `
      <div class="fq-badge" style="border-color:${fq.color};background:${fq.color}18;margin:10px 0">
        <span class="fq-name" style="color:${fq.color}">${fq.name}</span>
        <span class="fq-desc">${fq.desc}${fq.bonus > 0 ? ` <b>+${(fq.bonus*100).toFixed(0)}% permanent</b>` : ''}</span>
        ${nextFq ? `<span class="fq-next">Cultivate to ${(nextFq.minRatio).toFixed(1)}× req Qi for <b style="color:${nextFq.color}">${nextFq.name}</b></span>` : ''}
      </div>` : '';

    const needPill = Game.pillRequired();
    const chance = (Game.tribulationChance() * 100).toFixed(0);
    const riskHtml = needPill
      ? `<p class="hint" style="margin-top:6px">Success chance: <b>${chance}%</b> (raised by Talent & Intellect) ·
         consumes <b>1 Breakthrough Pill</b>.<br>On failure the pill is lost and
         ${(GameData.tribulation.failRunQiLoss * 100).toFixed(0)}% of this life's Qi scatters.</p>`
      : '';
    overlay.innerHTML = `
      <div class="modal">
        <h2>⚡ Heavenly Tribulation</h2>
        <p>Face the Tribulation to ascend to <b>${next.name}</b>.<br><br>
           You will gain <b>+${GameNumbers.formatNumber(gain)} Dao Comprehension</b>,
           granting <b>+${(gain * GameData.daoBonusPerPoint * 100).toFixed(0)}%</b> permanent production.<br><br>
           Your Qi and all generators will reset. Your progress and Spiritual Root remain.</p>
        ${riskHtml}
        ${fqHtml}
        <button class="btn-primary" id="confirm-tribulation" style="background:linear-gradient(180deg,#e7b94e,var(--gold-d));box-shadow:0 4px 14px rgba(199,154,59,0.4)">
          ⚡ Face the Tribulation${needPill ? ` (${chance}%)` : ''}
        </button>
        <button class="btn-ghost" id="cancel-tribulation" style="margin-top:8px">Not yet</button>
      </div>`;
    overlay.querySelector('#confirm-tribulation').addEventListener('click', () => {
      overlay.remove();
      const result = Game.breakThrough();
      if (result && result.failed) {
        Game.persist();
        this.renderAll();
        this.toast('⛈ The Tribulation lightning proved too fierce — the attempt failed. Recover and try again.');
        return;
      }
      if (result) {
        this.breakthroughFlash();
        if (navigator.vibrate) navigator.vibrate([30, 25, 60]);
        Game.persist();
        this.renderAll();
        const fqMsg = result.quality && result.quality.bonus > 0
          ? ` · ${result.quality.name} (+${(result.quality.bonus*100).toFixed(0)}%)` : '';
        this.toast(`☯ Ascended to ${result.realm.name}! +${GameNumbers.formatNumber(result.gain)} Dao${fqMsg}`);
        if (result.conditionsHit && result.conditionsHit.length) {
          setTimeout(() => this.showBreakthroughConditions(result.conditionsHit), 800);
        }
        // Show interstitial every 3rd breakthrough only — don't punish every ascension.
        this._breakthroughCount = (this._breakthroughCount || 0) + 1;
        if (this._breakthroughCount % 3 === 0) Monetization.showInterstitial();
      }
    });
    overlay.querySelector('#cancel-tribulation').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  // -- Rendering ------------------------------------------------------------
  renderAll() {
    this.renderResources();
    this.renderShop();
    this.renderUpgrades();
    this.renderRealm();
    if (this.activeTab === 'study') Life.renderStudy(this.el.studyPanel);
    else if (this.activeTab === 'work') Life.renderWork(this.el.workPanel);
    else if (this.activeTab === 'life') {
      if (this.lifeSub === 'lineage') this.renderLineage();
      else Family.render(this.el.lifePanel);
    }
  },

  renderResources() {
    this.el.qi.textContent = GameNumbers.formatNumber(Game.state.qi);
    this.el.qps.textContent = GameNumbers.formatRate(Game.qiPerSecond());
    if (this.el.money && Game.state.life) {
      this.el.money.textContent = GameNumbers.formatNumber(Game.state.life.money);
      if (this.el.mps && window.Life) {
        const rate = Life.jobPayRate();
        if (rate > 0) { this.el.mps.textContent = GameNumbers.formatRate(rate); this.el.mps.style.display = ''; }
        else this.el.mps.style.display = 'none';
      }
    }
    if (this.el.age && Game.state.life) this.el.age.textContent = Game.state.life.age + '/' + Game.lifespan();
    if (this.el.gen) this.el.gen.textContent = Game.state.generation || 1;
    this.el.dao.textContent = GameNumbers.formatNumber(Game.state.daoComprehension);
    this.el.tapGain.textContent = '+' + GameNumbers.formatNumber(Game.qiPerTap());
    if (this.el.shards) {
      const shards = Game.state.stellarShards || 0;
      this.el.shards.textContent = GameNumbers.formatNumber(shards);
      if (this.el.shardsChip) {
        this.el.shardsChip.style.display = shards > 0 || (Game.state.combat && Game.state.combat.highestZone >= 3) ? '' : 'none';
      }
    }
  },

  /** Called each frame by main loop: always refresh the strip + the live tab. */
  tickRender() {
    this.renderResources();
    switch (this.activeTab) {
      case 'cultivate':  this.renderShop(); this.renderRealm(); this.renderBoosts(); break;
      case 'study':      if (Life.isStudying()) Life.renderStudy(this.el.studyPanel); break;
      case 'techniques':
        if (this.artsSub === 'alchemy') this.renderAlchemyBuffs();
        else if (this.artsSub === 'blood') this.renderBloodLive();
        else if (this.artsSub === 'spirit') this.renderSpiritLive();
        else this.renderUpgrades();
        break;
      case 'world':
        if (this.worldSub === 'trials') this.renderTrialsLive();
        else if (this.worldSub === 'boosters') this.renderBoostersLive();
        else if (this.worldSub === 'dailies') this.renderDailiesLive();
        else if (this.worldSub === 'fracture') this.renderFractureLive();
        break;
    }
  },

  /** Full (re)render of whichever tab just became active. */
  renderActiveTab() {
    this.renderResources();
    switch (this.activeTab) {
      case 'cultivate':  this.renderShop(); this.renderRealm(); break;
      case 'study':      Life.renderStudy(this.el.studyPanel); break;
      case 'work':       Life.renderWork(this.el.workPanel); break;
      case 'life':
        if (this.lifeSub === 'lineage') this.renderLineage();
        else Family.render(this.el.lifePanel);
        break;
      case 'techniques':
        if (this.artsSub === 'meridians') this.renderMeridians();
        else if (this.artsSub === 'blood') this.renderBlood();
        else if (this.artsSub === 'spirit') this.renderSpirit();
        else if (this.artsSub === 'heaven') this.renderHeaven();
        else if (this.artsSub === 'alchemy') this.renderAlchemy();
        else this.renderUpgrades();
        break;
      case 'world':      this.renderWorld(); break;
    }
  },

  renderShop() {
    // Synergy banner — rewards mastering many generators.
    const banner = document.getElementById('synergy-banner');
    if (banner) {
      const mastered = Game.synergyCount();
      const total = GameData.generators.length;
      if (mastered > 0) {
        banner.style.display = '';
        banner.innerHTML = `🔗 <b>Spirit Synergy</b> · ${mastered}/${total} grounds mastered (${GameData.synergyThreshold}+) · <b>+${(mastered*GameData.synergyBonusPer*100).toFixed(0)}%</b> global Qi`;
      } else {
        banner.style.display = 'none';
      }
    }
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
      const msMult = GameData.genMilestoneMultiplier(owned);
      const each = g.baseProd * this.multAll() * msMult * Game.synergyMult();
      let sub = GameNumbers.formatRate(each) + ' each' + (owned > 0 ? ` · ${GameNumbers.formatRate(each * owned)} total` : '');
      // Milestone progress badge.
      const nextMs = GameData.nextGenMilestone(owned);
      if (owned > 0) {
        sub += msMult > 1 ? ` · ⚡×${GameNumbers.formatNumber(msMult)}` : '';
        if (nextMs) sub += ` · next ⚡ at ${nextMs}`;
      }
      document.getElementById('gen-sub-' + g.id).textContent = sub;
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

  // -- Meridian Tree (Round 2) ---------------------------------------------
  renderMeridians() {
    const el = document.getElementById('asub-meridians');
    if (!el) return;
    const dao = Game.state.daoComprehension;
    const spent = Game.meridianTotalSpent();

    // Live summary of all active meridian bonuses.
    const fmtPct = v => `+${Math.round(v*100)}%`;
    const bonusBits = [];
    if (Game.meridianMult('qi'))      bonusBits.push(`${fmtPct(Game.meridianMult('qi'))} Qi`);
    if (Game.meridianMult('tap'))     bonusBits.push(`${fmtPct(Game.meridianMult('tap'))} Tap`);
    if (Game.meridianMult('combat'))  bonusBits.push(`${fmtPct(Game.meridianMult('combat'))} Combat`);
    if (Game.meridianMult('offline')) bonusBits.push(`${fmtPct(Game.meridianMult('offline'))} Offline`);
    if (Game.meridianMult('pet'))     bonusBits.push(`${fmtPct(Game.meridianMult('pet'))} Beasts`);
    if (Game.meridianMult('daoGain')) bonusBits.push(`${fmtPct(Game.meridianMult('daoGain'))} Dao gain`);
    if (Game.meridianMult('crit'))    bonusBits.push(`${Math.round(Game.meridianMult('crit')*100)}% Crit`);

    let html = `
      <div class="section-title">🧬 Meridian Tree</div>
      <div class="meridian-head card">
        <div class="row-between">
          <div><div class="card-title">☯ ${GameNumbers.formatNumber(dao)} Dao available</div>
            <div class="hint" style="margin:4px 0 0">Open meridians to permanently shape your cultivation. Each node needs the one before it.</div></div>
          <button class="btn-mini" id="meridian-respec" ${spent>0?'':'disabled'}>↺ Respec</button>
        </div>
        ${bonusBits.length ? `<div class="meridian-bonus-summary">${bonusBits.map(b=>`<span class="mb-chip">${b}</span>`).join('')}</div>` : ''}
      </div>
      <div class="meridian-grid">`;

    GameData.meridianPaths.forEach(path => {
      html += `<div class="meridian-col">
        <div class="meridian-col-head" style="color:${path.color}">${path.icon} ${path.name}</div>`;
      const nodes = GameData.meridians.filter(n => n.path === path.key).sort((a,b)=>a.tier-b.tier);
      nodes.forEach((n, i) => {
        const open = Game.meridianOpen(n.id);
        const prereqMet = !n.requires || Game.meridianOpen(n.requires);
        const affordable = dao >= n.cost;
        let state = 'locked';
        if (open) state = 'open';
        else if (prereqMet && affordable) state = 'ready';
        else if (prereqMet) state = 'avail';
        if (i > 0) html += `<div class="meridian-link ${open?'lit':''}"></div>`;
        html += `<button class="meridian-node ${state}" data-mid="${n.id}" style="--mc:${path.color}"
            ${(state==='ready')?'':'disabled'}>
          <span class="mn-ico">${n.icon}</span>
          <span class="mn-name">${n.name}</span>
          <span class="mn-desc">${n.desc}</span>
          <span class="mn-cost">${open ? '✓ Opened' : '☯ ' + n.cost}</span>
        </button>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    el.querySelectorAll('.meridian-node[data-mid]').forEach(b => b.addEventListener('click', () => {
      if (Game.openMeridian(b.dataset.mid)) {
        const n = Game.meridianNode(b.dataset.mid);
        this.toast(`🧬 Opened ${n.name}!`);
        this.renderMeridians(); this.renderResources(); this.renderRealm();
      }
    }));
    const respec = el.querySelector('#meridian-respec');
    if (respec) respec.addEventListener('click', () => {
      const refund = Game.respecMeridians();
      this.toast(`↺ Meridians reset · ${GameNumbers.formatNumber(refund)} Dao refunded`);
      this.renderMeridians(); this.renderResources(); this.renderRealm();
    });
  },

  // -- Blood Essence (Jing): body refinement earned from Trials -----------
  renderBlood() {
    const el = document.getElementById('asub-blood');
    if (!el) return;
    if (!Game.combatUnlocked()) {
      el.innerHTML = `<div class="section-title">🩸 Blood Essence</div>
        <div class="locked-inline">Reach Qi Condensation to enter Trials — Blood Essence is earned from every kill.</div>`;
      return;
    }
    const essence = Game.state.blood.essence;
    let html = `
      <div class="section-title">🩸 Blood Essence <small id="blood-essence-num">🩸 ${GameNumbers.formatNumber(essence)}</small></div>
      <div class="hint">Refine your body with Blood Essence earned from Trials kills. Every rank is permanent — no equip cap.</div>
      <div class="perk-list">`;
    BLOOD_DATA.forEach(b => {
      const rank = Blood.rankOf(b.id);
      const maxed = rank >= Blood.MAX_RANK;
      const cost = Blood.refineCost(b.id);
      const affordable = essence >= cost;
      html += `
        <div class="perk-row ${maxed ? 'maxed' : ''}">
          <span class="perk-ico">${b.icon}</span>
          <span class="perk-info">
            <span class="perk-name">${b.name} <span class="perk-lvl">Lv ${rank}/${Blood.MAX_RANK}</span></span>
            <span class="perk-desc">${Blood.effectText(b.id)}</span>
          </span>
          <button class="btn-mini perk-buy" data-blood="${b.id}" ${(maxed || !affordable) ? 'disabled' : ''}>
            ${maxed ? 'MAX' : `🩸 ${GameNumbers.formatNumber(cost)}`}
          </button>
        </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    el.querySelectorAll('.perk-buy[data-blood]').forEach(btn => btn.addEventListener('click', () => {
      if (Blood.refine(btn.dataset.blood)) {
        const b = Blood.get(btn.dataset.blood);
        this.toast(`🩸 ${b.name} → Lv ${Blood.rankOf(b.id)}`);
        this.renderBlood();
      }
    }));
  },
  renderBloodLive() {
    const num = document.getElementById('blood-essence-num');
    if (num) num.textContent = `🩸 ${GameNumbers.formatNumber(Game.state.blood.essence)}`;
  },

  // -- Spirit (Shen): soul cultivation unlocked at Nascent Soul ------------
  renderSpirit() {
    const el = document.getElementById('asub-spirit');
    if (!el) return;
    if (!Spirit.unlocked()) {
      const req = GameData.realms[Spirit.REALM_REQ];
      el.innerHTML = `<div class="section-title">🌌 Spirit</div>
        <div class="locked-inline">Reach <b>${req.name}</b> to awaken your Spirit — a sliver of every Qi gained will condense into it.</div>`;
      return;
    }
    const essence = Game.state.spirit.essence;
    let html = `
      <div class="section-title">🌌 Spirit <small id="spirit-essence-num">🌌 ${GameNumbers.formatNumber(essence)}</small></div>
      <div class="hint">Spirit condenses from a sliver of every Qi you gain. Spend it on Spirit Insight — permanent soul-cultivation bonuses.</div>
      <div class="perk-list">`;
    SPIRIT_DATA.forEach(s => {
      const rank = Spirit.rankOf(s.id);
      const maxed = rank >= Spirit.MAX_RANK;
      const cost = Spirit.insightCost(s.id);
      const affordable = essence >= cost;
      html += `
        <div class="perk-row ${maxed ? 'maxed' : ''}">
          <span class="perk-ico">${s.icon}</span>
          <span class="perk-info">
            <span class="perk-name">${s.name} <span class="perk-lvl">Lv ${rank}/${Spirit.MAX_RANK}</span></span>
            <span class="perk-desc">${Spirit.effectText(s.id)}</span>
          </span>
          <button class="btn-mini perk-buy" data-spirit="${s.id}" ${(maxed || !affordable) ? 'disabled' : ''}>
            ${maxed ? 'MAX' : `🌌 ${GameNumbers.formatNumber(cost)}`}
          </button>
        </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    el.querySelectorAll('.perk-buy[data-spirit]').forEach(btn => btn.addEventListener('click', () => {
      if (Spirit.refine(btn.dataset.spirit)) {
        const s = Spirit.get(btn.dataset.spirit);
        this.toast(`🌌 ${s.name} → Lv ${Spirit.rankOf(s.id)}`);
        this.renderSpirit();
      }
    }));
  },
  renderSpiritLive() {
    const num = document.getElementById('spirit-essence-num');
    if (num) num.textContent = `🌌 ${GameNumbers.formatNumber(Game.state.spirit.essence)}`;
  },

  // -- Heaven (Reincarnation + Heavenly Perks, Round 3) --------------------
  renderHeaven() {
    const el = document.getElementById('asub-heaven');
    if (!el) return;
    const merit = Game.state.heavenlyMerit;
    const lives = Game.state.reincarnations;
    const canRe = Game.canReincarnate();
    const pending = Game.pendingMerit();
    const peak = GameData.realms[GameData.reincarnationRealmReq];

    let html = `
      <div class="section-title">☁️ Heavenly Dao</div>
      <div class="card reincarnate-card">
        <div class="reincarnate-top">
          <div class="merit-display"><span class="merit-num">🌟 ${GameNumbers.formatNumber(merit)}</span><span class="merit-label">Heavenly Merit</span></div>
          <div class="lives-display"><span class="lives-num">${lives}</span><span class="merit-label">Past Lives · +${(lives*GameData.reincarnationBonusPer*100).toFixed(0)}% Qi</span></div>
        </div>
        ${canRe ? `
          <div class="hint" style="text-align:center;margin:10px 0">Reincarnating resets your cultivation (realm, Dao, generators, meridians) but you keep beasts, sect, family — and gain permanent power.</div>
          <button class="btn-primary reincarnate-btn" id="reincarnate-btn">🌀 Reincarnate · +${GameNumbers.formatNumber(pending)} Merit</button>
        ` : `
          <div class="locked-inline">Reach <b>${peak.name}</b> to reincarnate. Each life beyond grants Heavenly Merit and a permanent +${(GameData.reincarnationBonusPer*100).toFixed(0)}% production.</div>
        `}
      </div>

      <div class="section-title small">🌟 Heavenly Perks <small>permanent across all lives</small></div>
      <div class="perk-list">`;

    GameData.heavenlyPerks.forEach(p => {
      const lvl = Game.perkLevel(p.id);
      const maxed = lvl >= p.maxLevel;
      const cost = Game.heavenlyPerkCost(p.id);
      const affordable = Game.canBuyHeavenlyPerk(p.id);
      html += `
        <div class="perk-row ${maxed?'maxed':''}">
          <span class="perk-ico">${p.icon}</span>
          <span class="perk-info">
            <span class="perk-name">${p.name} <span class="perk-lvl">Lv ${lvl}/${p.maxLevel}</span></span>
            <span class="perk-desc">${p.desc}</span>
          </span>
          <button class="btn-mini perk-buy" data-perk="${p.id}" ${affordable?'':'disabled'}>
            ${maxed ? 'MAX' : `🌟 ${GameNumbers.formatNumber(cost)}`}
          </button>
        </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    const rb = el.querySelector('#reincarnate-btn');
    if (rb) rb.addEventListener('click', () => this.confirmReincarnate());
    el.querySelectorAll('.perk-buy[data-perk]').forEach(b => b.addEventListener('click', () => {
      if (Game.buyHeavenlyPerk(b.dataset.perk)) {
        const p = Game.perkDef(b.dataset.perk);
        this.toast(`🌟 ${p.name} → Lv ${Game.perkLevel(b.dataset.perk)}`);
        this.renderHeaven(); this.renderResources(); this.renderRealm();
      }
    }));
  },

  confirmReincarnate() {
    const overlay = this._openModal();
    if (!overlay) return;
    const pending = Game.pendingMerit();
    overlay.innerHTML = `
      <div class="modal" style="text-align:center">
        <div style="font-size:48px;margin:6px 0">🌀</div>
        <h2>Reincarnate?</h2>
        <p>You will be reborn anew. Your realm, Dao Comprehension, generators and meridians reset — but you gain <b>🌟 ${GameNumbers.formatNumber(pending)} Heavenly Merit</b> and a permanent <b>+${(GameData.reincarnationBonusPer*100).toFixed(0)}% production</b>.<br><br>Beasts, sect, family and Heavenly Perks are kept.${window.Enchanting && Enchanting.heirloomId() ? `<br><br>⚜ <b>Heirloom</b> gains +1 Inheritance Stack (${Enchanting.heirloomStacks()} → ${Math.min(Enchanting.MAX_STACKS, Enchanting.heirloomStacks()+1)} / ${Enchanting.MAX_STACKS}, +${((Math.min(Enchanting.MAX_STACKS, Enchanting.heirloomStacks()+1)) * 6).toFixed(0)}% rune power).` : ''}</p>
        <button class="modal-close" id="confirm-re">🌀 Begin a New Life</button>
        <button class="btn-ghost" id="cancel-re" style="margin-top:8px">Not yet</button>
      </div>`;
    overlay.querySelector('#confirm-re').addEventListener('click', () => {
      const res = Game.reincarnate();
      overlay.remove();
      if (res) {
        this.breakthroughFlash();
        if (navigator.vibrate) navigator.vibrate([30, 25, 60]);
        this.renderAll();
        this.toast(`🌀 Reborn! +${GameNumbers.formatNumber(res.merit)} Heavenly Merit · Life #${res.reincarnations + 1}`);
        this.renderHeaven();
        if (res.reincarnations === 3 && !localStorage.getItem('pti_rated_app')) {
          setTimeout(() => this.askRating(), 800);
        }
      }
    });
    overlay.querySelector('#cancel-re').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  // -- Daily rewards (Round 3) ---------------------------------------------
  updateDailyBadge() {
    const badge = document.getElementById('daily-badge');
    if (badge) badge.style.display = Game.dailyAvailable() ? '' : 'none';
  },

  showDaily() {
    const overlay = this._openModal();
    if (!overlay) return;
    const render = () => {
      const avail = Game.dailyAvailable();
      const streak = Game.state.dailyStreak;
      const cycleLen = GameData.dailyRewards.length;
      // The day that will be claimed next (1-based within cycle).
      const nextIdx = avail ? (streak % cycleLen) : ((streak - 1 + cycleLen) % cycleLen);
      let html = `<div class="modal" style="text-align:center">
        <h2>🎁 Daily Cultivation</h2>
        <p style="margin-bottom:6px">Return each day for escalating blessings. Current streak: <b>${streak} day${streak===1?'':'s'}</b>.</p>
        <div class="daily-grid">`;
      GameData.dailyRewards.forEach((r, i) => {
        const claimedThisCycle = !avail && i === nextIdx;
        const isNext = avail && i === nextIdx;
        html += `<div class="daily-cell ${isNext?'next':''} ${claimedThisCycle?'claimed':''} ${r.day===7?'finale':''}">
          <div class="daily-day">Day ${r.day}</div>
          <div class="daily-ico">${r.icon}</div>
          <div class="daily-label">${r.label}</div>
          ${claimedThisCycle?'<div class="daily-check">✓</div>':''}
        </div>`;
      });
      html += `</div>`;
      if (avail) html += `<button class="modal-close" id="claim-daily">Claim Day ${nextIdx+1}</button>`;
      else html += `<button class="modal-close" id="close-daily" style="background:var(--surface-2);color:var(--muted)">Come back tomorrow</button>`;
      overlay.innerHTML = html;

      const cd = overlay.querySelector('#claim-daily');
      if (cd) cd.addEventListener('click', () => {
        const res = Game.claimDaily();
        if (res) {
          this.toast(`🎁 Day ${res.streak} claimed: ${res.reward.label}!`);
          this.renderAll(); this.updateDailyBadge();
          render();
        }
      });
      const close = overlay.querySelector('#close-daily');
      if (close) close.addEventListener('click', () => overlay.remove());
    };
    render();
    document.body.appendChild(overlay);
  },

  // -- Pill Alchemy (Round 4) ----------------------------------------------
  _buffLabel(key) { return key === 'qi' ? 'Qi' : key === 'combat' ? 'Combat' : key; },

  renderAlchemy() {
    const el = document.getElementById('asub-alchemy');
    if (!el) return;
    const stones = Game.state.spiritStones;
    const buffs = Game.activeBuffs();

    let html = `<div class="section-title">⚗️ Pill Alchemy <small>💠 ${GameNumbers.formatNumber(stones)}</small></div>`;
    html += `<div id="alchemy-buffs" class="alchemy-buffs">${this._buffsHtml(buffs)}</div>`;
    html += `<div class="hint">Brew pills with 💠 Spirit Stones (earned in Trials & the Secret Realm), then consume them for powerful buffs.</div>`;
    html += `<div class="pill-list">`;
    GameData.pills.forEach(p => {
      const owned = Game.pillCount(p.id);
      const canBrew = stones >= p.cost;
      html += `
        <div class="pill-row">
          <span class="pill-ico">${p.icon}</span>
          <span class="pill-info">
            <span class="pill-name">${p.name}${owned?` <span class="pill-have">×${owned}</span>`:''}</span>
            <span class="pill-desc">${p.desc}</span>
          </span>
          <span class="pill-actions">
            <button class="btn-mini pill-brew" data-pill="${p.id}" ${canBrew?'':'disabled'}>Brew 💠${GameNumbers.formatNumber(p.cost)}</button>
            <button class="btn-mini pill-use" data-pill="${p.id}" ${owned>0?'':'disabled'}>Use</button>
          </span>
        </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    el.querySelectorAll('.pill-brew[data-pill]').forEach(b => b.addEventListener('click', () => {
      if (Game.craftPill(b.dataset.pill)) {
        this.toast(`⚗️ Brewed ${Game.pillDef(b.dataset.pill).name}`);
        this.renderAlchemy(); this.renderResources();
      }
    }));
    el.querySelectorAll('.pill-use[data-pill]').forEach(b => b.addEventListener('click', () => {
      const res = Game.usePill(b.dataset.pill);
      if (res) {
        const p = res.pill;
        this.toast(p.type === 'buff' ? `${p.icon} ${this._buffLabel(p.buff)} buff active!` : `${p.icon} ${p.name} consumed!`);
        this.renderAlchemy(); this.renderResources(); this.renderRealm();
      }
    }));
  },

  _buffsHtml(buffs) {
    if (!buffs.length) return '<div class="no-buffs">No active elixirs. Brew and consume a pill below.</div>';
    const now = TimeService.now();
    return buffs.map(b => {
      const secs = Math.max(0, Math.ceil((b.endsAt - now) / 1000));
      return `<span class="buff-chip">${b.buff==='qi'?'🟢':'🔴'} ${b.mult}× ${this._buffLabel(b.buff)} · ${GameNumbers.formatDuration(secs)}</span>`;
    }).join('');
  },

  /** Light per-frame refresh of just the buff timers while on the Alchemy tab. */
  renderAlchemyBuffs() {
    const box = document.getElementById('alchemy-buffs');
    if (box) box.innerHTML = this._buffsHtml(Game.activeBuffs());
  },

  // -- Secret Realm (Round 4) ----------------------------------------------
  renderSecretRealm() {
    const el = document.getElementById('sub-realm');
    if (!el) return;
    if (!Game.combatUnlocked()) {
      el.innerHTML = `<div class="section-title">🌀 Secret Realm</div>
        <div class="locked-panel"><div class="locked-ico">🔒</div><div class="locked-title">Sealed</div>
        <div class="hint">Reach <b>Qi Condensation</b> to unlock the Secret Realm.</div></div>`;
      return;
    }
    const power = Game.secretRealmPower();
    const projected = Game.secretRealmMaxFloor(power);
    const high = Game.state.secretRealm.highestFloor || 0;
    const avail = Game.secretRealmAvailable();
    const buffs = Game.activeBuffs();
    const hasCombatBuff = buffs.some(b => b.buff === 'combat');

    el.innerHTML = `
      <div class="section-title">🌀 Secret Realm</div>
      <div class="realm-card card">
        <div class="realm-stats">
          <div class="realm-stat"><span class="rs-num">${GameNumbers.formatNumber(Math.floor(power))}</span><span class="rs-label">Combat Rating</span></div>
          <div class="realm-stat"><span class="rs-num">${projected}</span><span class="rs-label">Projected Floor</span></div>
          <div class="realm-stat"><span class="rs-num">${high}</span><span class="rs-label">Best Floor</span></div>
        </div>
        <div class="hint" style="text-align:center;margin:8px 0">A once-daily expedition. Your combat power (beasts, sect, meridians, Immortal Body, pills) decides how deep you delve. Deeper floors yield 💠 Stones, 🥚 Eggs and 🌟 Merit.</div>
        ${!hasCombatBuff ? `<div class="realm-tip">💡 Brew a <b>Berserk Pill</b> in Alchemy before entering for a deeper run.</div>` : `<div class="realm-tip active">🔴 Berserk buff active — combat doubled!</div>`}
        ${avail
          ? `<button class="btn-primary realm-enter" id="realm-enter">🌀 Enter Secret Realm</button>`
          : `<button class="btn-primary" id="realm-done" disabled style="opacity:.6">Explored today · returns tomorrow</button>`}
      </div>`;

    const enter = el.querySelector('#realm-enter');
    if (enter) enter.addEventListener('click', () => {
      const res = Game.enterSecretRealm();
      if (res) this.showRealmResult(res);
    });
  },

  showRealmResult(res) {
    const overlay = this._openModal();
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="modal" style="text-align:center">
        <div style="font-size:46px;margin:4px 0">🌀</div>
        <h2>${res.floors > 0 ? `Cleared ${res.floors} Floor${res.floors>1?'s':''}!` : 'Repelled at the Gate'}</h2>
        ${res.isRecord && res.floors>0 ? `<div class="record-badge">🏆 New Record! (+50% Stones)</div>` : ''}
        <div class="realm-rewards">
          ${res.stones ? `<div class="rr-line">💠 +${GameNumbers.formatNumber(res.stones)} Spirit Stones</div>` : ''}
          ${res.eggs   ? `<div class="rr-line">🥚 +${res.eggs} Beast Egg${res.eggs>1?'s':''}</div>` : ''}
          ${res.merit  ? `<div class="rr-line">🌟 +${res.merit} Heavenly Merit</div>` : ''}
          ${!res.stones && !res.eggs && !res.merit ? `<div class="hint">Build more combat power and try again tomorrow.</div>` : ''}
        </div>
        <button class="modal-close">Return</button>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => {
      overlay.remove(); this.renderSecretRealm(); this.renderResources();
    });
    document.body.appendChild(overlay);
  },

  renderRealm() {
    // -- Per-realm atmosphere ----------------------------------------------
    const app = document.getElementById('app');
    if (app && app.dataset.realm !== String(Game.state.realm)) {
      app.dataset.realm = Game.state.realm;
    }
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

    // -- Dao Path + Karma line --------------------------------------------
    this.renderPathLine();

    const next = Game.nextRealm();
    const realmComplete = Game.realmComplete();
    const canAdvance = Game.canAdvanceStage();
    const canBreak = Game.canBreakThrough();

    // -- Progress bar: Qi held toward the next stage's cost -----------------
    if (!realmComplete) {
      const req = Game.nextStageReq();
      this.el.progressFill.style.width = (Math.min(1, Game.state.qi / req) * 100).toFixed(1) + '%';
      this.el.progressLabel.textContent =
        GameNumbers.formatNumber(Game.state.qi) + ' / ' + GameNumbers.formatNumber(req) + ' Qi held';
    } else {
      this.el.progressFill.style.width = '100%';
      this.el.progressLabel.textContent = next ? 'Cultivation perfected — Tribulation awaits' : 'Peak of cultivation';
    }

    // -- Minor breakthrough button: only visible when requirement is met ------
    this.el.advanceBtn.style.display = (!realmComplete && canAdvance) ? 'block' : 'none';
    this.el.advanceBtn.disabled = !canAdvance;
    this.el.advanceBtn.classList.toggle('ready', canAdvance);
    if (!realmComplete) {
      const realm = Game.currentRealm();
      const nextStage = realm.stages[Game.state.stage];
      const cost = GameNumbers.formatNumber(Game.nextStageReq());
      this.el.advanceBtn.textContent = canAdvance
        ? `⬆ Cultivate → ${nextStage} (spend ${cost} Qi)`
        : `Gather ${cost} Qi → ${nextStage}`;
    }

    // -- Major Tribulation: pill + success chance ----------------------------
    if (!next) {
      this.el.breakBtn.style.display = 'none';
      if (this.el.pillBtn) this.el.pillBtn.style.display = 'none';
      this.el.breakInfo.innerHTML = realmComplete
        ? '☯ You have reached the peak of immortal cultivation.'
        : '';
    } else {
      const needPill = Game.pillRequired();
      const hasPill = Game.hasPill();
      const chance = (Game.tribulationChance() * 100).toFixed(0);
      const gain = Game.pendingDaoGain();

      // Pill purchase button lives next to the tribulation button.
      this.ensurePillButton();
      const showPillBtn = realmComplete && needPill && !hasPill;
      this.el.pillBtn.style.display = showPillBtn ? '' : 'none';
      if (showPillBtn) {
        const price = Game.pillPrice();
        this.el.pillBtn.disabled = !(Game.state.life && Game.state.life.money >= price);
        this.el.pillBtn.textContent = `Buy Breakthrough Pill — ¥${GameNumbers.formatNumber(price)}`;
      }

      this.el.breakBtn.style.display = (realmComplete && canBreak) ? 'block' : 'none';
      this.el.breakBtn.disabled = !canBreak;
      this.el.breakBtn.classList.toggle('ready', canBreak);
      this.el.breakBtn.textContent = needPill
        ? `⚡ Heavenly Tribulation (${chance}% — uses 1 pill)`
        : `⚡ Heavenly Tribulation`;
      this.el.breakInfo.innerHTML = realmComplete
        ? (needPill && !hasPill
            ? `A <b>Breakthrough Pill</b> is needed to withstand the Tribulation to <b>${next.name}</b>. Earn ¥ through your career.`
            : `⚡ Face the Heavenly Tribulation to ascend to <b>${next.name}</b> for <b>+${GameNumbers.formatNumber(gain)}</b> Dao. Success: <b>${chance}%</b>.`)
        : '';
    }
  },

  /** Lazily insert the pill-purchase button above the tribulation button. */
  ensurePillButton() {
    if (this.el.pillBtn) return;
    const btn = document.createElement('button');
    btn.id = 'pill-btn';
    btn.addEventListener('click', () => {
      if (Game.buyPill()) {
        Game.persist();
        this.renderAll();
        this.toast('💊 Breakthrough Pill acquired. The Tribulation awaits.');
      }
    });
    this.el.breakBtn.parentNode.insertBefore(btn, this.el.breakBtn);
    this.el.pillBtn = btn;
  },

  /** Dao Path chooser banner + karma indicator, at the top of the realm card. */
  renderPathLine() {
    if (!this.el.pathLine) {
      const div = document.createElement('div');
      div.id = 'path-line';
      const card = document.getElementById('realm-progress') || this.el.breakInfo.parentNode;
      card.insertBefore(div, card.firstChild);
      this.el.pathLine = div;
    }
    const el = this.el.pathLine;
    const path = Game.currentPath();
    const tier = Game.karmaTier();
    const karmaLabel = tier === 'righteous' ? '☯ Righteous' : tier === 'demonic' ? '🩸 Demonic' : '⚖ Neutral';
    const karmaColor = tier === 'righteous' ? 'var(--jade-d)' : tier === 'demonic' ? '#c8503f' : 'var(--muted)';
    const perk = (Game.karmaMods && Game.karmaMods().desc) ? Game.karmaMods().desc : '';
    let html = `<span class="karma-chip" style="color:${karmaColor}" title="${perk}">${karmaLabel} (${Game.state.karma|0})${tier!=='neutral' ? ' · '+perk : ''}</span>`;
    if (path) {
      html = `<span class="path-chip" style="border-color:${path.color};color:${path.color}">${path.icon} ${path.name}</span>` + html;
      el.innerHTML = html;
      el.onclick = null;
    } else if (Game.canChoosePath()) {
      el.innerHTML = `<button class="path-choose-btn">✦ Choose your Dao Path</button>` + html;
      el.querySelector('.path-choose-btn').onclick = () => this.showPathChooser();
    } else {
      // Path not yet available — just show the karma chip, hide the locked placeholder.
      el.innerHTML = html;
    }
  },

  showPathChooser() {
    const overlay = this._openModal();
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="modal">
        <h2>Choose Your Dao Path</h2>
        <p class="hint">A pivotal, <b>permanent</b> choice for this life — it shapes your strengths and weaknesses. A future heir may choose differently.</p>
        <div class="path-list">
          ${GameData.daoPaths.map(p => `
            <button class="path-card" data-id="${p.id}" style="border-color:${p.color}">
              <div class="path-card-head"><span class="path-ico">${p.icon}</span>
                <span class="path-name" style="color:${p.color}">${p.name}</span></div>
              <div class="path-blurb">${p.blurb}</div>
              <div class="path-perks">✦ ${p.perks}</div>
              <div class="path-drawback">▼ ${p.drawback}</div>
            </button>`).join('')}
        </div>
        <button class="btn-ghost" id="path-cancel">Decide later</button>
      </div>`;
    overlay.querySelectorAll('.path-card').forEach(b => b.addEventListener('click', () => {
      const p = GameData.daoPaths.find(x => x.id === b.dataset.id);
      if (Game.choosePath(b.dataset.id)) {
        overlay.remove();
        this.renderAll();
        this.toast(`${p.icon} You walk the ${p.name}. Your destiny is set.`);
      }
    }));
    overlay.querySelector('#path-cancel').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  /** A karma life event: dilemma with consequential choices. */
  showLifeEvent(ev, done) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const money = (Game.state.life && Game.state.life.money) || 0;
    overlay.innerHTML = `
      <div class="modal">
        <h2>${ev.title}</h2>
        <p>${ev.text}</p>
        <div class="event-options">
          ${ev.options.map((o, i) => {
            const afford = !o.cost || !o.cost.money || money >= o.cost.money;
            const k = o.karma > 0 ? `<span class="ev-karma good">+${o.karma} karma</span>`
                    : o.karma < 0 ? `<span class="ev-karma bad">${o.karma} karma</span>` : '';
            return `<button class="event-opt" data-i="${i}" ${afford ? '' : 'disabled'}>
              <span>${o.label}</span>${k}</button>`;
          }).join('')}
        </div>
      </div>`;
    overlay.querySelectorAll('.event-opt').forEach(b => b.addEventListener('click', () => {
      const res = Events.resolve(ev, parseInt(b.dataset.i, 10));
      if (res && res.ok) {
        overlay.remove();
        if (typeof done === 'function') done();
        this.renderAll();
        if (res.opt.toast) this.toast(res.opt.toast);
      }
    }));
    document.body.appendChild(overlay);
  },

  /** Lifespan reached: choose an heir and continue the bloodline. */
  showDeathModal() {
    if (this._deathShown) return;
    const overlay = this._openModal(); // null retries next tick once the other modal closes
    if (!overlay) return;
    this._deathShown = true;
    const children = (Game.state.family && Game.state.family.children) || [];
    const eligible = window.Family ? Family.isHeirEligible.bind(Family) : () => true;

    const heirCards = children.length
      ? children.map((c, i) => {
          const ok = eligible(c);
          const stage = window.Family ? Family.stageOf(c.age).name : '';
          return `
          <button class="heir-card${ok ? '' : ' ineligible'}" data-i="${i}" ${ok ? '' : 'disabled'} title="${ok ? '' : `Too young to inherit — reaches heir age at ${GameData.heirMinStage}`}">
            <span class="li-icon" style="color:${c.root.color}">${c.gender === 'female' ? '👧' : '👦'}</span>
            <span class="li-main"><span class="li-name">${c.name}${ok ? '' : ` <span class="badge stage-badge">${stage}</span>`}</span>
              <span class="li-sub" style="color:${c.root.color}">${c.root.name}</span></span>
          </button>`;
        }).join('')
      : `<p class="hint">You leave no children. A distant descendant will inherit a
         scattered fraction of your dao (+${(Game.pendingLegacyGain(null) * 100).toFixed(0)}% legacy).</p>`;
    const anyEligible = children.some(eligible);

    const legacyWithHeir = anyEligible ? (Game.pendingLegacyGain(children[0]) * 100).toFixed(0) : null;
    overlay.innerHTML = `
      <div class="modal">
        <h2>⏳ Your Lifespan Ends</h2>
        <p>At age <b>${Game.state.life.age}</b>, ${Game.state.name}'s dao reaches its mortal limit.
           Dao Comprehension and your family legacy pass on to the next generation${legacyWithHeir !== null ? ` (<b>+${legacyWithHeir}%</b> permanent legacy)` : ''}.</p>
        ${anyEligible ? '<p class="hint">Choose your heir:</p>'
          : children.length ? `<p class="hint">Your children are too young to inherit (heir-eligible at ${GameData.childStages.find(s=>s.key===GameData.heirMinStage).name}). A distant descendant carries the bloodline forward instead.</p>` : ''}
        <div class="heir-list">${heirCards}</div>
        <button class="modal-close" id="descendant-btn">${anyEligible ? 'Skip — Continue as a Distant Descendant' : 'Continue the Bloodline'}</button>
      </div>`;

    const finish = (heir) => {
      const r = Game.passToHeir(heir);
      overlay.remove();
      this._deathShown = false;
      this.applyGenderEmblem();
      this.renderAll();
      this.toast(`🕯 Generation ${r.generation} begins. Bloodline legacy: +${(r.legacy * 100).toFixed(0)}% — honor your ancestors.`);
    };
    overlay.querySelectorAll('.heir-card').forEach(b =>
      b.addEventListener('click', () => finish(children[parseInt(b.dataset.i, 10)])));
    const d = overlay.querySelector('#descendant-btn');
    if (d) d.addEventListener('click', () => finish(null));
    document.body.appendChild(overlay);
  },

  /** Rare narrative event that deepens spouse Bond (Round 15). */
  showSpousalEvent(ev) {
    const overlay = this._openModal();
    if (!overlay) return;
    const sp = Game.state.family.spouse;
    const money = (Game.state.life && Game.state.life.money) || 0;
    overlay.innerHTML = `
      <div class="modal">
        <h2>💞 ${ev.title}</h2>
        <p>${ev.text.replace('{spouse}', sp.name)}</p>
        <div class="event-options">
          ${ev.options.map((o, i) => {
            const afford = !o.cost || !o.cost.money || money >= o.cost.money;
            return `<button class="event-opt" data-i="${i}" ${afford ? '' : 'disabled'}>
              <span>${o.label}</span><span class="ev-karma good">+${o.bond} bond</span></button>`;
          }).join('')}
        </div>
      </div>`;
    overlay.querySelectorAll('.event-opt').forEach(b => b.addEventListener('click', () => {
      const res = Family.resolveSpousalEvent(ev, parseInt(b.dataset.i, 10));
      if (res && res.ok) {
        overlay.remove();
        this.renderAll();
        if (res.toast) this.toast(`💞 ${res.toast}`);
      }
    }));
    document.body.appendChild(overlay);
  },

  /** Rare event that can end a marriage (Round 15). */
  showWidowEvent(widow) {
    const overlay = this._openModal();
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="modal">
        <h2>🕊 ${widow.title}</h2>
        <p>${widow.text}</p>
        <button class="modal-close" id="widow-continue">Continue</button>
      </div>`;
    overlay.querySelector('#widow-continue').addEventListener('click', () => {
      Family.endMarriage();
      overlay.remove();
      this.renderAll();
      this.toast(`🕊 ${widow.spouseName} is no longer by your side.`);
    });
    document.body.appendChild(overlay);
  },

  /** Branching scene at a courtship affinity milestone (Round 15). */
  showCourtshipScene(pending) {
    const overlay = this._openModal();
    if (!overlay) return;
    const { scene, candId, candName } = pending;
    const money = (Game.state.life && Game.state.life.money) || 0;
    overlay.innerHTML = `
      <div class="modal">
        <h2>💘 ${scene.title}</h2>
        <p>${scene.text.replace(/\{name\}/g, candName)}</p>
        <div class="event-options">
          ${scene.options.map((o, i) => {
            const afford = !o.cost || !o.cost.money || money >= o.cost.money;
            const a = o.affinity > 0 ? `+${o.affinity} affinity` : `${o.affinity} affinity`;
            const cls = o.affinity >= 0 ? 'good' : 'bad';
            return `<button class="event-opt" data-i="${i}" ${afford ? '' : 'disabled'}>
              <span>${o.label}</span><span class="ev-karma ${cls}">${a}</span></button>`;
          }).join('')}
        </div>
      </div>`;
    overlay.querySelectorAll('.event-opt').forEach(b => b.addEventListener('click', () => {
      const res = Family.resolveCourtshipScene(scene, candId, parseInt(b.dataset.i, 10));
      if (res && res.ok) {
        overlay.remove();
        this.renderActiveTab();
        if (res.toast) this.toast(`💘 ${res.toast}`);
      }
    }));
    document.body.appendChild(overlay);
  },

  // ======================================================================
  // ANCESTOR HALL — lineage history + house reputation (Round 15)
  // ======================================================================
  renderLineage() {
    const el = this.el.lineagePanel;
    if (!el) return;
    const rep = Game.state.houseReputation || 0;
    const repBonus = Math.min(25, Math.floor(rep * 0.1));
    const lineage = Game.state.lineage || [];

    let html = `<div class="section-title">🏛 Ancestor Hall</div>
      <div class="card house-rep-card">
        <div class="row-between"><span>Generation <b>${Game.state.generation || 1}</b></span><span>House Reputation <b>${rep}</b></span></div>
        <div class="hint">Every generation you carry forward — through an heir or a distant descendant — adds to your house's standing. Current bonus: <b>+${repBonus}%</b> production (caps at +25%).</div>
      </div>`;

    if (!lineage.length) {
      html += `<div class="hint">No ancestors recorded yet. Your story is the first page — outlive your lifespan (or reincarnate) to begin the Hall.</div>`;
    } else {
      html += `<div class="section-title small">Past Generations</div><div id="lineage-list"></div>`;
    }
    el.innerHTML = html;

    if (lineage.length) {
      const list = el.querySelector('#lineage-list');
      [...lineage].reverse().forEach(g => {
        const d = document.createElement('div');
        d.className = 'list-item lineage-item';
        d.innerHTML = `<span class="li-icon">🕯</span>
          <span class="li-main">
            <span class="li-name">Gen ${g.generation}: ${g.name}</span>
            <span class="li-sub">${g.root} · reached ${g.realmReached}${g.endedAtAge != null ? ` at age ${g.endedAtAge}` : ''}</span>
            <span class="li-sub">${g.spouseName ? `Married ${g.spouseName} · ` : ''}${g.childCount} child${g.childCount === 1 ? '' : 'ren'}${g.heirName ? ` · succeeded by ${g.heirName}` : ' · line continued by a distant descendant'}</span>
          </span>`;
        list.appendChild(d);
      });
    }
  },

  multAll() {
    const m = Game.multipliers();
    return m.allMult * m.root * m.stage * m.dao * m.sect * m.pet * m.talent * m.family * m.legacy;
  },


  // -- Minor breakthrough ---------------------------------------------------
  doAdvanceStage() {
    // If stage aid is active, temporarily lower the requirement by 30%.
    let aidApplied = false;
    if (this._stageAidActive) {
      const req = Game.nextStageReq();
      if (req !== null) {
        const reduced = req * 0.7;
        if (Game.state.runQi >= reduced && Game.state.runQi < req) {
          // Temporarily satisfy the requirement by topping up runQi.
          Game.state.runQi = req;
          aidApplied = true;
        }
      }
    }
    const result = Game.advanceStage();
    if (result) {
      if (aidApplied || this._stageAidActive) {
        this._stageAidActive = false; // consume the aid
      }
      Game.persist();
      this.renderAll();
      const tier = Game.tierLabel();
      this.toast(`Cultivation deepened · Advanced to ${tier.realm} · ${tier.stage} (+${(GameData.stageBonusPerStage*100).toFixed(0)}% power)`);
      if (result.milestone) this.showMilestonePopup(result.milestone);
    }
  },

  // =========================================================================
  // WORLD HUB — Trials (combat) / Beasts (pets) / Sect
  // =========================================================================
  renderWorld() {
    if (this.worldSub === 'trials')      this.renderTrials();
    else if (this.worldSub === 'beasts') this.renderBeasts();
    else if (this.worldSub === 'skills') this.renderTechniques();
    else if (this.worldSub === 'sect')   this.renderSect();
    else if (this.worldSub === 'gear')   this.renderArtifacts();
    else if (this.worldSub === 'market') this.renderMarket();
    else if (this.worldSub === 'realm')  this.renderSecretRealm();
    else if (this.worldSub === 'boosters') this.renderBoosters();
    else if (this.worldSub === 'feats')    this.renderAchievements();
    else if (this.worldSub === 'dailies')  this.renderDailies();
    else if (this.worldSub === 'fracture') this.renderFracture();
  },

  // ======================================================================
  // MARKET — drifting-price ¥ economy
  // ======================================================================
  renderMarket() {
    const el = document.getElementById('sub-market');
    if (!el || !window.Market) return;
    Market.drift(false); // refresh if the cadence elapsed
    const amt = this.marketBuyAmt || 1;
    const money = (Game.state.life && Game.state.life.money) || 0;
    const arrow = t => t > 0 ? '<span class="mk-up">▲</span>' : t < 0 ? '<span class="mk-dn">▼</span>' : '<span class="mk-flat">▬</span>';
    const qtyFor = id => amt === 'max' ? Math.max(1, Market.maxAffordable(id)) : amt;

    let html = `<div class="section-title">🏪 Spirit Market <small>¥${GameNumbers.formatNumber(money)}</small></div>
      <div class="hint">Prices drift every minute — buy low. A scaling sink for your career earnings.</div>
      <div class="buy-amt-row">
        ${[1,10,100,'max'].map(n => `<button class="buy-amt-btn${(this.marketBuyAmt||1)===n?' on':''}" data-amt="${n}">${n==='max'?'Max':'×'+n}</button>`).join('')}
      </div>
      <div class="mk-list">`;
    GameData.market.goods.forEach(g => {
      const unit = Market.price(g.id);
      const qty = qtyFor(g.id);
      const cost = unit * qty;
      const afford = money >= cost && qty > 0;
      html += `<div class="mk-item">
        <span class="mk-ico">${g.icon}</span>
        <span class="mk-main"><span class="mk-name">${g.name} ${arrow(Market.trend(g.id))}</span>
          <span class="muted">¥${GameNumbers.formatNumber(unit)}/ea · ${g.desc}</span></span>
        <button class="btn-mini buy" data-buy="${g.id}" ${afford?'':'disabled'}>Buy ${qty>1?'×'+qty+' ':''}¥${GameNumbers.formatNumber(cost)}</button>
      </div>`;
    });
    html += `</div><div class="section-title small">Sell Surplus</div><div class="mk-list">`;
    GameData.market.sellable.forEach(d => {
      const have = Game.state[d.from] || 0;
      const sp = Market.sellPrice(d.id);
      const qty = amt === 'max' ? have : Math.min(amt, have);
      html += `<div class="mk-item">
        <span class="mk-ico">${d.icon}</span>
        <span class="mk-main"><span class="mk-name">${d.name}</span><span class="muted">Have ${GameNumbers.formatNumber(have)} · sells ¥${GameNumbers.formatNumber(sp)}/ea</span></span>
        <button class="btn-mini sell" data-sell="${d.id}" ${qty>0?'':'disabled'}>Sell ${qty>1?'×'+qty+' ':''}¥${GameNumbers.formatNumber(sp*qty)}</button>
      </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    el.querySelectorAll('.buy-amt-btn').forEach(b => b.addEventListener('click', () => {
      this.marketBuyAmt = b.dataset.amt === 'max' ? 'max' : parseInt(b.dataset.amt, 10);
      this.renderMarket();
    }));
    el.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      if (Market.buy(b.dataset.buy, qtyFor(b.dataset.buy))) { this.renderMarket(); this.renderResources(); this.toast('🏪 Purchase complete.'); }
    }));
    el.querySelectorAll('[data-sell]').forEach(b => b.addEventListener('click', () => {
      const have = Game.state[GameData.market.sellable.find(x=>x.id===b.dataset.sell).from] || 0;
      const q = (this.marketBuyAmt||1)==='max' ? have : Math.min(this.marketBuyAmt||1, have);
      if (Market.sell(b.dataset.sell, q)) { this.renderMarket(); this.renderResources(); }
    }));
  },

  // ======================================================================
  // GEAR — artifact loadout + inventory
  // ======================================================================
  renderArtifacts() {
    const el = document.getElementById('sub-gear');
    if (!el || !window.Artifacts) return;
    const A = GameData.artifacts;
    const rar = id => A.rarities.find(r => r.id === id) || A.rarities[0];
    const setName = id => (A.sets.find(s => s.id === id) || {}).name || id;
    const statLine = a => {
      const p = [];
      if (a.atk) p.push(`⚔${GameNumbers.formatNumber(a.atk)}`);
      if (a.hp)  p.push(`♥${GameNumbers.formatNumber(a.hp)}`);
      if (a.qi)  p.push(`☯+${(a.qi*100).toFixed(1)}%`);
      return p.join(' · ');
    };

    // Equipped loadout (4 slots) + active set bonuses.
    const eq = Artifacts.equipped();
    const runeHtml = (a) => {
      if (!window.Enchanting || !a.runes || !a.runes.length) return '';
      const chips = a.runes.map(r => {
        const rt = Enchanting.types.find(t => t.id === r.id);
        return rt ? `<span class="rune-chip">${rt.icon} ${rt.name} +${(r.value*100).toFixed(1)}%</span>` : '';
      }).join('');
      const isHL = Enchanting.isHeirloom(a.id);
      const badge = isHL ? `<span class="heirloom-badge">⚜ Heirloom ×${Enchanting.heirloomStacks()}</span>` : '';
      return `<div class="rune-chips">${chips}${badge}</div>`;
    };
    const enchantBtn = (a) => {
      if (!window.Enchanting) return '';
      const cost = Enchanting.enchantCost(a);
      const canEnchant = Game.state.blood && Game.state.blood.essence >= cost;
      return `<button class="btn-mini" data-enchant="${a.id}" ${canEnchant?'':'disabled'}>✨ Enchant 🩸${GameNumbers.formatNumber(cost)}</button>`;
    };
    const heirloomBtn = (a) => {
      if (!window.Enchanting) return '';
      const isHL = Enchanting.isHeirloom(a.id);
      return isHL
        ? `<button class="btn-mini ghost" data-clear-heirloom>⚜ Clear</button>`
        : `<button class="btn-mini ghost" data-set-heirloom="${a.id}">⚜ Set Heirloom</button>`;
    };
    const slotsHtml = A.slots.map(s => {
      const a = eq[s.id];
      if (!a) return `<div class="gear-slot empty"><span class="gear-slot-ico">${s.icon}</span>
        <span class="gear-slot-main"><b>${s.name}</b><span class="muted">— empty —</span></span></div>`;
      const r = rar(a.rarity);
      return `<div class="gear-slot" style="border-color:${r.color}">
        <span class="gear-slot-ico">${s.icon}</span>
        <span class="gear-slot-main"><b style="color:${r.color}">${r.name} ${s.name}</b>
          <span class="muted">${statLine(a)} · ${setName(a.set)} set</span>
          ${runeHtml(a)}</span>
        <span class="gear-item-btns">${enchantBtn(a)} ${heirloomBtn(a)} <button class="btn-mini" data-unequip="${s.id}">Remove</button></span></div>`;
    }).join('');

    const counts = Artifacts.setCounts();
    const setHtml = Object.keys(counts).filter(id => counts[id] >= 2)
      .map(id => `<span class="trait-chip">${setName(id)} ×${counts[id]} active</span>`).join('') || '<span class="muted">No set bonus active (equip 2+ of a set)</span>';

    const inv = Artifacts.s().inventory.slice().sort((a, b) => Artifacts.score(b) - Artifacts.score(a));
    const invHtml = inv.length ? inv.map(a => {
      const r = rar(a.rarity);
      return `<div class="gear-item" style="border-left-color:${r.color}">
        <span class="gear-item-main"><b style="color:${r.color}">${r.name} ${A.slots.find(s=>s.id===a.slot).name}</b>
          <span class="muted">${statLine(a)} · ${setName(a.set)}</span></span>
        <span class="gear-item-btns">
          <button class="btn-mini" data-equip="${a.id}">Equip</button>
          <button class="btn-mini ghost" data-salvage="${a.id}">♻${GameNumbers.formatNumber(Artifacts.salvageValue(a))}</button>
        </span></div>`;
    }).join('') : '<div class="hint">No artifacts yet. Win Trials & Secret Realm fights — bosses almost always drop gear.</div>';

    el.innerHTML = `
      <div class="section-title">⚜️ Artifacts <small>ATK +${GameNumbers.formatNumber(Artifacts.atk())} · HP +${GameNumbers.formatNumber(Artifacts.hp())} · Qi +${(Artifacts.qiPct()*100).toFixed(1)}%</small></div>
      <div class="gear-loadout">${slotsHtml}</div>
      <div class="gear-sets">${setHtml}</div>
      <div class="section-title small">Satchel (${inv.length}/${A.invCap})</div>
      <div class="gear-inv">${invHtml}</div>`;

    el.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => { Artifacts.equip(b.dataset.equip); this.renderArtifacts(); this.renderResources(); }));
    el.querySelectorAll('[data-unequip]').forEach(b => b.addEventListener('click', () => { Artifacts.unequip(b.dataset.unequip); this.renderArtifacts(); this.renderResources(); }));
    el.querySelectorAll('[data-salvage]').forEach(b => b.addEventListener('click', () => { Artifacts.salvage(b.dataset.salvage); this.renderArtifacts(); this.renderResources(); }));
    if (window.Enchanting) {
      el.querySelectorAll('[data-enchant]').forEach(b => b.addEventListener('click', () => {
        const res = Enchanting.enchant(b.dataset.enchant);
        if (res) {
          const desc = res.rune.desc.replace('{v}', (res.value * 100).toFixed(1));
          this.toast(`✨ Rune: ${res.rune.name} — ${desc}`);
        }
        this.renderArtifacts(); this.renderResources();
      }));
      el.querySelectorAll('[data-set-heirloom]').forEach(b => b.addEventListener('click', () => {
        Enchanting.setHeirloom(b.dataset.setHeirloom);
        this.renderArtifacts();
      }));
      el.querySelectorAll('[data-clear-heirloom]').forEach(b => b.addEventListener('click', () => {
        Enchanting.clearHeirloom();
        this.renderArtifacts();
      }));
    }
  },

  /** Emoji fallback for beast/mob sprite ids. */
  _beastEmoji(id) {
    return ({ crane:'🕊️', fox:'🦊', tortoise:'🐢', tiger:'🐯', serpent:'🐍',
      qilin:'🦄', phoenix:'🦅', dragon:'🐲' })[id] || '🐾';
  },
  _mobEmoji(icon) {
    return ({ 'ic-mob-wolf':'🐺', 'ic-mob-ghoul':'🧟', 'ic-mob-scorpion':'🦂',
      'ic-mob-demon':'👹' })[icon] || '👾';
  },

  // -- TRIALS (combat) ------------------------------------------------------
  renderTrials() {
    const el = document.getElementById('sub-trials');
    if (!el) return;
    const scroller = document.getElementById('content');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    if (!Game.combatUnlocked()) {
      el.innerHTML = `<div class="section-title">⚔️ Trials</div>
        <div class="locked-panel">
          <div class="locked-ico">🔒</div>
          <div class="locked-title">Trials Locked</div>
          <div class="hint">Reach <b>Qi Condensation</b> (your first major breakthrough) to send your cultivator into the demon-infested wilds.</div>
        </div>`;
      if (scroller) scroller.scrollTop = scrollTop;
      return;
    }
    const c = Game.state.combat;
    const challenge = window.Challenges ? Challenges.active() : null;
    const challengeClaimed = window.Challenges ? Challenges.hasClaimed() : true;
    const challengeBanner = challenge ? `
      <div class="challenge-banner">
        <span class="challenge-icon">${challenge.icon}</span>
        <strong class="challenge-title">${challenge.name}</strong> — ${challenge.desc}
        <button class="btn-mini challenge-claim-btn" id="challenge-claim-btn" ${challengeClaimed ? 'disabled' : ''}>
          ${challengeClaimed ? '✓ Claimed' : 'Claim 🎁'}
        </button>
      </div>` : '';
    el.innerHTML = `
      <div class="section-title">⚔️ Trials <small>Zone ${c.zone} · Wave ${c.wave}${Combat.isBossWave(c.wave)?' · BOSS':''}</small></div>
      ${challengeBanner}
      <div class="combat-stage" id="combat-stage"></div>
      <div class="combat-controls">
        <button class="btn-mini" id="cb-retreat">◀ Retreat</button>
        <button class="btn-mini" id="cb-pause">${c.paused?'▶ Resume':'⏸ Pause'}</button>
        <button class="btn-mini" id="cb-push" ${((c.highestZone||1)>c.zone)?'':'disabled'}>Advance ▶</button>
      </div>
      <div class="combat-resources">
        <span class="cr-pill">💠 <b id="cb-stones">${GameNumbers.formatNumber(Game.state.spiritStones)}</b> Stones</span>
        <span class="cr-pill">🥚 <b id="cb-eggs">${Game.state.beastEggs}</b> Eggs</span>
      </div>
      <div class="section-title small">Battle Log</div>
      <div class="combat-log" id="combat-log"></div>`;
    this.renderTrialsLive();

    const bind = (id, fn) => { const b = el.querySelector(id); if (b) b.addEventListener('click', fn); };
    bind('#cb-retreat', () => { Combat.retreatZone(); this.renderTrials(); });
    bind('#cb-push',    () => { Combat.pushZone();    this.renderTrials(); });
    bind('#cb-pause',   () => { Game.state.combat.paused = !Game.state.combat.paused; this.renderTrials(); });
    bind('#challenge-claim-btn', () => { if (window.Challenges) { Challenges.claim(); this.renderTrials(); this.renderResources(); } });
    if (scroller) scroller.scrollTop = scrollTop;
  },

  /** Lightweight per-frame update of the combat stage (HP bars, log). */
  renderTrialsLive() {
    const stage = document.getElementById('combat-stage');
    if (!stage) return;
    const c = Game.state.combat;
    Combat.ensurePlayerHp();
    const mob = Combat.mob();
    const pHpMax = Combat.playerHpMax(), pHp = Math.max(0, c.playerHp);
    const mHpPct = Math.max(0, (mob.hp / mob.maxHp) * 100);
    const pHpPct = Math.max(0, (pHp / pHpMax) * 100);
    stage.innerHTML = `
      <div class="fighter player">
        <div class="fighter-ico">🧘</div>
        <div class="fighter-name">${Game.state.name}</div>
        <div class="hp-bar"><div class="hp-fill player" style="width:${pHpPct}%"></div></div>
        <div class="fighter-stat">HP ${GameNumbers.formatNumber(pHp)} · ATK ${GameNumbers.formatNumber(Combat.playerAtk())}</div>
      </div>
      <div class="vs">⚔</div>
      <div class="fighter enemy ${mob.boss?'boss':''}">
        <div class="fighter-ico">${this._mobEmoji(mob.icon)}</div>
        <div class="fighter-name">${mob.name}${mob.boss?' 👑':''}</div>
        <div class="hp-bar"><div class="hp-fill enemy" style="width:${mHpPct}%"></div></div>
        <div class="fighter-stat">HP ${GameNumbers.formatNumber(Math.max(0,mob.hp))} · ATK ${GameNumbers.formatNumber(mob.atk)}</div>
      </div>`;
    const stones = document.getElementById('cb-stones');
    if (stones) stones.textContent = GameNumbers.formatNumber(Game.state.spiritStones);
    const eggs = document.getElementById('cb-eggs');
    if (eggs) eggs.textContent = Game.state.beastEggs;
    const log = document.getElementById('combat-log');
    if (log) log.innerHTML = Combat.log.map(l => `<div class="log-line">${l}</div>`).join('') || '<div class="hint">The battle begins…</div>';
  },

  // -- BOOSTERS (Round 9: stacking timed buffs) ------------------------------
  renderBoosters() {
    const el = document.getElementById('sub-boosters');
    if (!el || !window.Boosters) return;
    const scroller = document.getElementById('content');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    const cards = Boosters.data.map(b => {
      const active = Boosters.isActive(b.id);
      const adsLeft = Boosters.adsLeftToday(b.id);
      const cost = Boosters.stoneCost(b.id);
      const canAfford = Game.state.spiritStones >= cost;
      return `
        <div class="booster-card ${active ? 'active' : ''}">
          <div class="booster-ico">${b.icon}</div>
          <div class="booster-info">
            <div class="booster-name">${b.name}</div>
            <div class="hint">${b.desc}</div>
            <div class="booster-timer" id="booster-timer-${b.id}">${active ? `⏳ ${GameNumbers.formatDuration(Boosters.timeLeft(b.id))} left` : ''}</div>
          </div>
          <div class="booster-actions">
            <button class="btn-mini" data-boost-ad="${b.id}" ${adsLeft <= 0 ? 'disabled' : ''}>📺 Ad (${adsLeft}/${Boosters.ADS_PER_DAY})</button>
            <button class="btn-mini" data-boost-stone="${b.id}" ${canAfford ? '' : 'disabled'}>💠 ${GameNumbers.formatNumber(cost)}</button>
          </div>
        </div>`;
    }).join('');
    el.innerHTML = `
      <div class="section-title">⚡ Boosters <small>Stack timed buffs from ads or Spirit Stones</small></div>
      <div class="booster-list">${cards}</div>`;
    const bind = (sel, fn) => el.querySelectorAll(sel).forEach(b => b.addEventListener('click', fn));
    bind('[data-boost-ad]', async e => {
      const id = e.currentTarget.dataset.boostAd;
      e.currentTarget.disabled = true;
      const watched = await Monetization.showRewardedAd('booster_' + id);
      if (watched && Boosters.activateViaAd(id)) {
        this.toast(`${Boosters.get(id).icon} ${Boosters.get(id).name} active!`);
      }
      this.renderBoosters();
      this.renderResources();
    });
    bind('[data-boost-stone]', e => {
      const id = e.currentTarget.dataset.boostStone;
      if (Boosters.activateWithStones(id)) {
        this.toast(`${Boosters.get(id).icon} ${Boosters.get(id).name} active!`);
        this.renderBoosters();
        this.renderResources();
      }
    });
    if (scroller) scroller.scrollTop = scrollTop;
  },

  /** Lightweight per-frame update of active booster countdowns. */
  renderBoostersLive() {
    if (!window.Boosters) return;
    let needsFullRender = false;
    Boosters.data.forEach(b => {
      const timerEl = document.getElementById('booster-timer-' + b.id);
      if (!timerEl) return;
      const active = Boosters.isActive(b.id);
      const wasActive = timerEl.textContent.length > 0;
      if (active) timerEl.textContent = `⏳ ${GameNumbers.formatDuration(Boosters.timeLeft(b.id))} left`;
      else if (wasActive) needsFullRender = true; // just expired — refresh buttons/card state
    });
    if (needsFullRender) this.renderBoosters();
  },

  // -- BEASTS (pets) --------------------------------------------------------
  renderBeasts() {
    const el = document.getElementById('sub-beasts');
    if (!el) return;
    const scroller = document.getElementById('content');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    const active = Pets.active();
    const money = (Game.state.life && Game.state.life.money) || 0;
    let html = `
      <div class="section-title">🐉 Spirit Beasts <small>${active.length}/${Pets.MAX_ACTIVE} active</small></div>
      <div class="beast-tame card">
        <div class="row-between">
          <div><div class="card-title">🥚 Tame a Beast</div>
            <div class="hint">You have <b>${Game.state.beastEggs}</b> Beast Egg(s). Eggs drop from Trials.</div></div>
          <button class="btn-primary sm" id="tame-btn" ${Game.state.beastEggs>=1?'':'disabled'}>Tame</button>
        </div>
      </div>
      <div class="beast-tame card">
        <div class="card-title">💱 Spirit Market <small style="float:right;color:var(--muted)">¥${GameNumbers.formatNumber(money)}</small></div>
        <div class="hint">Convert your worldly wealth (¥, earned from Work) into 💠 Spirit Stones to empower your beasts.</div>
        <div class="exchange-row">
          <button class="btn-mini" data-market="100"  ${money>=500?'':'disabled'}>💠 100 — ¥500</button>
          <button class="btn-mini" data-market="2500" ${money>=10000?'':'disabled'}>💠 2,500 — ¥10K</button>
        </div>
      </div>
      <div class="hint">Owned beasts boost Qi production. Up to ${Pets.MAX_ACTIVE} active beasts also fight in Trials. Duplicates auto-level. Level up with 💠 Spirit Stones.</div>
      <div class="beast-grid">`;

    Pets.data.forEach(p => {
      const owned = Pets.isOwned(p.id);
      const lvl = Pets.levelOf(p.id);
      const rar = Pets.rarity[p.rarity];
      const isActive = Pets.isActive(p.id);
      const maxed = lvl >= Pets.MAX_LEVEL;
      const star = owned ? Pets.starOf(p.id) : 1;
      const maxStar = star >= Pets.MAX_STAR;
      const cost = owned && !maxed ? Pets.levelUpCost(p.id) : 0;
      const canLvl = owned && !maxed && Game.state.spiritStones >= cost;
      const canEvo = owned && Pets.canEvolve(p.id);
      const evoCost = owned && maxed && !maxStar ? Pets.evolveCost(p.id) : 0;
      const starDisplay = owned ? `<div class="beast-stars">${'★'.repeat(star)}${'☆'.repeat(Pets.MAX_STAR - star)}</div>` : '';
      html += `
        <div class="beast-card ${owned?'owned':'locked'} ${isActive?'active':''}" style="border-color:${owned?rar.color:'var(--line)'}">
          <div class="beast-rarity" style="color:${rar.color}">${rar.name}</div>
          <div class="beast-ico" style="${owned?'':'filter:grayscale(1);opacity:.4'}">${this._beastEmoji(p.id)}</div>
          <div class="beast-name">${owned ? p.name : '???'}</div>
          ${owned ? `
            ${starDisplay}
            <div class="beast-lvl">Lv ${lvl}/${Pets.MAX_LEVEL} · +${(Pets.qiBonusOf(p.id)*100).toFixed(1)}% Qi</div>
            <div class="beast-actions">
              <button class="btn-mini" data-act="toggle" data-id="${p.id}" ${(!isActive&&active.length>=Pets.MAX_ACTIVE)?'disabled':''}>${isActive?'★ Active':'Deploy'}</button>
              <button class="btn-mini" data-act="lvl" data-id="${p.id}" ${canLvl?'':'disabled'}>${maxed?'✓ Max':'💠 '+GameNumbers.formatNumber(cost)}</button>
            </div>
            ${maxed && !maxStar ? `<div class="beast-actions"><button class="btn-mini evolve-btn" data-act="evolve" data-id="${p.id}" ${canEvo?'':'disabled'}>🌟 Evolve — 🥚1 + 💠${GameNumbers.formatNumber(evoCost)}</button></div>` : ''}
            ${maxStar ? `<div class="hint" style="color:#e7c878">⭐ Max Star</div>` : ''}` : `<div class="beast-lvl muted">Undiscovered</div>`}
        </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    const tame = el.querySelector('#tame-btn');
    if (tame) tame.addEventListener('click', () => {
      const res = Pets.tame();
      if (res) {
        const r = Pets.rarity[res.pet.rarity];
        this.toast(`${this._beastEmoji(res.pet.id)} ${res.duplicate?'Another':'Tamed'} ${r.name} ${res.pet.name}!${res.duplicate?' (+1 Lv)':''}`);
        this.renderBeasts(); this.renderResources();
      }
    });
    el.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (b.dataset.act === 'toggle') Pets.toggleActive(id);
      else if (b.dataset.act === 'lvl') Pets.levelUp(id);
      else if (b.dataset.act === 'evolve') {
        if (Pets.evolve(id)) {
          const p = Pets.get(id);
          this.toast(`🌟 ${p.name} evolved to ★${Pets.starOf(id)}!`);
        }
      }
      this.renderBeasts(); this.renderResources();
    }));
    el.querySelectorAll('button[data-market]').forEach(b => b.addEventListener('click', () => {
      const stones = parseInt(b.dataset.market, 10);
      const cost = stones === 100 ? 500 : 10000;
      if (Game.state.life && Game.state.life.money >= cost) {
        Game.state.life.money -= cost;
        Game.state.spiritStones += stones;
        Game.persist();
        this.toast(`💠 +${GameNumbers.formatNumber(stones)} Spirit Stones`);
        this.renderBeasts(); this.renderResources();
      }
    }));
    if (scroller) scroller.scrollTop = scrollTop;
  },

  // -- TECHNIQUES (combat skill tree) ---------------------------------------
  renderTechniques() {
    const el = document.getElementById('sub-skills');
    if (!el) return;
    const scroller = document.getElementById('content');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    if (!Game.combatUnlocked()) {
      el.innerHTML = `<div class="section-title">📜 Combat Techniques</div>
        <div class="locked-panel">
          <div class="locked-ico">🔒</div>
          <div class="locked-title">Techniques Locked</div>
          <div class="hint">Reach <b>Qi Condensation</b> to unlock Trials, then learn techniques to power up your cultivator in battle.</div>
        </div>`;
      if (scroller) scroller.scrollTop = scrollTop;
      return;
    }
    const stones = Game.state.spiritStones;
    const activeCount = Techniques.active().length;
    let html = `
      <div class="section-title">📜 Combat Techniques <small>${activeCount}/${Techniques.MAX_ACTIVE} equipped</small></div>
      <div class="hint">Learn techniques with 💠 Spirit Stones, then equip up to ${Techniques.MAX_ACTIVE} at once — only equipped techniques affect Trials combat. Choose a build.</div>
      <div class="tech-grid">`;

    Techniques.data.forEach(t => {
      const rank = Techniques.rankOf(t.id);
      const learned = rank > 0;
      const maxed = rank >= Techniques.MAX_RANK;
      const isActive = Techniques.isActive(t.id);
      const cost = maxed ? 0 : Techniques.learnCost(t.id);
      const canLearn = !maxed && stones >= cost;
      const canEquip = learned && (isActive || activeCount < Techniques.MAX_ACTIVE);
      html += `
        <div class="tech-card ${learned ? 'owned' : 'locked'} ${isActive ? 'active' : ''}">
          <div class="tech-ico">${t.icon}</div>
          <div class="tech-name">${t.name}</div>
          <div class="tech-rank">${learned ? `Rank ${rank}/${Techniques.MAX_RANK} · ${Techniques.effectText(t.id, rank)}` : Techniques.effectText(t.id, 1) + ' (at Rank 1)'}</div>
          <div class="tech-actions">
            <button class="btn-mini" data-act="learn" data-id="${t.id}" ${canLearn ? '' : 'disabled'}>${maxed ? '✓ Max' : 'Learn 💠' + GameNumbers.formatNumber(cost)}</button>
            <button class="btn-mini" data-act="toggle" data-id="${t.id}" ${canEquip ? '' : 'disabled'}>${isActive ? '★ Equipped' : 'Equip'}</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    el.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (b.dataset.act === 'learn') Techniques.learn(id);
      else if (b.dataset.act === 'toggle') Techniques.toggleActive(id);
      this.renderTechniques(); this.renderResources();
    }));
    if (scroller) scroller.scrollTop = scrollTop;
  },

  // -- SECT -----------------------------------------------------------------
  renderSect() {
    const el = document.getElementById('sub-sect');
    if (!el) return;
    const scroller = document.getElementById('content');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    const current = Sect.current();

    if (!current) {
      // Not in a sect — show join list.
      const alignTag = a => a === 'orthodox' ? '<span class="align-chip good">Orthodox</span>'
                          : a === 'demonic'  ? '<span class="align-chip bad">Demonic</span>'
                          : '<span class="align-chip">Neutral</span>';
      let html = `<div class="section-title">🏯 Join a Sect</div>
        <div class="hint">Pledge to one of the great cultivation orders for a permanent bonus. Earn Contribution through Trials, Offerings, and Ranks. Research sect-exclusive upgrades to deepen your path.</div>
        <div class="sect-list">`;
      Sect.data.forEach(s => {
        const req = Sect.joinRequirement(s.id);
        html += `<div class="card sect-option${req.ok ? '' : ' locked'}" style="border-color:${s.color}">
          <div class="sect-head">
            <div class="sect-seal" style="background:${s.color}">${s.seal}</div>
            <div class="sect-info"><div class="card-title">${s.name} ${alignTag(s.align)}</div>
              <div class="hint">${s.desc}</div></div>
          </div>
          <div class="sect-bonus" style="color:${s.color}">✦ ${s.bonusDesc}</div>
          ${req.ok ? `<button class="btn-primary sm" data-join="${s.id}">Pledge</button>`
                   : `<div class="sect-locked">🔒 ${req.reason}</div>`}
        </div>`;
      });
      html += `</div>`;
      el.innerHTML = html;
      el.querySelectorAll('button[data-join]').forEach(b => b.addEventListener('click', () => {
        Sect.join(b.dataset.join).then(r => {
          if (r && r.ok) { this.toast(`🏯 You joined the ${Sect.current().name}!`); this.renderSect(); this.renderResources(); }
        });
      }));
      if (scroller) scroller.scrollTop = scrollTop;
      return;
    }

    // In a sect — render the full guild panel.
    const rank   = Sect.rank(), next = Sect.nextRank();
    const contrib = Sect.contribution();
    const pct    = next ? Math.min(100, ((contrib - rank.req) / (next.req - rank.req)) * 100) : 100;
    const tab    = this.sectTab || 'overview';

    // --- Header (always visible) ---
    let html = `
      <div class="sect-header" style="border-color:${current.color}">
        <div class="sect-seal lg" style="background:${current.color}">${current.seal}</div>
        <div class="sect-header-info">
          <div class="sect-header-name" style="color:${current.color}">${current.name}</div>
          <div class="sect-header-rank">${rank.name}</div>
          <div class="sect-rank-bar-wrap"><div class="sect-rank-bar" style="width:${pct}%;background:${current.color}"></div></div>
          <div class="sect-contrib-line muted">${GameNumbers.formatNumber(contrib)} Contribution${next ? ` · ${next.name} at ${GameNumbers.formatNumber(next.req)}` : ' · Max rank'}</div>
        </div>
      </div>
      <div class="sect-tabs">
        <button class="sect-tab${tab==='overview' ?' active':''}" data-stab="overview">Overview</button>
        <button class="sect-tab${tab==='research'?' active':''}" data-stab="research">Research</button>
        <button class="sect-tab${tab==='store'   ?' active':''}" data-stab="store">Store</button>
        <button class="sect-tab${tab==='members' ?' active':''}" data-stab="members">Members</button>
      </div>`;

    // --- Tab content ---
    if (tab === 'overview') {
      // Active bonuses
      const bonusRows = [
        { label: 'Qi production',     value: (Sect.qiMult() * 100 - 100).toFixed(0) + '%' },
        { label: 'Combat ATK',        value: (Sect.combatMult() * 100 - 100).toFixed(0) + '%' },
        { label: 'Pet bonuses',       value: (Sect.petBonusMult() * 100 - 100).toFixed(0) + '%' },
        { label: 'Loot',              value: (Sect.lootMult() * 100 - 100).toFixed(0) + '%' },
        { label: 'Offline efficiency',value: '+' + (Sect.offlineBonus() * 100).toFixed(0) + '%' },
      ].filter(r => parseFloat(r.value) !== 0);

      html += `<div class="section-title small">✦ Active Bonuses</div>
        <div class="sect-bonus-list">
          ${bonusRows.map(r => `<div class="sect-bonus-row"><span>${r.label}</span><span class="sect-bonus-val" style="color:${current.color}">${r.value}</span></div>`).join('')}
          <div class="sect-bonus-row muted"><span>${current.bonusDesc}</span></div>
        </div>`;

      // Offerings
      html += `<div class="section-title small">🏵 Offerings</div>
        <div class="hint" style="margin-bottom:8px">Donate resources to earn Contribution. Contribution never resets — spend it on Research and the Store.</div>
        <div class="sect-offering-list">`;
      SectGuild.offerings.forEach(t => {
        const can = SectGuild.canOffer(t.id);
        html += `<div class="sect-offering-row">
          <span class="sect-offer-icon">${t.icon}</span>
          <div class="sect-offer-info">
            <span class="sect-offer-name">${t.name}</span>
            <span class="muted">−${GameNumbers.formatNumber(t.cost)} → +${t.gain} Contribution</span>
          </div>
          <button class="btn-mini${can ? '' : ''}" data-offer="${t.id}" ${can ? '' : 'disabled'}>Donate</button>
        </div>`;
      });
      html += `</div>`;

    } else if (tab === 'research') {
      const nodes = window.SectGuild ? SectGuild.nodesFor(current.id) : [];
      const branches = ['a', 'b'];
      const branchLabels = { a: 'Path I', b: 'Path II' };
      html += `<div class="section-title small">🔬 Sect Research</div>
        <div class="hint" style="margin-bottom:10px">Unlock permanent bonuses by spending Contribution. Tiers must be unlocked in order.</div>`;
      branches.forEach(branch => {
        const bNodes = nodes.filter(n => n.branch === branch);
        html += `<div class="sect-branch-label">${branchLabels[branch]}</div>
          <div class="sect-research-chain">`;
        bNodes.forEach((node, idx) => {
          const done = SectGuild.researched(node.id);
          const prereq = done ? true : SectGuild._prereqMet(current.id, node);
          const afford = prereq && !done && Sect.contribution() >= node.cost;
          const state = done ? 'done' : (afford ? 'available' : (prereq ? 'need-funds' : 'locked'));
          html += `<div class="sect-node ${state}">
            <div class="sect-node-tier">Tier ${node.tier}</div>
            <div class="sect-node-name">${node.name}</div>
            <div class="sect-node-desc muted">${node.desc}</div>
            <div class="sect-node-cost">${done ? '✓ Researched' : GameNumbers.formatNumber(node.cost) + ' Contrib'}</div>
            ${!done ? `<button class="btn-mini sect-research-btn" data-research="${node.id}" ${afford ? '' : 'disabled'}>Research</button>` : ''}
          </div>`;
          if (idx < bNodes.length - 1) html += `<div class="sect-chain-arrow">→</div>`;
        });
        html += `</div>`;
      });

    } else if (tab === 'store') {
      html += `<div class="section-title small">🛒 Contribution Store</div>
        <div class="hint" style="margin-bottom:10px">Exchange Contribution for resources and consumables.</div>
        <div class="sect-store-grid">`;
      SectGuild.store.forEach(item => {
        const can = SectGuild.canBuy(item.id);
        html += `<div class="sect-store-item${can ? '' : ' cant-afford'}">
          <div class="sect-store-ico">${item.icon}</div>
          <div class="sect-store-name">${item.name}</div>
          <div class="sect-store-desc muted">${item.desc}</div>
          <div class="sect-store-cost">${GameNumbers.formatNumber(item.cost)} Contrib</div>
          <button class="btn-mini" data-buy="${item.id}" ${can ? '' : 'disabled'}>Buy</button>
        </div>`;
      });
      html += `</div>`;

    } else if (tab === 'members') {
      html += `<div class="section-title small">Fellow Disciples</div>
        <div id="sect-roster" class="hint">Loading roster…</div>`;
    }

    html += `<button class="btn-ghost" id="leave-sect" style="margin-top:18px">Leave Sect (forfeit contribution)</button>`;

    el.innerHTML = html;

    // Wire tab buttons
    el.querySelectorAll('.sect-tab').forEach(btn => {
      btn.addEventListener('click', () => { this.sectTab = btn.dataset.stab; this.renderSect(); });
    });

    // Wire research buttons
    el.querySelectorAll('.sect-research-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.SectGuild && SectGuild.research(btn.dataset.research)) {
          this.toast('🔬 Research complete!');
          this.renderSect();
          this.renderResources();
        }
      });
    });

    // Wire store buy buttons
    el.querySelectorAll('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.SectGuild && SectGuild.buy(btn.dataset.buy)) {
          this.toast(`🛒 ${SectGuild.store.find(i=>i.id===btn.dataset.buy)?.name || 'Item'} purchased.`);
          this.renderSect();
          this.renderResources();
        }
      });
    });

    // Wire offering buttons
    el.querySelectorAll('[data-offer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gain = window.SectGuild && SectGuild.offer(btn.dataset.offer);
        if (gain) {
          this.toast(`🏵 +${gain} Contribution donated.`);
          this.renderSect();
          this.renderResources();
        }
      });
    });

    // Leave sect
    el.querySelector('#leave-sect')?.addEventListener('click', () => {
      Sect.leave().then(() => {
        this.sectTab = 'overview';
        this.toast('You have left your sect.');
        this.renderSect();
        this.renderResources();
      });
    });

    // Load member roster async
    if (tab === 'members') {
      const rosterReq = (this._sectRosterSeq = (this._sectRosterSeq || 0) + 1);
      Sect.backend.members(current.id).then(members => {
        if (this._sectRosterSeq !== rosterReq) return;
        const roster = el.querySelector('#sect-roster');
        if (roster) roster.innerHTML = members.map(m =>
          `<div class="roster-row"><span>${m.name}</span><span class="muted">${m.rank.name} · ${m.realm.name}</span></div>`).join('');
      });
    }

    if (scroller) scroller.scrollTop = scrollTop;
  },

  // -- Character creation (Gacha system) -----------------------------------
  showCharacterCreation() {
    const overlay = this._openModal();
    if (!overlay) return;
    overlay.id = 'creation-overlay';
    let gender = 'male';
    let currentRoot = GameData.rollSpiritualRoot('free');
    let rollsUsed = 1;
    const maxFreeRolls = 100;
    let bestRoot = currentRoot;
    let isRolling = false;
    let packsShown = false; // auto-show the packs popup once, when free rolls run out

    const rootRarityOrder = ['mortal', 'true', 'heaven', 'saint', 'chaos'];
    const rootRank = r => rootRarityOrder.indexOf(r.key);

    const leftoverRewards = (rollsLeft) => {
      if (rollsLeft <= 0) return '';
      const qi = rollsLeft * 50;
      const stones = Math.floor(rollsLeft * 10);
      return `<div class="leftover-reward">🎁 ${rollsLeft} unused rolls → <b>+${qi} Qi</b> + <b>${stones} Spirit Stones</b></div>`;
    };

    // Show the packs popup exactly once, the moment free rolls are exhausted.
    const maybeShowPacks = () => {
      if (rollsUsed >= maxFreeRolls && !packsShown) {
        packsShown = true;
        setTimeout(() => this.showSpiritPacks(overlay, bestRoot), 450);
      }
    };

    const render = () => {
      const g = GameData.genders[gender];
      const rollsLeft = maxFreeRolls - rollsUsed;
      const canRoll = rollsLeft > 0 && !isRolling;

      overlay.innerHTML = `
        <div class="modal creation gacha-modal">
          <h2>✨ Awaken Your Spiritual Root</h2>
          <p class="creation-sub">Every cultivator's fate is sealed by their root. Roll the heavens!</p>

          <div class="gacha-portrait-row">
            <div class="creation-emblem"><img id="creation-portrait" src="${g.emblem}" alt="cultivator"/></div>
            <div class="gacha-root-result ${isRolling ? 'rolling' : ''}" style="border-color:${currentRoot.color}">
              <div class="root-rarity-bar" style="background:${currentRoot.color}"></div>
              <div class="root-name" style="color:${currentRoot.color}">${currentRoot.name}</div>
              <div class="root-mult">×${currentRoot.mult.toFixed(1)} Production</div>
              <div class="root-desc">${currentRoot.desc}</div>
            </div>
          </div>

          <div class="gacha-counter">
            <span class="rolls-used">${rollsUsed}/${maxFreeRolls}</span> rolls used
            <div class="gacha-bar-wrap"><div class="gacha-bar" style="width:${(rollsUsed/maxFreeRolls*100).toFixed(1)}%"></div></div>
          </div>

          ${rollsLeft > 0 ? `
          <div class="gacha-btn-row">
            <button id="roll-1" class="gacha-roll-btn" ${!canRoll?'disabled':''}>🎲 Roll ×1<span class="roll-odds">Free</span></button>
            <button id="roll-10" class="gacha-roll-btn roll-10-btn" ${rollsLeft<10||!canRoll?'disabled':''}>🎲 Roll ×10<span class="roll-odds">Free</span></button>
          </div>
          ` : `
          <div class="gacha-exhausted">🌟 All free rolls used! Your best root: <b style="color:${bestRoot.color}">${bestRoot.name}</b></div>
          <button id="open-packs" class="open-packs-btn">🔮 Want a stronger root? View Spirit Root Packs</button>
          `}

          ${leftoverRewards(rollsLeft)}

          <div class="creation-fields">
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
          </div>

          <button id="begin-cultivation" class="modal-close begin-btn">Begin Cultivation ☯</button>
        </div>`;

      // Bind gender buttons
      overlay.querySelectorAll('.gender-btn').forEach(b =>
        b.addEventListener('click', () => {
          gender = b.dataset.g;
          this._creationName = overlay.querySelector('#creation-name')?.value || '';
          render();
        }));

      // Manual "view packs" button (only present after rolls are exhausted)
      const openPacksBtn = overlay.querySelector('#open-packs');
      if (openPacksBtn) openPacksBtn.addEventListener('click', () => this.showSpiritPacks(overlay, bestRoot));

      // Roll ×1
      const roll1Btn = overlay.querySelector('#roll-1');
      if (roll1Btn) roll1Btn.addEventListener('click', () => {
        if (isRolling || rollsUsed >= maxFreeRolls) return;
        this._creationName = overlay.querySelector('#creation-name')?.value || '';
        isRolling = true;
        render();
        setTimeout(() => {
          currentRoot = GameData.rollSpiritualRoot('free');
          rollsUsed = Math.min(rollsUsed + 1, maxFreeRolls);
          if (rootRank(currentRoot) > rootRank(bestRoot)) bestRoot = currentRoot;
          isRolling = false;
          render();
          this._flashRollResult(overlay, currentRoot);
          maybeShowPacks();
        }, 400);
      });

      // Roll ×10
      const roll10Btn = overlay.querySelector('#roll-10');
      if (roll10Btn) roll10Btn.addEventListener('click', () => {
        if (isRolling || rollsUsed + 10 > maxFreeRolls) return;
        this._creationName = overlay.querySelector('#creation-name')?.value || '';
        isRolling = true;
        render();
        setTimeout(() => {
          let lastRoot = currentRoot;
          for (let i = 0; i < 10 && rollsUsed < maxFreeRolls; i++) {
            lastRoot = GameData.rollSpiritualRoot('free');
            rollsUsed++;
            if (rootRank(lastRoot) > rootRank(bestRoot)) bestRoot = lastRoot;
          }
          currentRoot = lastRoot;
          isRolling = false;
          render();
          this._flashRollResult(overlay, currentRoot);
          maybeShowPacks();
        }, 600);
      });

      // Begin cultivation
      overlay.querySelector('#begin-cultivation').addEventListener('click', () => {
        const name = overlay.querySelector('#creation-name')?.value || '';
        const rollsLeft = maxFreeRolls - rollsUsed;
        // Grant leftover rewards
        if (rollsLeft > 0) {
          Game._addQi(rollsLeft * 50);
          Game.state.spiritStones = (Game.state.spiritStones || 0) + Math.floor(rollsLeft * 10);
        }
        Game.createCharacter(gender, name, bestRoot);
        this.applyGenderEmblem();
        this.renderAll();
        overlay.remove();
        this.toast(`☯ Welcome, ${Game.state.name}. Your ${bestRoot.name} Root awakens!`);
      });

      // Portrait
      this.setPortrait(overlay.querySelector('#creation-portrait'), Game.portraitSrc(gender, currentRoot.key), g.emblem);
    };

    render();
    document.body.appendChild(overlay);
  },

  /** Spirit Root Packs popup — only surfaced once free rolls are exhausted.
   *  Vertical, scannable list. `parentOverlay` is the creation modal. */
  showSpiritPacks(parentOverlay, bestRoot) {
    const packs = GameData.spiritRootPacks || [];
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    const rootColor = key => (GameData.spiritualRoots.find(r => r.key === key) || {}).color || 'var(--gold-d)';

    const perkLine = p => {
      const bits = [];
      if (p.guaranteedRoot) bits.push(`<b style="color:${rootColor(p.guaranteedRoot)}">${cap(p.guaranteedRoot)} Root</b> guaranteed`);
      if (p.rollMode === 'min_true')  bits.push('True Root or better');
      if (p.rollMode === 'min_saint') bits.push('Saint Root or better');
      if (p.extraRolls)     bits.push(`+${p.extraRolls} rolls`);
      if (p.bonusQi)        bits.push(`+${GameNumbers.formatNumber(p.bonusQi)} Qi`);
      if (p.bonusMoney)     bits.push(`+${p.bonusMoney} Stones`);
      if (p.bonusDao)       bits.push(`+${p.bonusDao} Dao`);
      if (p.productionBonus)bits.push(`+${(p.productionBonus*100).toFixed(0)}% production`);
      return bits.join(' · ');
    };

    const ov = document.createElement('div');
    ov.className = 'modal-overlay pack-popup-overlay';
    ov.innerHTML = `
      <div class="modal pack-popup">
        <div class="pack-popup-icon">🔮</div>
        <h2>Spirit Root Packs</h2>
        <p class="creation-sub">Out of free rolls. Your best is <b style="color:${bestRoot.color}">${bestRoot.name}</b>.
        Secure an even stronger root &amp; a head start — or continue free, your choice.</p>
        <div class="pack-list">
          ${packs.map(p => `
            <button class="pack-row" data-pack="${p.id}" style="--pc:${p.color||'var(--gold-d)'}">
              <span class="pack-row-ico">${p.icon || '🔮'}</span>
              <span class="pack-row-main">
                <span class="pack-row-name">${p.name || cap(p.id)}</span>
                <span class="pack-row-perks">${perkLine(p)}</span>
              </span>
              <span class="pack-row-price">${p.price}</span>
            </button>`).join('')}
        </div>
        <button class="btn-ghost" id="packs-close">Maybe later — continue with my ${bestRoot.name}</button>
      </div>`;

    ov.querySelectorAll('.pack-row[data-pack]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await Monetization.purchaseSpiritPack(btn.dataset.pack);
        if (ok) { ov.remove(); if (parentOverlay) parentOverlay.remove(); } // grant result takes over
      });
    });
    ov.querySelector('#packs-close').addEventListener('click', () => ov.remove());
    document.body.appendChild(ov);
  },

  /** Brief flash/shake animation on the root-result card after a roll. */
  _flashRollResult(overlay, root) {
    const card = overlay.querySelector('.gacha-root-result');
    if (!card) return;
    card.classList.remove('roll-flash');
    void card.offsetWidth; // reflow
    card.classList.add('roll-flash');
    card.addEventListener('animationend', () => card.classList.remove('roll-flash'), { once: true });
  },

  // -- Ad boost actions -----------------------------------------------------
  async doAdBoostQi() {
    const btn = document.getElementById('boost-qi-btn');
    if (btn) btn.disabled = true;
    const ok = await Monetization.showAdBoost();
    if (!ok && btn) btn.disabled = false;
    this.renderBoosts();
  },

  async doAdBoostStage() {
    if (this._stageAidActive) return;
    const btn = document.getElementById('boost-stage-btn');
    if (btn) btn.disabled = true;
    const watched = await Monetization.showRewardedAd('stage_aid');
    if (watched) {
      this._stageAidActive = true;
      this.toast('⬆ Stage Aid active — next stage requirement reduced by 30%!');
    }
    if (btn) btn.disabled = false;
    this.renderBoosts();
  },

  /** Update ad-boost button states and timers. Called from tickRender. */
  renderBoosts() {
    // Qi boost button
    const qiBtn = document.getElementById('boost-qi-btn');
    const qiStatus = document.getElementById('boost-qi-status');
    if (qiBtn && qiStatus) {
      const endsAt = Game.state.qiBoostEndsAt || 0;
      const left = Math.max(0, Math.ceil((endsAt - TimeService.now()) / 1000));
      if (left > 0) {
        qiBtn.classList.add('active-boost');
        qiBtn.disabled = true;
        qiStatus.textContent = `⚡ ${GameNumbers.formatDuration(left)}`;
      } else {
        qiBtn.classList.remove('active-boost');
        qiBtn.disabled = false;
        qiStatus.textContent = '2× Qi 5min';
      }
    }
    // Stage aid button
    const stageBtn = document.getElementById('boost-stage-btn');
    if (stageBtn) {
      stageBtn.classList.toggle('active-boost', !!this._stageAidActive);
      stageBtn.querySelector('.ad-boost-sub').textContent = this._stageAidActive
        ? '✓ Applied'
        : 'Stage Aid';
    }
  },

  // -- Shop -----------------------------------------------------------------
  showShop() {
    const overlay = this._openModal();
    if (!overlay) return;
    const adsOwned  = Monetization.adsRemoved;
    const dblOwned  = Game.state.permanentDouble;

    overlay.innerHTML = `
      <div class="modal" style="text-align:left">
        <h2 style="text-align:center;margin-bottom:4px">🛒 Immortal Shop</h2>
        <p style="text-align:center;margin-bottom:16px">Support the game & speed up your cultivation.</p>

        <div class="shop-section-label">💎 Premium</div>
        <div class="shop-grid">
          <div class="shop-card">
            <span class="shop-card-ico">🚫</span>
            <span class="shop-card-info">
              <span class="shop-card-name">Remove Ads</span>
              <span class="shop-card-desc">Removes all ads — including banners, interstitials, and rewarded-video prompts. Every ad-gated bonus is granted instantly instead.</span>
            </span>
            <button class="shop-card-btn ${adsOwned ? 'muted-btn' : 'jade-btn'}" data-product="remove_ads" ${adsOwned ? 'disabled' : ''}>
              ${adsOwned ? '✓ Owned' : '$10.99'}
            </button>
          </div>
          <div class="shop-card">
            <span class="shop-card-ico">⚡</span>
            <span class="shop-card-info">
              <span class="shop-card-name">Permanent 2× Production</span>
              <span class="shop-card-desc">Doubles all Qi generation forever — stacks with all bonuses.</span>
            </span>
            <button class="shop-card-btn ${dblOwned ? 'muted-btn' : 'gold-btn'}" data-product="permanent_double" ${dblOwned ? 'disabled' : ''}>
              ${dblOwned ? '✓ Owned' : '$4.99'}
            </button>
          </div>
        </div>

        <div class="shop-section-label">🧧 Consumables</div>
        <div class="shop-grid">
          <div class="shop-card">
            <span class="shop-card-ico">☯</span>
            <span class="shop-card-info">
              <span class="shop-card-name">Qi Pouch</span>
              <span class="shop-card-desc">Instantly grants 1 hour of your current Qi production straight to your meridians.</span>
            </span>
            <button class="shop-card-btn gold-btn" data-product="qi_pouch_small">$0.99</button>
          </div>
        </div>

        <button class="modal-close" style="margin-top:16px">Close</button>
      </div>`;

    overlay.querySelectorAll('[data-product]').forEach(btn => {
      if (btn.disabled) return;
      btn.addEventListener('click', async () => {
        overlay.remove();
        await Monetization.purchase(btn.dataset.product);
      });
    });
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  // -- Effects --------------------------------------------------------------
  floatText(e, text, crit) {
    const span = document.createElement('span');
    span.className = 'float-text' + (crit ? ' crit' : '');
    span.textContent = text;
    const rect = this.el.tapBtn.getBoundingClientRect();
    const x = (e.clientX || rect.left + rect.width / 2);
    const y = (e.clientY || rect.top + rect.height / 2);
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 1000);
    // Emit a small burst of Qi particles around the tap point.
    this.spawnParticles(x, y, 6);
  },

  // -- Quests ---------------------------------------------------------------
  showQuests() {
    if (!window.Quests) return;
    const overlay = this._openModal();
    if (!overlay) return;
    const s = Quests.state;
    const cats = [
      { key: 'story',       label: '📖 Cultivator\'s Path', hint: 'Follow the story — each step unlocks the next.' },
      { key: 'achievement', label: '🏆 Achievements',       hint: 'One-time milestones you can complete in any order.' },
      { key: 'hidden',      label: '🔮 Hidden',             hint: 'Some quests are not what they seem…' },
    ];

    const renderContent = () => {
      const unclaimedList = Quests.defs.filter(q => s.completed[q.id] && !s.claimed[q.id]);
      const totalCount   = Quests.defs.length;
      const claimedCount = Quests.defs.filter(q => s.claimed[q.id]).length;
      const pct = totalCount ? Math.round((claimedCount / totalCount) * 100) : 0;

      let html = `<div class="modal quest-modal">
        <div class="quest-header">
          <h2>📜 Quest Log</h2>
          <div class="quest-progress-summary">
            <div class="quest-progress-track"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
            <span class="quest-progress-text">${claimedCount}/${totalCount} claimed</span>
          </div>
        </div>`;

      // Prominent Claim All when there are rewards waiting.
      if (unclaimedList.length >= 1) {
        html += `<button class="quest-claim-all" id="quest-claim-all">
          🎁 Claim All Rewards <span class="claim-all-count">${unclaimedList.length}</span>
        </button>`;
      }

      html += `<div class="quest-scroll">`;
      let anyVisible = false;
      cats.forEach(cat => {
        // Only show quests that are NOT yet claimed — claimed ones disappear from the log.
        const quests = Quests.defs.filter(q => q.category === cat.key && !s.claimed[q.id]);
        if (!quests.length) return; // whole category done → hide its header too
        const catReady = quests.filter(q => s.completed[q.id]).length;
        // Sort: ready-to-claim first, then in-progress.
        const sorted = [...quests].sort((a, b) => {
          const rank = q => (s.completed[q.id] ? 0 : 1);
          return rank(a) - rank(b);
        });
        anyVisible = true;
        html += `<div class="quest-cat">
          <div class="quest-cat-head">
            <span class="quest-cat-label">${cat.label}</span>
            <span class="quest-cat-count">${quests.length} left${catReady?` · <b class="cat-ready">${catReady} ready</b>`:''}</span>
          </div>`;
        sorted.forEach(q => {
          const done    = !!s.completed[q.id];
          const secret  = q.secret && !done;
          const title   = secret ? '???' : (done && q.revealTitle ? q.revealTitle : q.title);
          const desc    = secret ? q.desc : (done && q.revealDesc ? q.revealDesc : q.desc);
          const state   = done ? 'done' : '';
          html += `<div class="quest-row ${state}" data-id="${q.id}">
            <span class="quest-ico">${done ? q.icon : (secret ? '🔒' : q.icon)}</span>
            <span class="quest-info">
              <span class="quest-title">${title}</span>
              <span class="quest-desc">${desc}</span>
              ${!secret && q.hint && !done ? `<span class="quest-hint-text">💡 ${q.hint}</span>` : ''}
              <span class="quest-reward ${done?'ready':''}">🎁 ${q.rewardText}</span>
            </span>
            ${done ? `<button class="quest-claim-btn" data-qid="${q.id}">Claim</button>` : ''}
          </div>`;
        });
        html += `</div>`;
      });
      if (!anyVisible) {
        html += `<div class="quest-empty">
          <div class="quest-empty-ico">🎉</div>
          <div class="quest-empty-title">All caught up!</div>
          <div class="hint">Every available quest reward has been claimed. New quests will appear as you progress your cultivation.</div>
        </div>`;
      }
      html += `</div><button class="modal-close" style="margin-top:14px">Done</button></div>`;
      overlay.innerHTML = html;

      overlay.querySelectorAll('.quest-claim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (Quests.claim(btn.dataset.qid)) {
            UI.renderAll(); UI.updateQuestBadge(); renderContent();
          }
        });
      });

      const claimAll = overlay.querySelector('#quest-claim-all');
      if (claimAll) claimAll.addEventListener('click', () => {
        let n = 0;
        unclaimedList.forEach(q => { if (Quests.claim(q.id)) n++; });
        if (n) {
          UI.renderAll(); UI.updateQuestBadge();
          UI.toast(`🎁 Claimed ${n} quest reward${n>1?'s':''}!`);
        }
        renderContent();
      });

      overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    };

    renderContent();
    document.body.appendChild(overlay);
  },

  /** Queue and show one or more mentor/antagonist dialogue snippets as lightweight, auto-dismissing banners. */
  showDialogue(entries) {
    this._dialogueQueue = (this._dialogueQueue || []).concat(entries);
    if (!this._dialogueShowing) this._advanceDialogue();
  },

  _advanceDialogue() {
    const queue = this._dialogueQueue;
    if (!queue || !queue.length) { this._dialogueShowing = false; return; }
    this._dialogueShowing = true;
    const entry = queue.shift();
    const tagClass = entry.speaker === 'antagonist' ? 'story-antagonist'
                    : entry.speaker === 'void'       ? 'story-void'
                    : 'story-mentor';
    const el = document.createElement('div');
    el.className = `story-toast ${tagClass}`;
    el.innerHTML = `
      <div class="story-toast-head"><span class="story-toast-icon">${entry.icon}</span><span class="story-toast-name">${entry.name}</span></div>
      <div class="story-toast-body">${entry.lines.join('<br>')}</div>`;
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      el.classList.remove('show');
      setTimeout(() => { el.remove(); this._advanceDialogue(); }, 300);
    };
    el.addEventListener('click', dismiss);
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    const readMs = Math.min(7000, Math.max(2400, entry.lines.join(' ').length * 45));
    setTimeout(dismiss, readMs);
  },

  /** Called from main loop when a quest is newly completed. */
  onQuestCompleted(q) {
    if (q.dialogue && q.dialogue.length) {
      const claimLine = `🎁 Tap 📜 to claim ${q.rewardText}`;
      const entries = q.dialogue.map((e, i, arr) =>
        i < arr.length - 1 ? e : { ...e, lines: [...e.lines, claimLine] });
      this.showDialogue(entries);
      return;
    }
    const isSecret = q.secret;
    const title = isSecret ? `🔮 Secret Discovered: ${q.revealTitle || q.title}` : `📜 Quest Complete: ${q.title}`;
    this.toast(title + ` — tap 📜 to claim ${q.rewardText}`);
  },

  /** Update the red badge on the quest button. */
  updateQuestBadge() {
    const badge = document.getElementById('quest-badge');
    if (!badge || !window.Quests) return;
    const count = Quests.unclaimed().length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  },

  // -- Hidden mechanic popups -----------------------------------------------
  /** Cultivation Insight — appears briefly over the cultivate tab. */
  showInsight() {
    const el = document.createElement('div');
    el.className = 'insight-flash';
    el.innerHTML = `<div class="insight-inner">
      <div class="insight-title">✨ Cultivation Insight</div>
      <div class="insight-sub">Your Dao perception deepens — 2× Qi for 60 seconds!</div>
    </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
    this.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 18);
  },

  /** Lucky number resonance event. */
  showLuckyEvent() {
    setTimeout(() => {
      this.modal('🎰 Auspicious Resonance',
        'Your Qi resonates at <b>8,888</b> — a supremely auspicious number. The universe smiles upon the observant.<br><br>Check your Quest Log for a hidden reward.',
        null);
      if (window.Quests) {
        const newlyDone = Quests.checkAll();
        newlyDone.forEach(q => this.onQuestCompleted(q));
        this.updateQuestBadge();
      }
    }, 500);
  },

  /** Show a stage milestone popup when a culturally significant stage is reached. */
  showMilestonePopup(milestone) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay milestone-overlay';
    overlay.innerHTML = `
      <div class="modal milestone-modal">
        <div class="milestone-icon">${milestone.icon}</div>
        <h2 class="milestone-title">${milestone.name}</h2>
        <p class="milestone-sub">Stage ${milestone.at} — A sacred number of the Dao</p>
        <div class="milestone-rewards">
          <div class="milestone-reward">✦ +${(milestone.bonus*100).toFixed(0)}% permanent production</div>
          ${milestone.dao ? `<div class="milestone-reward">✦ +${milestone.dao} Dao Comprehension</div>` : ''}
        </div>
        <button class="modal-close milestone-close">Embrace the Dao ☯</button>
      </div>`;
    overlay.querySelector('.milestone-close').addEventListener('click', () => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
    });
    document.body.appendChild(overlay);
    this.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 12);
  },

  /** Show result after a spirit pack is purchased and granted. */
  showPackGrantResult(pack, root) {
    const overlay = this._openModal();
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="modal pack-result-modal">
        <h2>🔮 Root Awakened!</h2>
        <div class="gacha-root-result" style="border-color:${root.color};margin:1rem auto;max-width:260px">
          <div class="root-rarity-bar" style="background:${root.color}"></div>
          <div class="root-name" style="color:${root.color}">${root.name}</div>
          <div class="root-mult">×${root.mult.toFixed(1)} Production</div>
          <div class="root-desc">${root.desc}</div>
        </div>
        <div class="pack-bonuses">
          ${pack.bonusQi ? `<div class="pack-bonus-line">✦ +${GameNumbers.formatNumber(pack.bonusQi)} Qi granted</div>` : ''}
          ${pack.bonusDao ? `<div class="pack-bonus-line">✦ +${pack.bonusDao} Dao Comprehension</div>` : ''}
          ${pack.bonusMoney ? `<div class="pack-bonus-line">✦ +${pack.bonusMoney} Spirit Stones</div>` : ''}
          ${pack.productionBonus ? `<div class="pack-bonus-line">✦ +${(pack.productionBonus*100).toFixed(0)}% Production (permanent)</div>` : ''}
        </div>
        <button class="modal-close">Accept Destiny ☯</button>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => {
      overlay.remove();
      // Re-show character creation with new root applied
      if (!Game.state.characterCreated) this.showCharacterCreation();
    });
    document.body.appendChild(overlay);
    this.spawnParticles(window.innerWidth / 2, 200, 16);
  },

  /** Show hidden breakthrough conditions that were triggered. */
  showBreakthroughConditions(conditionsHit) {
    if (!conditionsHit || !conditionsHit.length) return;
    const overlay = this._openModal();
    if (!overlay) return;
    const lines = conditionsHit.map(c =>
      `<div class="condition-hit"><span class="cond-icon">${c.icon||'✦'}</span><b>${c.name}</b> — ${c.desc}${c.bonus ? ` <span class="cond-bonus">+${(c.bonus*100).toFixed(0)}% Prod</span>` : ''}</div>`
    ).join('');
    overlay.innerHTML = `
      <div class="modal conditions-modal">
        <h2>🌟 Hidden Dao Revealed!</h2>
        <p class="conditions-sub">Your cultivation path has unveiled secret insights:</p>
        ${lines}
        <button class="modal-close">Transcend ☯</button>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  /** Emit a gentle trickle of ambient particles from the meditate button. */
  _startAmbientParticles() {
    setInterval(() => {
      if (this.activeTab !== 'cultivate') return;
      const rect = this.el.tapBtn && this.el.tapBtn.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      this.spawnParticles(cx, cy, 2);
    }, 1800);
  },

  /** Spawn `count` ambient Qi particles at (cx, cy). */
  spawnParticles(cx, cy, count = 4) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'qi-particle';
      const size = 6 + Math.random() * 10;
      const ox = (Math.random() - .5) * 50;
      const oy = (Math.random() - .5) * 30;
      const dur = 600 + Math.random() * 600;
      p.style.cssText = `width:${size}px;height:${size}px;left:${cx + ox - size/2}px;top:${cy + oy - size/2}px;animation-duration:${dur}ms`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), dur + 50);
    }
  },

  /** Flash the Qi counter to signal a gain. */
  flashQiCounter() {
    if (!this.el.qi) return;
    this.el.qi.classList.remove('qi-flash');
    // Force reflow so the class re-triggers.
    void this.el.qi.offsetWidth;
    this.el.qi.classList.add('qi-flash');
    setTimeout(() => this.el.qi.classList.remove('qi-flash'), 500);
  },

  /** Micro-bounce a generator row after purchase. */
  bounceGen(id) {
    const row = document.getElementById('gen-' + id);
    if (!row) return;
    row.classList.remove('gen-bounce');
    void row.offsetWidth;
    row.classList.add('gen-bounce');
    setTimeout(() => row.classList.remove('gen-bounce'), 400);
  },

  /** Full-screen lightning flash overlay — shown on realm ascension. */
  breakthroughFlash() {
    const el = document.createElement('div');
    el.className = 'breakthrough-flash';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 750);
  },

  /** True if a `.modal-overlay` is already attached — used to avoid stacking. */
  _modalOpen() { return !!document.querySelector('.modal-overlay'); },

  /** Create and return a fresh `.modal-overlay` div, or null if one is already
   *  open (callers should `if (!overlay) return;`). Does not attach it — the
   *  caller fills in innerHTML/listeners, then appends it to the body. */
  _openModal(extraClass) {
    if (this._modalOpen()) return null;
    const overlay = document.createElement('div');
    overlay.className = extraClass ? `modal-overlay ${extraClass}` : 'modal-overlay';
    return overlay;
  },

  toast(msg) {
    this._toastQueue = (this._toastQueue || []).concat(msg);
    if (!this._toastShowing) this._advanceToast();
  },

  _advanceToast() {
    const queue = this._toastQueue;
    if (!queue || !queue.length) { this._toastShowing = false; return; }
    this._toastShowing = true;
    const msg = queue.shift();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.remove(); this._advanceToast(); }, 400);
    }, 3200);
  },

  showWelcomeBack(result) {
    if (result.cheated) {
      this.toast('⏳ Time anomaly detected — offline cultivation suspended.');
      return;
    }
    if (result.seconds < GameData.offline.minSecondsToShow || result.gained <= 0) return;
    const F = GameNumbers.formatNumber;
    const rows = [`<div class="offline-row"><span>🧘 Cultivated</span><b>${F(result.gained)} Qi</b></div>`];
    if (result.money > 0)  rows.push(`<div class="offline-row"><span>💼 Salary earned</span><b>¥${F(result.money)}</b></div>`);
    if (result.stones > 0) rows.push(`<div class="offline-row"><span>⚔️ Trials loot</span><b>${F(result.stones)} Stones${result.eggs > 0 ? ' · ' + result.eggs + ' Egg' + (result.eggs > 1 ? 's' : '') : ''}</b></div>`);
    if (result.zones > 0)  rows.push(`<div class="offline-row"><span>⛰ Zones advanced</span><b>+${result.zones}</b></div>`);
    if (result.artifacts > 0) rows.push(`<div class="offline-row"><span>⚜️ Artifacts found</span><b>+${result.artifacts}</b></div>`);
    if (result.contribution > 0) rows.push(`<div class="offline-row"><span>⛩ Sect contribution</span><b>+${F(result.contribution)}</b></div>`);
    const msg = `While you were away (${GameNumbers.formatDuration(result.seconds)}` +
      (result.capped ? ', capped at 8h' : '') + `):` +
      `<div class="offline-report">${rows.join('')}</div>`;
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
    const overlay = this._openModal();
    if (!overlay) return;
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

  // -- Cultivation speed breakdown ------------------------------------------
  showCultivationBreakdown() {
    const overlay = this._openModal();
    if (!overlay) return;
    const m = Game.multipliers();
    const pct = v => (v >= 1 ? '+' : '') + ((v - 1) * 100).toFixed(0) + '%';
    const x = v => v.toFixed(2) + '×';
    const rows = [
      ['Spiritual Root',       x(m.root)],
      ['Stages Cleared',       x(m.stage)],
      ['Dao Comprehension',    x(m.dao)],
      ['Talent (Study)',       x(m.talent)],
      ['Spirit Beasts',        x(m.pet)],
      ['Sect Blessing',        x(m.sect)],
      ['Family Bond',          x(m.family)],
      ['Bloodline Legacy',     x(m.legacy)],
      ['All-Mult (buffs/perks/pills)', x(m.allMult)],
    ].filter(([, v]) => v !== '1.00×');
    const total = Game.qiPerSecond();
    overlay.innerHTML = `
      <div class="modal" style="text-align:left">
        <h2 style="text-align:center">⚡ Cultivation Speed</h2>
        <p style="text-align:center;color:var(--muted);font-size:13px;margin:0 0 12px">Every multiplier stacks multiplicatively.</p>
        <div class="card" style="padding:10px 14px">
          ${rows.map(([label, val]) => `
            <div class="row-between" style="padding:4px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:13px">${label}</span>
              <b style="color:var(--jade-d)">${val}</b>
            </div>`).join('')}
          <div class="row-between" style="padding:6px 0;margin-top:2px">
            <span style="font-size:13px;font-weight:700">Total Qi/s</span>
            <b style="color:var(--gold-d)">${GameNumbers.formatRate(total)}</b>
          </div>
        </div>
        <button class="modal-close" style="margin-top:8px">Close</button>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  // -- Cultivation Record (stats) -------------------------------------------
  showStats() {
    const overlay = this._openModal();
    if (!overlay) return;
    const s = Game.state;
    const totalOwned = GameData.generators.reduce((n, g) => n + (s.owned[g.id] || 0), 0);
    const techs = Object.keys(s.upgrades || {}).length;
    const merids = Object.keys(s.meridians || {}).length;
    const perks = Object.keys(s.heavenlyPerks || {}).length;
    const fam = s.family || {};
    const children = (fam.children || []).length;
    const highestRealm = (s.foundationBonuses || []).reduce((m, b) => Math.max(m, b.realm || 0), s.realm);

    overlay.innerHTML = `
      <div class="modal" style="text-align:left">
        <h2 style="text-align:center">📜 Cultivation Record</h2>
        <div class="stat-row" style="margin:10px 0 14px">
          <div class="stat"><span class="stat-v">${GameNumbers.formatNumber(s.lifetimeQi)}</span><span class="stat-k">Lifetime Qi</span></div>
          <div class="stat"><span class="stat-v">${GameNumbers.formatNumber(s.totalTaps || 0)}</span><span class="stat-k">Meditations</span></div>
          <div class="stat"><span class="stat-v">${s.stagesCleared}</span><span class="stat-k">Stages Cleared</span></div>
          <div class="stat"><span class="stat-v">${s.reincarnations}</span><span class="stat-k">Past Lives</span></div>
        </div>
        <div class="card">
          <div class="card-title">🏆 Milestones</div>
          <div class="hint">Highest Realm: <b>${GameData.realms[highestRealm] ? GameData.realms[highestRealm].name : 'Mortal'}</b></div>
          <div class="hint">Dao Comprehension: <b>${GameNumbers.formatNumber(s.daoComprehension)}</b></div>
          <div class="hint">Heavenly Merit: <b>${GameNumbers.formatNumber(s.heavenlyMerit)}</b></div>
          <div class="hint">Secret Realm Best Floor: <b>${(s.secretRealm && s.secretRealm.highestFloor) || 0}</b></div>
        </div>
        <div class="card">
          <div class="card-title">🧬 Collections</div>
          <div class="hint">Generators Owned: <b>${totalOwned}</b></div>
          <div class="hint">Techniques Learned: <b>${techs}/${GameData.upgrades.length}</b></div>
          <div class="hint">Meridians Opened: <b>${merids}/${GameData.meridians.length}</b></div>
          <div class="hint">Heavenly Perks: <b>${perks}/${GameData.heavenlyPerks.length}</b></div>
          <div class="hint">Children Raised: <b>${children}</b></div>
        </div>
        <button class="modal-close" style="margin-top:6px">Close</button>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  },

  // -- Rate-my-app prompt ----------------------------------------------------
  askRating() {
    const overlay = this._openModal();
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="modal" style="text-align:center">
        <div style="font-size:40px;margin:4px 0">⭐</div>
        <h2>Enjoying Path to Immortality?</h2>
        <p>Your rating helps other cultivators discover the game. If you have feedback, we'd love to hear it.</p>
        <div style="display:flex;gap:8px;margin:14px 0">
          <button class="btn-ghost" id="rate-later" style="flex:1">Later</button>
          <button class="btn-primary" id="rate-now" style="flex:1;background:linear-gradient(135deg,#f0c040,var(--gold-d))!important;box-shadow:0 4px 12px rgba(199,154,59,0.35)!important">Rate ★★★★★</button>
        </div>
      </div>`;
    overlay.querySelector('#rate-later').addEventListener('click', () => {
      localStorage.setItem('pti_rated_app', 'later');
      overlay.remove();
    });
    overlay.querySelector('#rate-now').addEventListener('click', () => {
      localStorage.setItem('pti_rated_app', 'rated');
      overlay.remove();
      const storeUrl = window.__gameStoreUrl || '#';
      if (storeUrl !== '#') window.open(storeUrl, '_blank');
      else this.toast('⭐ Thank you! (Set __gameStoreUrl to open the real store page.)');
    });
    document.body.appendChild(overlay);
  },

  // ======================================================================
  // ACHIEVEMENTS (Round 11)
  // ======================================================================
  renderAchievements() {
    const el = document.getElementById('sub-feats');
    if (!el || !window.Achievements) return;
    const stats = Achievements.stats();
    const newUnlocks = Achievements.checkAll();
    if (newUnlocks.length) {
      newUnlocks.forEach(d => this.toast(`🏆 Achievement Unlocked: ${d.name}!`));
    }

    let html = `<div class="section-title">🏆 Cultivation Milestones
      <small class="muted"> ${stats.unlocked}/${stats.total} unlocked · ${stats.claimed} claimed</small></div>`;

    for (const cat of Achievements.CAT_ORDER) {
      const defs = Achievements.defs.filter(d => d.cat === cat);
      html += `<div class="ach-cat-label">${Achievements.CAT_LABELS[cat]}</div><div class="ach-list">`;
      for (const def of defs) {
        const unlocked = Achievements.isUnlocked(def.id);
        const claimed  = Achievements.isClaimed(def.id);
        const prog     = Achievements.progress(def.id);
        const pct      = prog ? Math.round(prog.cur / prog.max * 100) : (unlocked ? 100 : 0);
        const rewardStr = (() => {
          const r = def.reward || {};
          const parts = [];
          if (r.stones) parts.push(`+${GameNumbers.formatNumber(r.stones)} Stones`);
          if (r.eggs)   parts.push(`+${r.eggs} Beast Egg${r.eggs > 1 ? 's' : ''}`);
          return parts.join(' · ');
        })();
        html += `<div class="ach-card${unlocked ? ' unlocked' : ''}${claimed ? ' claimed' : ''}">
          <span class="ach-icon">${def.icon}</span>
          <div class="ach-body">
            <div class="ach-name">${def.name}</div>
            <div class="ach-desc muted">${def.desc}</div>
            ${prog ? `<div class="ach-bar-wrap"><div class="ach-bar" style="width:${pct}%"></div></div>
              <div class="ach-prog muted">${prog.cur}/${prog.max}</div>` : ''}
            ${rewardStr ? `<div class="ach-reward">${rewardStr}</div>` : ''}
          </div>
          <div class="ach-actions">
            ${unlocked && !claimed ? `<button class="btn-mini claim-ach" data-id="${def.id}">Claim</button>` : ''}
            ${claimed ? `<span class="ach-done">✓</span>` : ''}
            ${!unlocked ? `<span class="ach-locked muted">${pct > 0 ? pct + '%' : '🔒'}</span>` : ''}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    el.innerHTML = html;
    el.querySelectorAll('.claim-ach').forEach(btn => {
      btn.addEventListener('click', () => {
        if (Achievements.claim(btn.dataset.id)) {
          this.renderAchievements();
          this.renderResources();
        }
      });
    });
  },

  // ======================================================================
  // DAILY MISSIONS (Round 11)
  // ======================================================================
  renderDailies() {
    const el = document.getElementById('sub-dailies');
    if (!el || !window.Dailies) return;

    const missions    = Dailies.missions();
    const streak      = Dailies.streak();
    const allComplete = Dailies.allComplete();
    const sealClaimed = Dailies.sealClaimed();
    const weekReady   = Dailies.weekReady();

    let html = `<div class="section-title">📋 Daily Missions</div>`;

    // Streak banner
    html += `<div class="daily-streak-banner">
      <span class="daily-streak-fire">🔥</span>
      <span class="daily-streak-num">${streak}</span>
      <span class="muted"> day streak</span>
      ${streak >= 7 ? '<span class="daily-streak-badge">Week!</span>' : ''}
    </div>`;

    // Weekly reward claim
    if (weekReady) {
      html += `<div class="daily-week-banner">
        <span>🎁 <b>7-Day Streak!</b> Claim your Weekly Artifact Chest.</span>
        <button class="btn-mini claim-week-reward" style="margin-left:auto">Claim</button>
      </div>`;
    }

    // Mission list
    html += `<div class="daily-mission-list">`;
    for (const m of missions) {
      const pct = Math.min(100, Math.round(m.progress / m.target * 100));
      html += `<div class="daily-mission${m.completed ? ' done' : ''}">
        <div class="daily-m-header">
          <span class="daily-m-label">${m.label}</span>
          <span class="daily-m-count ${m.completed ? 'complete' : ''}">${m.progress}/${m.target}</span>
        </div>
        <div class="daily-bar-wrap"><div class="daily-bar" style="width:${pct}%"></div></div>
      </div>`;
    }
    html += `</div>`;

    // Seal reward
    html += `<div class="daily-seal-section">
      <div class="daily-seal-title">⚜️ Cultivation Seal — ${allComplete ? (sealClaimed ? 'Active / Claimed' : 'Ready!') : 'Incomplete'}</div>
      <div class="muted" style="font-size:12px;margin-bottom:8px">Complete all 5 missions to earn a 2-hour 2× Qi production buff.</div>`;
    if (allComplete && !sealClaimed) {
      html += `<button class="btn-mini claim-seal">Claim Seal (+2× Qi for 2h)</button>`;
    }
    html += `</div>`;

    // Seal live timer is rendered by renderDailiesLive
    html += `<div id="daily-seal-timer" class="daily-seal-timer"></div>`;

    el.innerHTML = html;
    el.querySelector('.claim-seal')?.addEventListener('click', () => {
      if (Dailies.claimSeal()) { this.renderDailies(); this.toast('⚜️ Cultivation Seal activated! 2× Qi for 2 hours.'); }
    });
    el.querySelector('.claim-week-reward')?.addEventListener('click', () => {
      if (Dailies.claimWeekReward()) { this.renderDailies(); this.toast('🎁 Weekly chest claimed! 3 Artifacts received.'); }
    });
    this.renderDailiesLive();
  },

  renderDailiesLive() {
    const el = document.getElementById('daily-seal-timer');
    if (!el || !window.Dailies) return;
    if (Dailies.sealActive()) {
      const left = Dailies.sealTimeLeft();
      const h = Math.floor(left / 3600);
      const m = Math.floor((left % 3600) / 60);
      const s = left % 60;
      el.textContent = `⚡ Seal active: ${h}h ${m}m ${s}s remaining`;
      el.style.display = '';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  },
  // ======================================================================
  // CELESTIAL FRACTURE — Resonance Tree + Mastery + Investments (R13/14)
  // ======================================================================
  renderFracture() {
    const el = document.getElementById('sub-fracture');
    if (!el || !window.Fracture) return;

    const shards = Game.state.stellarShards || 0;
    const rifts  = Fracture.riftsSealed();
    const major  = Fracture.majorRiftsSealed();
    const grand  = Fracture.grandRiftsSealed();

    // -- Header: shards + rift breakdown ------------------------------------
    let html = `<div class="section-title">🌌 Celestial Fracture</div>
<div class="fracture-header">
  <div class="fracture-shards-display">
    <span class="shard-icon">💎</span>
    <span class="shard-amount">${GameNumbers.formatNumber(shards)}</span>
    <span class="shard-label">Stellar Shards</span>
  </div>
  <div class="fracture-rift-stats">
    <div class="frs-row"><span class="frs-icon">🌌</span><span class="frs-val">${rifts - major - grand}</span><span class="frs-lbl">Minor</span></div>
    <div class="frs-row"><span class="frs-icon">💫</span><span class="frs-val">${major}</span><span class="frs-lbl">Major</span></div>
    <div class="frs-row"><span class="frs-icon">🌠</span><span class="frs-val">${grand}</span><span class="frs-lbl">Grand</span></div>
  </div>
</div>
<p class="fracture-lore">The heavens have cracked. Stellar Shards fall from zone 3+ combat. Rifts tear open after boss clears — deeper zones spawn Major and Grand Rifts with greater yields. Channel Shards into Resonance paths; master a full path to unlock Mastery bonuses, or Invest large caches for permanent global boosts.</p>`;

    // -- Resonance paths ----------------------------------------------------
    html += `<div class="fracture-section-label">Resonance Tree</div>
<div class="fracture-paths">`;
    const pathOrder = ['a','b','c','d'];
    for (const path of pathOrder) {
      const label    = Fracture.pathLabels[path];
      const nodes    = Fracture.nodes.filter(n => n.path === path).sort((a,b) => a.tier - b.tier);
      const mastered = Fracture.pathMastered(path);
      const mastery  = Fracture.mastery[path];
      html += `<div class="fracture-path${mastered ? ' mastered' : ''}">
  <div class="fracture-path-label">${label}${mastered ? `<span class="mastery-badge">✦ MASTERED</span>` : ''}</div>
  <div class="fracture-node-chain">`;
      nodes.forEach((node, i) => {
        const done  = Fracture.researched(node.id);
        const canDo = Fracture.canResearch(node.id);
        const cls   = done ? 'fracture-node done' : canDo ? 'fracture-node available' : 'fracture-node locked';
        html += `<div class="${cls}" data-node="${node.id}">
    <div class="fn-tier">Tier ${node.tier}</div>
    <div class="fn-name">${node.name}</div>
    <div class="fn-desc">${node.desc}</div>
    ${done
      ? `<div class="fn-status done-badge">✓ Resonated</div>`
      : `<div class="fn-cost ${canDo ? '' : 'locked-cost'}">💎 ${node.cost}</div>`}
  </div>`;
        if (i < nodes.length - 1) html += `<div class="fn-arrow">→</div>`;
      });
      html += `</div>`;
      if (mastered) {
        html += `<div class="mastery-bonus-row">✦ ${mastery.name} — ${mastery.desc}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    // -- Shard Investments --------------------------------------------------
    html += `<div class="fracture-section-label">Shard Investments</div>
<div class="shard-invest-list">`;
    for (const inv of Fracture.investments) {
      const done  = Fracture.invested(inv.id);
      const canDo = Fracture.canInvest(inv.id);
      const cls   = done ? 'si-card done' : canDo ? 'si-card available' : 'si-card locked';
      html += `<div class="${cls}" data-inv="${inv.id}">
  <span class="si-icon">${inv.icon}</span>
  <div class="si-main">
    <div class="si-name">${inv.name}</div>
    <div class="si-desc">${inv.desc}</div>
  </div>
  ${done
    ? `<div class="si-done">✓</div>`
    : `<div class="si-cost ${canDo ? '' : 'si-locked'}">💎 ${GameNumbers.formatNumber(inv.cost)}</div>`}
</div>`;
    }
    html += `</div>`;

    el.innerHTML = html;

    // Research clicks
    el.querySelectorAll('.fracture-node.available[data-node]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.node;
        if (Fracture.research(id)) {
          const node = Fracture.nodes.find(n => n.id === id);
          this.toast(`✦ ${node.name} resonated!`);
          this.renderFracture(); this.renderResources();
        }
      });
    });

    // Investment clicks
    el.querySelectorAll('.si-card.available[data-inv]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.inv;
        if (Fracture.invest(id)) {
          const inv = Fracture.investments.find(i => i.id === id);
          this.toast(`${inv.icon} ${inv.name} invested!`);
          this.renderFracture(); this.renderResources();
        }
      });
    });

    this._fractureSig = this._fractureStateSig();
  },

  /** Signature of everything renderFracture bakes into the DOM besides the shard count. */
  _fractureStateSig() {
    let sig = Fracture.riftsSealed() + ':' + Fracture.majorRiftsSealed() + ':' + Fracture.grandRiftsSealed() + ':';
    Fracture.nodes.forEach(n => { sig += Fracture.researched(n.id) ? 'r' : Fracture.canResearch(n.id) ? 'a' : 'l'; });
    Fracture.investments.forEach(i => { sig += Fracture.invested(i.id) ? 'r' : Fracture.canInvest(i.id) ? 'a' : 'l'; });
    return sig;
  },

  /** Lightweight per-frame update: shard counter always; full re-render only
   *  when affordability/rift state changes (mirrors renderBoostersLive). */
  renderFractureLive() {
    if (!window.Fracture) return;
    const el = document.getElementById('sub-fracture');
    if (!el) return;
    const amt = el.querySelector('.shard-amount');
    if (!amt) { this.renderFracture(); return; }
    if (this._fractureStateSig() !== this._fractureSig) { this.renderFracture(); return; }
    amt.textContent = GameNumbers.formatNumber(Game.state.stellarShards || 0);
  },
};

window.UI = UI;
