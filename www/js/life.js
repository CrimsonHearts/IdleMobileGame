/* ===========================================================================
 * life.js — Modern life-sim: Money, Stats, Study (Academy) and Work (Career).
 * A near-future cultivator balances a day job and education alongside training.
 *   • Study raises Talent (faster cultivation), Intellect (better pay) & Charm.
 *   • Work earns Money (modern currency) used across study, dating and family.
 *
 * Round 17 depth: an Elective grid (4 paths × 3 tiers + mastery, unlocked at
 * University) runs alongside the base course ladder; the base ladder and
 * electives share a single `study` slot via a `kind` tag. Work gains a
 * promotion-rank ladder (one-time bonuses) and a permanent Specialization
 * choice at "Expert". Both gain rare active-play skill-check events. All new
 * data tables live in GameData (gameData.js) — see the "Academy & Career
 * depth (Round 17)" section there.
 * ========================================================================= */

const Life = {
  courses: GameData.courses,
  jobs: GameData.jobs,

  s() { return Game.state.life; },
  fresh() {
    return { money: 0, age: 18, ageAcc: 0, intellect: 0, charm: 0, talent: 0,
             education: 0, study: null, jobId: null, jobXp: 0,
             electives: {}, jobRankClaimed: 0, jobSpecialization: null,
             studyEventAcc: 0, workEventAcc: 0 };
  },
  init() {
    if (!Game.state.life) Game.state.life = this.fresh();
    // Backfill each sub-field individually — a `life` object that exists but
    // predates one of these must not silently corrupt downstream math (e.g.
    // jobXp undefined -> jobLevel() NaN -> money accumulates as NaN forever).
    const l = this.s(), defaults = this.fresh();
    for (const k in defaults) if (l[k] === undefined) l[k] = defaults[k];
  },

  // -- Derived --------------------------------------------------------------
  course(id) { return GameData.courses.find(c => c.id === id); },
  job(id) { return GameData.jobs.find(j => j.id === id); },
  currentJob() { return this.s().jobId ? this.job(this.s().jobId) : null; },
  jobLevel() { return Math.min(50, Math.floor(this.s().jobXp / 60)); }, // +1 every 60s worked
  jobPayRate() {
    const j = this.currentJob(); if (!j) return 0;
    const s = this.s();
    const moneyMod = (window.Game && Game.moneyMult) ? Game.moneyMult() : 1; // Pill/Heart Dao + Wealthy trait
    return j.pay * (1 + s.intellect * 0.004) * (1 + this.jobLevel() * 0.1)
      * this.specializationPayMult() * this.electiveBonusMult('pay') * moneyMod;
  },
  /** Talent → cultivation multiplier (read by Game.multipliers). */
  talentMult() { return 1 + (this.s().talent || 0) * 0.01 + this._electiveSum('talent'); },
  /** Elective "Qi Refinement Science" bonus (read by Game.multipliers). */
  qiStudyMult() { return 1 + this._electiveSum('qi'); },
  /** Elective "Arts & Diplomacy" bonus to courtship affinity gain (read by Family). */
  courtshipMult() { return 1 + this._electiveSum('courtship'); },

  nextCourse() { return GameData.courses.find(c => c.eduLevel === this.s().education + 1) || null; },
  isStudying() { return !!this.s().study; },
  studyRemaining() { const st = this.s().study; return st ? Math.max(0, st.endsAt - TimeService.now()) / 1000 : 0; },
  activeStudyItem() {
    const st = this.s().study; if (!st) return null;
    return st.kind === 'elective' ? this.electiveNode(st.id) : this.course(st.id);
  },

  // -- Actions --------------------------------------------------------------
  courseCost(c) {
    const mod = (window.Game && Game.modVal) ? Game.modVal('courseCost') : 1; // Frugal trait
    return Math.ceil(c.cost * mod);
  },
  enroll(id) {
    const c = this.course(id), s = this.s();
    if (!c || this.isStudying()) return false;
    if (c.eduLevel !== s.education + 1) return false;      // must take in order
    const cost = this.courseCost(c);
    if (s.money < cost) return false;
    s.money -= cost;
    s.study = { kind: 'course', id: c.id, endsAt: TimeService.now() + c.dur * 1000 };
    Game.persist();
    return true;
  },
  _completeStudy() {
    if (this.s().study.kind === 'elective') { this._completeElective(); return; }
    const s = this.s(), c = this.course(s.study.id);
    const tg = 1 + ((window.Game && Game.modVal) ? Game.modVal('talentGain') : 0); // Prodigy trait
    const talentGain = Math.round((c.grants.talent || 0) * tg);
    s.education = c.eduLevel;
    s.intellect += c.grants.intellect || 0;
    s.talent    += talentGain;
    s.charm     += c.grants.charm || 0;
    s.study = null;
    if (window.UI) UI.toast(`🎓 Graduated: ${c.name}! +${talentGain} Talent, +${c.grants.intellect} Intellect`);
    Game.persist();
  },

  // -- Electives (Round 17) --------------------------------------------------
  electiveNode(id) { return GameData.electiveNodes.find(n => n.id === id); },
  electivesUnlocked() { return this.s().education >= GameData.study.electiveMinEdu; },
  electiveDone(id) { return !!this.s().electives[id]; },
  electivePrereqMet(node) {
    if (node.tier === 1) return true;
    const prev = GameData.electiveNodes.find(n => n.path === node.path && n.tier === node.tier - 1);
    return prev ? this.electiveDone(prev.id) : false;
  },
  electivePathMastered(path) {
    const nodes = GameData.electiveNodes.filter(n => n.path === path);
    return nodes.length > 0 && nodes.every(n => this.electiveDone(n.id));
  },
  /** Sums a bonus key across completed elective tiers and mastered paths
   *  (mirrors Fracture._sum). Used by talentMult/qiStudyMult/jobPayRate/courtshipMult. */
  _electiveSum(key) {
    let total = 0;
    for (const n of GameData.electiveNodes) if (this.electiveDone(n.id) && n.bonus[key]) total += n.bonus[key];
    for (const path in GameData.electiveMastery) {
      if (this.electivePathMastered(path) && GameData.electiveMastery[path].bonus[key]) total += GameData.electiveMastery[path].bonus[key];
    }
    return total;
  },
  electiveBonusMult(key) { return 1 + this._electiveSum(key); },
  canEnrollElective(id) {
    const node = this.electiveNode(id);
    if (!node || this.isStudying() || !this.electivesUnlocked()) return false;
    if (this.electiveDone(id) || !this.electivePrereqMet(node)) return false;
    return this.s().money >= this.courseCost(node);
  },
  enrollElective(id) {
    if (!this.canEnrollElective(id)) return false;
    const node = this.electiveNode(id), s = this.s();
    s.money -= this.courseCost(node);
    s.study = { kind: 'elective', id: node.id, endsAt: TimeService.now() + node.dur * 1000 };
    Game.persist();
    return true;
  },
  _completeElective() {
    const s = this.s(), node = this.electiveNode(s.study.id);
    const tg = 1 + ((window.Game && Game.modVal) ? Game.modVal('talentGain') : 0);
    s.electives[node.id] = true;
    s.intellect += node.grants.intellect || 0;
    s.talent    += Math.round((node.grants.talent || 0) * tg);
    s.charm     += node.grants.charm || 0;
    s.study = null;
    const mastered = this.electivePathMastered(node.path);
    if (window.UI) {
      let msg = `📘 ${node.name} complete!`;
      if (mastered) msg += ` 🏆 ${GameData.electiveMastery[node.path].name} — ${GameData.electivePathLabels[node.path]} mastered!`;
      UI.toast(msg);
    }
    Game.persist();
  },

  // -- Work: job, ranks & specialization (Round 17 adds ranks/specialization) -
  takeJob(id) {
    const j = this.job(id), s = this.s();
    if (!j || s.education < j.reqEdu) return false;
    if (s.jobId !== id) { s.jobId = id; s.jobXp = 0; s.jobRankClaimed = 0; s.jobSpecialization = null; }
    Game.persist();
    return true;
  },
  quitJob() {
    const s = this.s();
    s.jobId = null; s.jobXp = 0; s.jobRankClaimed = 0; s.jobSpecialization = null;
    Game.persist();
  },
  jobRankTitle() { return GameData.jobRanks[this.s().jobRankClaimed || 0].title; },
  jobRankInfo() { return GameData.jobRanks[this.s().jobRankClaimed || 0]; },
  nextJobRank() { return GameData.jobRanks[(this.s().jobRankClaimed || 0) + 1] || null; },
  /** Catches up every rank threshold crossed since the last check (in one pass,
   *  so an offline jobXp jump — see Game.applyOffline — never skips a promotion). */
  _checkJobRank() {
    const s = this.s(), ranks = GameData.jobRanks;
    const lvl = this.jobLevel();
    let claimed = s.jobRankClaimed || 0, totalBonus = 0, lastTitle = null;
    while (claimed + 1 < ranks.length && lvl >= ranks[claimed + 1].atLevel) {
      claimed++;
      const r = ranks[claimed];
      if (r.bonusPaySeconds) totalBonus += this.jobPayRate() * r.bonusPaySeconds;
      lastTitle = r.title;
    }
    if (claimed !== (s.jobRankClaimed || 0)) {
      s.jobRankClaimed = claimed;
      if (totalBonus) s.money += totalBonus;
      if (window.UI && lastTitle) {
        UI.toast(`⬆ Promoted to ${lastTitle}!` + (totalBonus ? ` +¥${GameNumbers.formatNumber(totalBonus)}` : ''));
      }
      Game.persist();
    }
  },
  _specializationRankIndex() { return GameData.jobRanks.findIndex(r => r.unlocksSpecialization); },
  canChooseSpecialization() {
    const s = this.s();
    return !!s.jobId && !s.jobSpecialization && (s.jobRankClaimed || 0) >= this._specializationRankIndex();
  },
  chooseSpecialization(id) {
    if (!this.canChooseSpecialization()) return false;
    const spec = GameData.jobSpecializations.find(x => x.id === id);
    if (!spec) return false;
    const s = this.s();
    s.jobSpecialization = id;
    if (spec.bonusCharm) s.charm += spec.bonusCharm;
    if (window.UI) UI.toast(`🤝 Specialization chosen: ${spec.name}!`);
    Game.persist();
    return true;
  },
  specializationPayMult() {
    const s = this.s();
    if (!s.jobSpecialization) return 1;
    const spec = GameData.jobSpecializations.find(x => x.id === s.jobSpecialization);
    return spec ? 1 + (spec.payMult || 0) : 1;
  },

  // -- Active-play events (Round 17) ------------------------------------------
  /** Rolls a "risk" option's successChance and returns which branch fired;
   *  a "safe" option (no successChance) always applies its own effects. */
  resolveLifeSkillEvent(kind, eventId, optIndex) {
    const pool = kind === 'study' ? GameData.studyEvents : GameData.workEvents;
    const ev = pool.find(e => e.id === eventId);
    const opt = ev && ev.options[optIndex];
    if (!opt) return null;
    let outcome, won = null;
    if (opt.successChance !== undefined) {
      won = Math.random() < opt.successChance;
      outcome = won ? opt.success : opt.fail;
    } else {
      outcome = opt;
    }
    Game.applyEventEffects(outcome.effects);
    Game.persist();
    return { event: ev, option: opt, won, outcome };
  },
  _tryTriggerEvent(kind) {
    if (!window.UI || (UI._modalOpen && UI._modalOpen())) return;
    const pool = kind === 'study' ? GameData.studyEvents : GameData.workEvents;
    const ev = pool[Math.floor(Math.random() * pool.length)];
    if (!ev || !UI.showLifeSkillEvent) return;
    UI.showLifeSkillEvent(kind, ev);
  },

  // -- Tick -----------------------------------------------------------------
  tick(dt) {
    const s = this.s();
    if (s.jobId) {
      s.money += this.jobPayRate() * dt; s.jobXp += dt;
      this._checkJobRank();
      s.workEventAcc = (s.workEventAcc || 0) + dt;
      if (s.workEventAcc >= GameData.work.eventEverySec) {
        s.workEventAcc = 0;
        if (Math.random() < GameData.work.eventChance) this._tryTriggerEvent('work');
      }
    }
    if (s.study) {
      if (TimeService.now() >= s.study.endsAt) {
        this._completeStudy();
      } else {
        s.studyEventAcc = (s.studyEventAcc || 0) + dt;
        if (s.studyEventAcc >= GameData.study.eventEverySec) {
          s.studyEventAcc = 0;
          if (Math.random() < GameData.study.eventChance) this._tryTriggerEvent('study');
        }
      }
    }
    // Aging: GameData.aging.secondsPerYear of play = 1 year. Lifespan is real:
    // outlive your realm's limit and the bloodline continues through an heir.
    const spy = GameData.aging.secondsPerYear;
    s.ageAcc += dt;
    if (s.ageAcc >= spy) {
      s.ageAcc -= spy; s.age += 1;
      if (window.Family) {
        const stageEvents = Family.ageUp();
        if (stageEvents && window.UI) stageEvents.forEach(msg => UI.toast(msg));
      }
      if (Game.isDying() && window.UI) UI.showDeathModal();
    }
  },

  // ======================================================================
  // RENDER — Study tab
  // ======================================================================
  renderStudy(el) {
    const s = this.s();
    const next = this.nextCourse();
    let body = `
      <div class="section-title">Academy</div>
      <div class="stat-row">
        <div class="stat"><span class="stat-v">${s.education}</span><span class="stat-k">Education Lv</span></div>
        <div class="stat"><span class="stat-v">${GameNumbers.formatNumber(s.talent)}</span><span class="stat-k">Talent</span></div>
        <div class="stat"><span class="stat-v">${GameNumbers.formatNumber(s.intellect)}</span><span class="stat-k">Intellect</span></div>
        <div class="stat"><span class="stat-v">${GameNumbers.formatNumber(s.charm)}</span><span class="stat-k">Charm</span></div>
      </div>
      <div class="hint">Talent boosts cultivation speed (+1% each). Intellect raises your salary. Charm helps in romance.</div>`;

    if (this.isStudying()) {
      const item = this.activeStudyItem();
      const isElective = s.study.kind === 'elective';
      const total = item.dur, left = this.studyRemaining();
      body += `<div class="card studying">
        <div class="card-title">${isElective ? item.icon : '📖'} Studying: ${item.name}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${((1-left/total)*100).toFixed(1)}%"></div></div>
        <div class="hint">${GameNumbers.formatDuration(left)} remaining</div></div>`;
    } else if (next) {
      const price = this.courseCost(next);
      const afford = s.money >= price;
      body += `<div class="card">
        <div class="card-title">Next: ${next.name}</div>
        <div class="hint">Grants +${next.grants.talent} Talent · +${next.grants.intellect} Intellect · +${next.grants.charm} Charm</div>
        <div class="row-between"><span class="price">${price ? '¥'+GameNumbers.formatNumber(price) : 'Free'}</span>
          <span class="muted">${GameNumbers.formatDuration(next.dur)}</span></div>
        <button class="btn-primary" id="enroll-btn" ${afford?'':'disabled'}>Enroll</button></div>`;
    } else {
      body += `<div class="card"><div class="card-title">🎓 Fully Educated</div><div class="hint">You have completed the highest course available.</div></div>`;
    }

    if (this.electivesUnlocked()) {
      body += `<div class="section-title small">Electives</div>
      <div class="hint">Master a full path (all 3 tiers) for a permanent capstone bonus.</div>
      <div class="elective-grid">`;
      const paths = Object.keys(GameData.electivePathLabels);
      paths.forEach(path => {
        const nodes = GameData.electiveNodes.filter(n => n.path === path).sort((a, b) => a.tier - b.tier);
        const mastered = this.electivePathMastered(path);
        const mastery = GameData.electiveMastery[path];
        body += `<div class="elective-path${mastered ? ' mastered' : ''}">
          <div class="ep-header">${nodes[0].icon} ${GameData.electivePathLabels[path]}${mastered ? `<span class="mastery-badge">✦ MASTERED</span>` : ''}</div>
          <div class="ep-tiers">`;
        nodes.forEach(node => {
          const done = this.electiveDone(node.id);
          const canDo = this.canEnrollElective(node.id);
          const cls = done ? 'ep-tier done' : canDo ? 'ep-tier available' : 'ep-tier locked';
          body += `<div class="${cls}" data-elective="${node.id}">
            <div class="ept-name">${node.name}</div>
            ${done ? `<div class="ept-status">✓ Done</div>` : `<div class="ept-cost">¥${GameNumbers.formatNumber(node.cost)}</div>`}
          </div>`;
        });
        body += `</div>`;
        if (mastered) body += `<div class="ep-mastery-row">✦ ${mastery.name} — ${mastery.desc}</div>`;
        body += `</div>`;
      });
      body += `</div>`;
    }

    el.innerHTML = body;
    const eb = el.querySelector('#enroll-btn');
    if (eb) eb.addEventListener('click', () => { if (this.enroll(next.id)) { this.renderStudy(el); UI.renderResources(); } });
    el.querySelectorAll('.ep-tier.available[data-elective]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.elective;
        if (this.enrollElective(id)) { this.renderStudy(el); UI.renderResources(); }
      });
    });
  },

  // ======================================================================
  // RENDER — Work tab
  // ======================================================================
  renderWork(el) {
    const s = this.s();
    const cur = this.currentJob();
    let body = `<div class="section-title">Career</div>`;
    if (cur) {
      const rank = this.jobRankInfo(), nextRank = this.nextJobRank();
      body += `<div class="card job-current">
        <div class="card-title">${cur.icon} ${cur.name} <span class="job-rank-title">· ${rank.title}</span></div>
        <div class="row-between"><span>Level ${this.jobLevel()}</span><span class="price">¥${GameNumbers.formatNumber(this.jobPayRate())}/s</span></div>
        <div class="hint">Experience grows your pay (+10% per level). Intellect adds +${(s.intellect*0.4).toFixed(0)}% bonus.${nextRank ? ` Next promotion (${nextRank.title}) at level ${nextRank.atLevel}.` : ' Highest rank reached.'}</div>
      </div>`;

      if (this.canChooseSpecialization()) {
        body += `<div class="section-title small">Choose a Specialization</div>
        <div class="hint">A permanent choice for this career — pick one.</div>
        <div id="spec-list"></div>`;
      } else if (s.jobSpecialization) {
        const spec = GameData.jobSpecializations.find(x => x.id === s.jobSpecialization);
        body += `<div class="card"><div class="card-title">${spec.icon} ${spec.name}</div><div class="hint">${spec.desc}</div></div>`;
      }
    } else {
      body += `<div class="hint">You are unemployed. Take a job to earn ¥ (money). Better education unlocks better careers.</div>`;
    }
    body += `<div class="section-title small">Available Jobs</div><div id="job-list"></div>`;
    el.innerHTML = body;

    const specList = el.querySelector('#spec-list');
    if (specList) {
      GameData.jobSpecializations.forEach(spec => {
        const card = document.createElement('div');
        card.className = 'list-item';
        card.innerHTML = `
          <span class="li-icon">${spec.icon}</span>
          <span class="li-main"><span class="li-name">${spec.name}</span><span class="li-sub">${spec.desc}</span></span>
          <button class="btn-mini">Choose</button>`;
        card.querySelector('button').addEventListener('click', () => { this.chooseSpecialization(spec.id); this.renderWork(el); });
        specList.appendChild(card);
      });
    }

    const list = el.querySelector('#job-list');
    GameData.jobs.forEach(j => {
      const unlocked = s.education >= j.reqEdu;
      const active = s.jobId === j.id;
      const card = document.createElement('div');
      card.className = 'list-item' + (active ? ' active' : '') + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <span class="li-icon">${j.icon}</span>
        <span class="li-main"><span class="li-name">${j.name}</span>
          <span class="li-sub">${unlocked ? '¥'+GameNumbers.formatNumber(j.pay)+'/s base' : 'Requires Education Lv '+j.reqEdu}</span></span>
        <button class="btn-mini" ${unlocked&&!active?'':'disabled'}>${active?'Working':(unlocked?'Take':'🔒')}</button>`;
      if (unlocked && !active) card.querySelector('button').addEventListener('click', () => { this.takeJob(j.id); this.renderWork(el); });
      list.appendChild(card);
    });
  },
};

window.Life = Life;
