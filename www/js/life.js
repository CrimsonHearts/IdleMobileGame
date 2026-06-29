/* ===========================================================================
 * life.js — Modern life-sim: Money, Stats, Study (Academy) and Work (Career).
 * A near-future cultivator balances a day job and education alongside training.
 *   • Study raises Talent (faster cultivation), Intellect (better pay) & Charm.
 *   • Work earns Money (modern currency) used across study, dating and family.
 * ========================================================================= */

const COURSES = [
  { id: 'self',     name: 'Self-Study Basics',   eduLevel: 1, cost: 0,      dur: 30,  grants: { intellect: 5,   talent: 2,   charm: 1 } },
  { id: 'high',     name: 'High School Diploma',  eduLevel: 2, cost: 500,    dur: 75,  grants: { intellect: 15,  talent: 6,   charm: 5 } },
  { id: 'uni',      name: 'University Degree',     eduLevel: 3, cost: 8000,   dur: 150, grants: { intellect: 45,  talent: 18,  charm: 10 } },
  { id: 'dao',      name: 'Dao Cultivation Academy', eduLevel: 4, cost: 90000, dur: 300, grants: { intellect: 90, talent: 60, charm: 18 } },
  { id: 'immortal', name: 'Immortal Institute',    eduLevel: 5, cost: 1.2e6,  dur: 600, grants: { intellect: 180, talent: 150, charm: 35 } },
];

const JOBS = [
  { id: 'courier',   name: 'Spirit Courier',       reqEdu: 0, pay: 2,     icon: '🛵' },
  { id: 'clerk',     name: 'Corp Office Clerk',     reqEdu: 2, pay: 18,    icon: '💼' },
  { id: 'engineer',  name: 'Qi-Tech Engineer',      reqEdu: 3, pay: 140,   icon: '🔧' },
  { id: 'alchemist', name: 'Licensed Alchemist',    reqEdu: 4, pay: 1300,  icon: '⚗️' },
  { id: 'exec',      name: 'Corporate Cultivator',  reqEdu: 5, pay: 12000, icon: '🏢' },
];

const Life = {
  courses: COURSES,
  jobs: JOBS,

  s() { return Game.state.life; },
  fresh() {
    return { money: 0, age: 18, ageAcc: 0, intellect: 0, charm: 0, talent: 0,
             education: 0, study: null, jobId: null, jobXp: 0 };
  },
  init() { if (!Game.state.life) Game.state.life = this.fresh(); },

  // -- Derived --------------------------------------------------------------
  course(id) { return COURSES.find(c => c.id === id); },
  job(id) { return JOBS.find(j => j.id === id); },
  currentJob() { return this.s().jobId ? this.job(this.s().jobId) : null; },
  jobLevel() { return Math.min(50, Math.floor(this.s().jobXp / 60)); }, // +1 every 60s worked
  jobPayRate() {
    const j = this.currentJob(); if (!j) return 0;
    const s = this.s();
    const moneyMod = (window.Game && Game.moneyMult) ? Game.moneyMult() : 1; // Pill/Heart Dao + Wealthy trait
    return j.pay * (1 + s.intellect * 0.004) * (1 + this.jobLevel() * 0.1) * moneyMod;
  },
  /** Talent → cultivation multiplier (read by Game.multipliers). */
  talentMult() { return 1 + (this.s().talent || 0) * 0.01; },

  nextCourse() { return COURSES.find(c => c.eduLevel === this.s().education + 1) || null; },
  isStudying() { return !!this.s().study; },
  studyRemaining() { const st = this.s().study; return st ? Math.max(0, st.endsAt - TimeService.now()) / 1000 : 0; },

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
    s.study = { id: c.id, endsAt: TimeService.now() + c.dur * 1000 };
    Game.persist();
    return true;
  },
  _completeStudy() {
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

  takeJob(id) {
    const j = this.job(id), s = this.s();
    if (!j || s.education < j.reqEdu) return false;
    if (s.jobId !== id) { s.jobId = id; s.jobXp = 0; }
    Game.persist();
    return true;
  },
  quitJob() { this.s().jobId = null; this.s().jobXp = 0; Game.persist(); },

  // -- Tick -----------------------------------------------------------------
  tick(dt) {
    const s = this.s();
    if (s.jobId) { s.money += this.jobPayRate() * dt; s.jobXp += dt; }
    if (s.study && TimeService.now() >= s.study.endsAt) this._completeStudy();
    // Aging: GameData.aging.secondsPerYear of play = 1 year. Lifespan is real:
    // outlive your realm's limit and the bloodline continues through an heir.
    const spy = GameData.aging.secondsPerYear;
    s.ageAcc += dt;
    if (s.ageAcc >= spy) {
      s.ageAcc -= spy; s.age += 1;
      if (window.Family) Family.ageUp();
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
      const c = this.course(s.study.id);
      const total = c.dur, left = this.studyRemaining();
      body += `<div class="card studying">
        <div class="card-title">📖 Studying: ${c.name}</div>
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
    el.innerHTML = body;
    const eb = el.querySelector('#enroll-btn');
    if (eb) eb.addEventListener('click', () => { if (this.enroll(next.id)) { this.renderStudy(el); UI.renderResources(); } });
  },

  // ======================================================================
  // RENDER — Work tab
  // ======================================================================
  renderWork(el) {
    const s = this.s();
    const cur = this.currentJob();
    let body = `<div class="section-title">Career</div>`;
    if (cur) {
      body += `<div class="card job-current">
        <div class="card-title">${cur.icon} ${cur.name}</div>
        <div class="row-between"><span>Level ${this.jobLevel()}</span><span class="price">¥${GameNumbers.formatNumber(this.jobPayRate())}/s</span></div>
        <div class="hint">Experience grows your pay (+10% per level). Intellect adds +${(s.intellect*0.4).toFixed(0)}% bonus.</div>
      </div>`;
    } else {
      body += `<div class="hint">You are unemployed. Take a job to earn ¥ (money). Better education unlocks better careers.</div>`;
    }
    body += `<div class="section-title small">Available Jobs</div><div id="job-list"></div>`;
    el.innerHTML = body;
    const list = el.querySelector('#job-list');
    JOBS.forEach(j => {
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
