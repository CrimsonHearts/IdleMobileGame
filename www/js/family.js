/* ===========================================================================
 * family.js — Romance & Family (Round 15: deepened).
 *   • Meet candidates, build Affinity by chatting / dating / gifting (Charm + ¥).
 *     Courtship has stakes: fall behind on a candidate you've invested in and
 *     a rival may sweep them away; affinity milestones open branching scenes.
 *   • Marry your chosen partner — marriage keeps growing via a Bond stat built
 *     by spending time together and rare spousal events. Bond deepens the
 *     household bonus. Marriages can rarely end (estrangement or a peaceful
 *     passing), reopening courtship.
 *   • Raise children who inherit a Spiritual Root from their parents. Children
 *     grow through life stages (Infant → Child → Youth → Adult); once Youth+
 *     they can pursue a path (Cultivation / Scholar / Merchant / Martial) and
 *     become heir-eligible. Tutor them so the heir starts life ahead.
 * ========================================================================= */

const FIRST_NAMES = ['Lin','Mu','Bai','Ye','Su','Yun','Han','Xia','Jiang','Wen','Qin','Lu','An','Shen','Tang','Rou','Xue','Chen'];
const LAST_NAMES  = ['Wan','Yu','Chen','Feng','Qing','Hong','Lan','Jian','Mo','Xing','Yao','Ruo','Zhi','Ke','Ning'];
const PROFESSIONS = ['Doctor','Pilot','Artist','Engineer','Alchemist','Swordmaster','Scholar','Investor','Musician','Talisman Artist'];
const TRAITS      = ['Gentle','Ambitious','Witty','Loyal','Mysterious','Cheerful','Diligent','Proud','Kind'];

// -- Story flavour ----------------------------------------------------------
const ENCOUNTERS = [
  'You met at the night market, both reaching for the last moonpetal herb.',
  'Their flying sword nearly clipped you above the neon rooftops — an apology became a conversation.',
  'You shared a table when the teahouse flooded with rain, and talked until dawn.',
  'They pulled you from a collapsing cultivation chamber without a second thought.',
  'You crossed blades in a sect tournament; neither could forget the other.',
  'A fortune-teller pressed your palms together and simply smiled.',
  'You both reached for the same forbidden manual in the silent library.',
  'Their spirit beast took a liking to you long before they did.',
];
const BACKSTORIES = [
  'They carry a quiet grief from a sect that no longer exists.',
  'Heir to an old bloodline, they seek a partner the elders cannot choose for them.',
  'They fled an arranged match with a demonic clan and never looked back.',
  'A prodigy who hides their true cultivation behind an easy smile.',
  'They guard a secret said to shake the very heavens.',
  'Once betrayed in love, they are slow to trust but fierce when they do.',
  'They wander the realms collecting songs, recipes, and broken hearts to mend.',
  'Rumour says a celestial owes them a favour.',
];
const DESTINED_ENCOUNTERS = [
  'The heavens themselves seemed to arrange this meeting — the air shivered with fate as your eyes met.',
  'A vision led you here; you knew their face before you ever saw it.',
  'Threads of red destiny coil between you, visible only to those who have touched the Dao.',
  'Starlight bent around them as they turned to you, as if the firmament approved.',
];
const CHILD_MARRIAGE_FLAVOR = [
  'A matchmaker from a respected house came calling, and the match was too good to refuse.',
  'They met at a sect gathering and the elders needed little convincing.',
  'A family debt of honor, repaid in the oldest currency — a good marriage.',
  'Neither planned it, but the tea ceremony went well and nobody objected.',
];

const MAX_CHILDREN = 6;
const CHILD_MARRIAGE_COST = 2500;
const CHILD_MARRIAGE_BOND = 0.02; // household bonus per married child
const SPOUSAL_EVENT_EVERY_SEC = 300;   // ~5 min of married play between checks
const SPOUSAL_EVENT_CHANCE    = 0.35;
const WIDOW_EVENT_MIN_AGE_MARRIED = 8; // years married before it can even roll
const WIDOW_EVENT_CHANCE_PER_CHECK = 0.04;
const RIVAL_DECAY_PER_SEC     = 0.02;  // non-primary affinity decay once a primary exists
const RIVAL_DEPARTURE_CHANCE_PER_SEC = 0.02; // once at 0 affinity, chance/sec they leave for good
const PRIMARY_AFFINITY_THRESHOLD = 50;

const Family = {
  s() { return Game.state.family; },
  fresh() {
    return { candidates: [], spouse: null, children: [], childCooldown: 0,
             primaryCandidateId: null, spousalEventAcc: 0 };
  },
  init() {
    if (!Game.state.family) Game.state.family = this.fresh();
    // Backfill each sub-field individually — a `family` object that exists
    // but predates one of these (or was otherwise partially shaped) must not
    // crash init(); an unguarded `.candidates.length` here previously threw
    // and triggered the top-level save-wipe fallback in main.js.
    const f = this.s();
    if (!Array.isArray(f.candidates)) f.candidates = [];
    if (f.spouse === undefined) f.spouse = null;
    if (!Array.isArray(f.children)) f.children = [];
    if (f.childCooldown === undefined) f.childCooldown = 0;
    if (f.primaryCandidateId === undefined) f.primaryCandidateId = null;
    if (f.spousalEventAcc === undefined) f.spousalEventAcc = 0;
    // Backfill Round-15 fields on saves from before this round.
    if (f.spouse) {
      if (f.spouse.bond === undefined) f.spouse.bond = 0;
      if (f.spouse.marriedAtAge === undefined) f.spouse.marriedAtAge = Game.state.life ? Game.state.life.age : 18;
    }
    f.children.forEach(c => {
      if (c.path === undefined) c.path = null;
      if (c.lastStage === undefined) c.lastStage = this.stageOf(c.age).key;
      if (c.spouse === undefined) c.spouse = null;
    });
    f.candidates.forEach(c => { if (!Array.isArray(c.milestonesSeen)) c.milestonesSeen = []; });
    if (!f.candidates.length && !f.spouse) this._seed();
  },

  _name() { return FIRST_NAMES[Math.floor(Math.random()*FIRST_NAMES.length)] + ' ' + LAST_NAMES[Math.floor(Math.random()*LAST_NAMES.length)]; },
  _pick(a) { return a[Math.floor(Math.random()*a.length)]; },
  /** Roll n distinct gameplay trait ids from GameData.traits. */
  _rollTraits(n) {
    const pool = GameData.traits.map(t => t.id);
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random()*pool.length), 1)[0]);
    return out;
  },
  traitName(id) { const t = GameData.traits.find(x => x.id === id); return t ? t.name : id; },
  /** Small inline trait chips with tooltips. */
  _traitChips(ids) {
    if (!ids || !ids.length) return '';
    return '<div class="trait-row">' + ids.map(id => {
      const t = GameData.traits.find(x => x.id === id);
      return t ? `<span class="trait-chip" title="${t.desc}">${t.icon} ${t.name}</span>` : '';
    }).join('') + '</div>';
  },

  /** Build one candidate. rootMode feeds GameData.rollSpiritualRoot; destined = rare ad-unlock. */
  _makeCandidate(rootMode, charmMin, destined) {
    const root = GameData.rollSpiritualRoot(rootMode || 'free');
    const cmin = charmMin || 20;
    const encounter = destined ? this._pick(DESTINED_ENCOUNTERS) : this._pick(ENCOUNTERS);
    return {
      id: 'c' + Date.now() + '_' + Math.floor(Math.random()*1e6),
      name: this._name(),
      gender: Math.random() < 0.5 ? 'female' : 'male',
      root,
      charm: cmin + Math.floor(Math.random() * (100 - cmin)),
      profession: this._pick(PROFESSIONS),
      trait: this._pick(TRAITS),          // personality flavour text
      traits: this._rollTraits(destined ? 2 : (Math.random() < 0.5 ? 2 : 1)), // gameplay trait ids
      affinity: 0,
      destined: !!destined,
      story: encounter + ' ' + this._pick(BACKSTORIES),
      milestonesSeen: [],
    };
  },

  _seed() {
    const list = [];
    for (let i = 0; i < 4; i++) list.push(this._makeCandidate('free', 20, false));
    // Karma draws a like-minded soul: the righteous attract a virtuous immortal,
    // the demonic attract an alluring devil. Only one appears, at the top.
    const tier = (window.Game && Game.karmaTier) ? Game.karmaTier() : 'neutral';
    if (tier === 'righteous') {
      const c = this._makeCandidate('min_heaven', 65, false);
      c.name = 'Fairy ' + c.name.split(' ')[0];
      c.profession = 'Immortal Disciple'; c.trait = 'Virtuous';
      c.traits = ['spiritual', 'ironwill'];
      list.unshift(c);
    } else if (tier === 'demonic') {
      const c = this._makeCandidate('min_heaven', 65, false);
      c.name = 'Devil ' + c.name.split(' ')[0];
      c.profession = 'Demon Cultivator'; c.trait = 'Seductive';
      c.traits = ['warlike', 'lucky'];
      list.unshift(c);
    }
    this.s().candidates = list;
    this.s().primaryCandidateId = null;
  },
  refreshCandidates() { this._seed(); Game.persist(); },

  /** Rewarded-ad: meet a rare, high-tier "destined" partner (Heaven root or better). */
  async meetDestined() {
    const ok = window.Monetization ? await Monetization.showRewardedAd('meet_destined') : true;
    if (!ok) return null;
    const c = this._makeCandidate('min_heaven', 70, true);
    this.s().candidates.unshift(c); // show at the top
    Game.persist();
    return c;
  },

  // -- Bonuses (read by Game.multipliers) ----------------------------------
  /** Household cultivation multiplier: spouse (base + bond) + children (base + cultivation-path + married-in-laws). */
  familyMult() {
    const s = this.s();
    let m = 1;
    if (s.spouse) {
      m += 0.10 + (s.spouse.root.mult - 1) * 0.05; // partner shares dao
      m += this.spouseBondBonus();                 // deepens as the marriage grows
    }
    m += s.children.length * 0.05;
    m += this.childCultivationBonus();
    m += this.childMarriageBonus();
    return m;
  },
  /** +0 to +0.15 as spouse bond climbs from 0 to 100. */
  spouseBondBonus() {
    const s = this.s();
    if (!s.spouse) return 0;
    return Math.min(100, s.spouse.bond || 0) / 100 * 0.15;
  },
  /** Sum of +3% per child on the Cultivation path. */
  childCultivationBonus() {
    return this.s().children.reduce((sum, c) => sum + (c.path === 'cultivation' ? 0.03 : 0), 0);
  },
  /** Combat bonus from children on the Martial path (read by Combat). */
  combatBonus() {
    return this.s().children.reduce((sum, c) => sum + (c.path === 'martial' ? 0.04 : 0), 0);
  },
  /** Sum of a small bonus per married child — new in-laws strengthen the house. */
  childMarriageBonus() {
    return this.s().children.reduce((sum, c) => sum + (c.spouse ? CHILD_MARRIAGE_BOND : 0), 0);
  },

  // -- Romance actions ------------------------------------------------------
  _gain(cand, base) {
    const charm = (Game.state.life && Game.state.life.charm) || 0;
    const charmMod = window.Game && Game.modVal ? Game.modVal('charm') : 1;
    // Elective "Arts & Diplomacy" path (Round 17): boosts affinity-gain rate.
    const lifeMod = window.Life && Life.courtshipMult ? Life.courtshipMult() : 1;
    cand.affinity = Math.min(100, cand.affinity + base * (1 + charm * 0.01) * charmMod * lifeMod);
    this._updatePrimary(cand);
    this._tryCourtshipScene(cand);
  },
  /** Once a candidate crosses the primary threshold, they become the one
   *  you're "seriously seeing" — the others start losing ground if ignored. */
  _updatePrimary(cand) {
    const s = this.s();
    if (cand.affinity >= PRIMARY_AFFINITY_THRESHOLD && s.primaryCandidateId !== cand.id) {
      s.primaryCandidateId = cand.id;
    }
  },
  chat(id) {
    const c = this._find(id);
    if (c && !(c.chatCooldown > 0)) { this._gain(c, 4); c.chatCooldown = 8; Game.persist(); }
    return c;
  },
  date(id) { const c = this._find(id); if (c && Life.s().money >= 200) { Life.s().money -= 200; this._gain(c, 14); Game.persist(); } return c; },
  gift(id) { const c = this._find(id); if (c && Life.s().money >= 1000) { Life.s().money -= 1000; this._gain(c, 30); Game.persist(); } return c; },
  _find(id) { return this.s().candidates.find(c => c.id === id); },
  isPrimary(id) { return this.s().primaryCandidateId === id; },

  marry(id) {
    const c = this._find(id);
    if (!c || c.affinity < 100 || this.s().spouse) return false;
    c.bond = 0;
    c.marriedAtAge = Game.state.life ? Game.state.life.age : 18;
    this.s().spouse = c;
    this.s().candidates = [];
    this.s().primaryCandidateId = null;
    Game.persist();
    return true;
  },

  // -- Marriage depth: bond, spousal events, widowhood ----------------------
  yearsMarried() {
    const s = this.s();
    if (!s.spouse || !Game.state.life) return 0;
    return Math.max(0, Game.state.life.age - (s.spouse.marriedAtAge || Game.state.life.age));
  },
  canSpendTimeWithSpouse() {
    const s = this.s();
    return !!s.spouse && !(s.spouse.timeCooldown > 0);
  },
  /** Deepen the bond directly — the married-life counterpart to chat/date/gift. */
  spendTimeWithSpouse() {
    if (!this.canSpendTimeWithSpouse()) return false;
    const sp = this.s().spouse;
    sp.bond = Math.min(100, (sp.bond || 0) + 6);
    sp.timeCooldown = 10;
    Game.persist();
    return true;
  },

  _activeSpousalEvent: null,
  _trySpousalEvent() {
    const s = this.s();
    if (!s.spouse || this._activeSpousalEvent) return null;
    const pool = GameData.spousalEvents.filter(e => (e.bondMin || 0) <= (s.spouse.bond || 0));
    if (!pool.length) return null;
    const ev = pool[Math.floor(Math.random() * pool.length)];
    this._activeSpousalEvent = ev;
    return ev;
  },
  resolveSpousalEvent(ev, optIndex) {
    const opt = ev.options[optIndex];
    const s = this.s();
    if (!opt || !s.spouse) return { ok: false };
    if (opt.cost && opt.cost.money) {
      if (!Game.state.life || Game.state.life.money < opt.cost.money) return { ok: false, reason: 'cost' };
      Game.state.life.money -= opt.cost.money;
    }
    s.spouse.bond = Math.min(100, (s.spouse.bond || 0) + (opt.bond || 0));
    if (opt.effects && opt.effects.qiPct && window.Game) {
      // A small one-off Qi gift worth roughly qiPct × 10 minutes of current production.
      Game._addQi(Game.qiPerSecond() * 600 * opt.effects.qiPct);
    }
    this._activeSpousalEvent = null;
    Game.persist();
    return { ok: true, toast: (opt.toast || '').replace('{spouse}', s.spouse.name) };
  },

  /** Rare: a marriage can end. Rolls only after WIDOW_EVENT_MIN_AGE_MARRIED
   *  years married; returns the flavor text (does NOT itself clear spouse —
   *  call endMarriage() after the player has seen the notice). */
  _tryWidowRoll() {
    const s = this.s();
    if (!s.spouse) return null;
    if (this.yearsMarried() < WIDOW_EVENT_MIN_AGE_MARRIED) return null;
    if (Math.random() > WIDOW_EVENT_CHANCE_PER_CHECK) return null;
    const highBond = (s.spouse.bond || 0) >= 60;
    return {
      title: GameData.widowEvent.title,
      text: (highBond ? GameData.widowEvent.highBondText : GameData.widowEvent.lowBondText).replace('{spouse}', s.spouse.name),
      spouseName: s.spouse.name,
    };
  },
  endMarriage() {
    const s = this.s();
    if (!s.spouse) return;
    s.spouse = null;
    s.candidates = [];
    s.primaryCandidateId = null;
    this._seed();
    Game.persist();
  },

  // -- Children -------------------------------------------------------------
  canHaveChild() {
    const s = this.s();
    return !!s.spouse && s.children.length < MAX_CHILDREN && s.childCooldown <= 0 && (Game.state.life.money >= 2000);
  },
  haveChild() {
    if (!this.canHaveChild()) return null;
    const s = this.s();
    Game.state.life.money -= 2000;
    // Inherit the better parental root, with a chance to ascend a tier.
    const roots = GameData.spiritualRoots;
    const pIdx = roots.findIndex(r => r.key === Game.state.spiritualRoot.key);
    const sIdx = roots.findIndex(r => r.key === s.spouse.root.key);
    let idx = Math.max(pIdx, sIdx);
    if (Math.random() < 0.25 && idx < roots.length - 1) idx += 1; // talented child!
    const child = {
      name: this._name().split(' ')[1] + ' ' + this._name().split(' ')[0],
      gender: Math.random() < 0.5 ? 'female' : 'male',
      root: roots[idx], age: 0,
      traits: this._inheritTraits(),
      nurture: 0,
      path: null,
      lastStage: 'infant',
      spouse: null,
    };
    s.children.push(child);
    const cd = window.Game && Game.modVal ? Game.modVal('childCd') : 1;
    s.childCooldown = 60 * cd; // "Blessed Line" trait shortens this
    Game.persist();
    return child;
  },
  /** A child inherits up to 2 traits drawn from both parents' trait pools. */
  _inheritTraits() {
    const sp = this.s().spouse;
    const pool = [...(Game.state.traits || []), ...((sp && sp.traits) || [])];
    if (!pool.length) return Math.random() < 0.4 ? this._rollTraits(1) : [];
    const uniq = [...new Set(pool)];
    const out = [];
    uniq.forEach(t => { if (out.length < 2 && Math.random() < 0.6) out.push(t); });
    if (!out.length) out.push(uniq[Math.floor(Math.random()*uniq.length)]);
    // small chance of a fresh mutation
    if (Math.random() < 0.15 && out.length < 2) { const r = this._rollTraits(1)[0]; if (!out.includes(r)) out.push(r); }
    return out;
  },
  /** Adopt a gifted orphan (from a life event): a bonus child with a strong root. */
  adoptChild() {
    const s = this.s();
    if (s.children.length >= MAX_CHILDREN) return null;
    const roots = GameData.spiritualRoots;
    const idx = Math.min(roots.length - 1, 2 + Math.floor(Math.random() * 2)); // Heavenly+
    const child = {
      name: this._name(), gender: Math.random() < 0.5 ? 'female' : 'male',
      root: roots[idx], age: 0, traits: this._rollTraits(1), nurture: 0, adopted: true,
      path: null, lastStage: 'infant', spouse: null,
    };
    s.children.push(child);
    Game.persist();
    return child;
  },

  // -- Life stages ------------------------------------------------------------
  stageOf(age) {
    const stages = GameData.childStages;
    let cur = stages[0];
    for (const st of stages) if (age >= st.minAge) cur = st;
    return cur;
  },
  stageIndex(key) { return GameData.childStages.findIndex(s => s.key === key); },
  isHeirEligible(child) {
    return this.stageIndex(this.stageOf(child.age).key) >= this.stageIndex(GameData.heirMinStage);
  },
  canChoosePath(child) {
    return !child.path && this.stageIndex(this.stageOf(child.age).key) >= this.stageIndex('youth');
  },
  choosePath(index, pathId) {
    const child = this.s().children[index];
    if (!child || !this.canChoosePath(child)) return false;
    if (!GameData.childPaths.some(p => p.id === pathId)) return false;
    child.path = pathId;
    Game.persist();
    return true;
  },

  // -- Child marriages: an arranged match, not a full courtship ------------
  canArrangeMarriage(child) {
    return !child.spouse
        && this.stageIndex(this.stageOf(child.age).key) >= this.stageIndex('adult')
        && Game.state.life && Game.state.life.money >= CHILD_MARRIAGE_COST;
  },
  /** Roll a simple in-law partner for a child — an arrangement, not a courtship. */
  _makeChildSpouse() {
    const root = GameData.rollSpiritualRoot('free');
    return {
      name: this._name(),
      gender: Math.random() < 0.5 ? 'female' : 'male',
      root,
      profession: this._pick(PROFESSIONS),
      trait: this._pick(TRAITS),
    };
  },
  arrangeMarriage(index) {
    const child = this.s().children[index];
    if (!child || !this.canArrangeMarriage(child)) return null;
    Game.state.life.money -= CHILD_MARRIAGE_COST;
    const spouse = this._makeChildSpouse();
    child.spouse = spouse;
    // Wedding gifts from the in-laws — richer roots bring a richer dowry.
    const gift = Math.round(1000 * spouse.root.mult);
    Game.state.life.money += gift;
    Game.state.daoComprehension = (Game.state.daoComprehension || 0) + Math.ceil(spouse.root.mult);
    Game.persist();
    return { child, spouse, gift, story: this._pick(CHILD_MARRIAGE_FLAVOR) };
  },

  /** Called on every player age-up (life.js tick). Advances children a year,
   *  fires stage-transition flavour, applies path trickles, and may roll a
   *  spousal/widowhood check for that same yearly beat. */
  ageUp() {
    const s = this.s();
    const stageEvents = [];
    s.children.forEach(c => {
      c.age += 1;
      const stage = this.stageOf(c.age);
      if (stage.key !== c.lastStage) {
        c.lastStage = stage.key;
        const lines = GameData.childStageEvents[stage.key];
        if (lines && lines.length) {
          const line = this._pick(lines).replace('{name}', c.name);
          stageEvents.push(`${stage.icon} ${c.name} ${line}`);
        }
      }
    });
    return stageEvents;
  },

  // -- Passive path income (called from tick) --------------------------------
  _applyPathTrickle(dt) {
    const s = this.s();
    let dao = 0, money = 0;
    s.children.forEach(c => {
      if (c.path === 'scholar')  dao   += 0.002 * dt; // slow, steady Dao trickle
      if (c.path === 'merchant') money += 0.6 * dt;    // small ¥ trickle
    });
    if (dao > 0) Game.state.daoComprehension += dao;
    if (money > 0 && Game.state.life) Game.state.life.money += money;
  },

  // -- Heir nurturing (tutor children so the heir starts life ahead) --------
  tutorCost(child) {
    const N = GameData.nurture;
    return Math.ceil(N.costBase * Math.pow(N.costGrowth, child.nurture || 0));
  },
  canTutor(child) {
    return (child.nurture || 0) < GameData.nurture.maxLevel
        && Game.state.life && Game.state.life.money >= this.tutorCost(child);
  },
  tutorChild(index) {
    const child = this.s().children[index];
    if (!child || !this.canTutor(child)) return false;
    Game.state.life.money -= this.tutorCost(child);
    child.nurture = (child.nurture || 0) + 1;
    Game.persist();
    return true;
  },

  // -- Lineage handoff (read by Game.passToHeir BEFORE it wipes family) -----
  summaryForLineage(heir) {
    const s = this.s();
    return {
      generation: Game.state.generation || 1,
      name: Game.state.name,
      gender: Game.state.gender,
      root: Game.state.spiritualRoot ? Game.state.spiritualRoot.name : '—',
      realmReached: (window.GameData && GameData.realms[Game.state.realm]) ? GameData.realms[Game.state.realm].name : '—',
      spouseName: s.spouse ? s.spouse.name : null,
      childCount: s.children.length,
      marriedChildCount: s.children.filter(c => c.spouse).length,
      heirName: heir ? heir.name : null,
      endedAtAge: Game.state.life ? Game.state.life.age : null,
    };
  },

  // ======================================================================
  // RENDER — Life tab (romance + family)
  // ======================================================================
  render(el) {
    const s = this.s();
    if (!s.spouse) return this._renderRomance(el);
    return this._renderFamily(el);
  },

  _renderRomance(el) {
    const s = this.s();
    el.innerHTML = `
      <div class="section-title">Romance</div>
      <div class="hint">Build Affinity by spending time and ¥. Higher Charm makes you more endearing. Reach 100 Affinity to propose. A partner's Spiritual Root strengthens your whole household — and your children inherit it. Once someone becomes your <b>primary</b> interest (50+ Affinity), the others start drifting if you neglect them.</div>
      <button class="ad-boost-btn meet-destined-btn" id="meet-destined">
        <span class="ad-boost-ico">📺</span>
        <span class="ad-boost-text">
          <span class="ad-boost-label">Watch Ad → Meet a Destined One</span>
          <span class="ad-boost-sub">A rare partner with a Heavenly Root or greater</span>
        </span>
      </button>
      <div id="cand-list"></div>
      <button class="btn-ghost" id="meet-new">↻ Meet New People</button>`;
    const list = el.querySelector('#cand-list');
    s.candidates.forEach(c => {
      const primary = this.isPrimary(c.id);
      const card = document.createElement('div');
      card.className = 'card candidate' + (c.destined ? ' destined' : '') + (primary ? ' primary-candidate' : '');
      card.innerHTML = `
        <div class="cand-head">
          <span class="cand-avatar" style="background:${c.root.color}">${c.gender==='female'?'♀':'♂'}</span>
          <div class="cand-id">
            <div class="cand-name">${c.name}${c.destined?' <span class="badge destined-badge">✦ Destined</span>':''}${primary?' <span class="badge primary-badge">💗 Primary</span>':''}</div>
            <div class="cand-meta">${c.trait} · ${c.profession} · <span style="color:${c.root.color}">${c.root.name}</span> · ♥ Charm ${c.charm}</div>
          </div>
        </div>
        ${this._traitChips(c.traits)}
        ${c.story ? `<div class="cand-story">"${c.story}"</div>` : ''}
        <div class="progress-track heart"><div class="progress-fill" style="width:${c.affinity}%"></div></div>
        <div class="row-between"><span class="muted">Affinity ${Math.floor(c.affinity)}/100</span></div>
        <div class="btn-row">
          <button class="btn-mini" data-a="chat" ${c.chatCooldown>0?'disabled':''}>${c.chatCooldown>0?`Chat… ${Math.ceil(c.chatCooldown)}s`:'Chat'}</button>
          <button class="btn-mini" data-a="date" ${Life.s().money>=200?'':'disabled'}>Date ¥200</button>
          <button class="btn-mini" data-a="gift" ${Life.s().money>=1000?'':'disabled'}>Gift ¥1K</button>
          <button class="btn-primary sm" data-a="marry" ${c.affinity>=100?'':'disabled'}>Propose 💍</button>
        </div>`;
      card.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'marry') {
          const others = s.candidates.filter(x => x.id !== c.id && x.affinity > 0);
          if (others.length && !confirm(`Marrying ${c.name} will end things with everyone else you've been seeing. Continue?`)) return;
          if (this.marry(c.id)) { UI.toast(`💍 You married ${c.name}!`); this.render(el); UI.renderResources(); }
          return;
        }
        this[a](c.id);
        const ev = this._pendingCourtshipScene;
        this._pendingCourtshipScene = null;
        if (ev && window.UI) UI.showCourtshipScene(ev); else this.render(el);
        UI.renderResources();
      }));
      list.appendChild(card);
    });
    el.querySelector('#meet-new').addEventListener('click', () => {
      const invested = s.candidates.some(c => c.affinity > 0);
      if (invested && !confirm('Meeting new people will end things with everyone you\'ve been getting to know. Continue?')) return;
      this.refreshCandidates(); this.render(el);
    });
    el.querySelector('#meet-destined').addEventListener('click', async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      const c = await this.meetDestined();
      if (c) UI.toast(`✨ Fate intervenes — ${c.name} appears, bearing a ${c.root.name}!`);
      this.render(el);
    });
  },

  /** Queues (rather than immediately shows) a courtship scene so the calling
   *  UI can finish its own render pass before a modal steals focus. */
  _tryCourtshipScene(cand) {
    const scene = GameData.courtshipScenes.find(sc => cand.affinity >= sc.atAffinity && !cand.milestonesSeen.includes(sc.id));
    if (!scene) return;
    cand.milestonesSeen.push(scene.id);
    this._pendingCourtshipScene = { scene, candId: cand.id, candName: cand.name };
  },
  resolveCourtshipScene(scene, candId, optIndex) {
    const opt = scene.options[optIndex];
    const c = this._find(candId);
    if (!opt || !c) return { ok: false };
    if (opt.cost && opt.cost.money) {
      if (!Life.s() || Life.s().money < opt.cost.money) return { ok: false, reason: 'cost' };
      Life.s().money -= opt.cost.money;
    }
    c.affinity = Math.max(0, Math.min(100, c.affinity + (opt.affinity || 0)));
    this._updatePrimary(c);
    Game.persist();
    return { ok: true, toast: (opt.toast || '').replace('{name}', c.name) };
  },

  _renderFamily(el) {
    const s = this.s();
    const sp = s.spouse;
    const bond = Math.floor(sp.bond || 0);
    el.innerHTML = `
      <div class="section-title">Family</div>
      <div class="card spouse">
        <div class="cand-head">
          <span class="cand-avatar" style="background:${sp.root.color}">${sp.gender==='female'?'♀':'♂'}</span>
          <div class="cand-id"><div class="cand-name">${sp.name} <span class="badge">Spouse</span></div>
            <div class="cand-meta">${sp.trait} · ${sp.profession} · <span style="color:${sp.root.color}">${sp.root.name}</span> · ${this.yearsMarried()}yr married</div></div>
        </div>
        ${this._traitChips(sp.traits)}
        <div class="progress-track bond"><div class="progress-fill" style="width:${bond}%"></div></div>
        <div class="row-between"><span class="muted">Bond ${bond}/100</span></div>
        <div class="hint">Household cultivation bonus: <b>+${((this.familyMult()*(Game.modVal?Game.modVal('family'):1)-1)*100).toFixed(0)}%</b> Qi · spouse traits apply to you while married · deepening Bond adds up to +15%.</div>
        <button class="btn-mini" id="spend-time" ${this.canSpendTimeWithSpouse()?'':'disabled'}>${sp.timeCooldown>0?`Together… ${Math.ceil(sp.timeCooldown)}s`:'💞 Spend Time Together'}</button>
      </div>
      <div class="section-title small">Children (${s.children.length}/${MAX_CHILDREN})</div>
      <div id="kids"></div>
      <button class="btn-primary" id="have-child" ${this.canHaveChild()?'':'disabled'}>
        ${s.children.length>=MAX_CHILDREN ? 'Family Complete' : (s.childCooldown>0 ? `Resting… ${Math.ceil(s.childCooldown)}s` : 'Have a Child (¥2K)')}
      </button>`;
    const kids = el.querySelector('#kids');
    if (!s.children.length) kids.innerHTML = `<div class="hint">No children yet. Each child adds +5% cultivation, inherits a Spiritual Root and traits, and can become your heir once they reach the Youth stage. Tutor them so the heir starts their life ahead.</div>`;
    s.children.forEach((ch, i) => {
      const d = document.createElement('div');
      d.className = 'list-item child-item';
      const nLvl = ch.nurture || 0;
      const canT = this.canTutor(ch);
      const cost = this.tutorCost(ch);
      const maxed = nLvl >= GameData.nurture.maxLevel;
      const stage = this.stageOf(ch.age);
      const pathDef = ch.path ? GameData.childPaths.find(p => p.id === ch.path) : null;
      const canMarry = this.canArrangeMarriage(ch);
      d.innerHTML = `<span class="li-icon" style="color:${ch.root.color}">${stage.icon}</span>
        <span class="li-main">
          <span class="li-name">${ch.name}${ch.adopted?' <span class="badge">adopted</span>':''} <span class="badge stage-badge">${stage.name}</span></span>
          <span class="li-sub">Age ${ch.age} · <span style="color:${ch.root.color}">${ch.root.name}</span> · Tutored Lv ${nLvl}/${GameData.nurture.maxLevel}${pathDef ? ` · ${pathDef.icon} ${pathDef.name}` : ''}</span>
          ${ch.spouse ? `<span class="li-sub">💍 Married to ${ch.spouse.name}, <span style="color:${ch.spouse.root.color}">${ch.spouse.root.name}</span></span>` : ''}
          ${this._traitChips(ch.traits)}
          ${this.canChoosePath(ch) ? `<div class="path-choice-row" data-i="${i}">${GameData.childPaths.map(p => `<button class="btn-mini path-btn" data-path="${p.id}" title="${p.desc}">${p.icon} ${p.name}</button>`).join('')}</div>` : ''}
          ${canMarry ? `<button class="btn-mini marry-child-btn" data-i="${i}">💍 Arrange Marriage (¥${GameNumbers.formatNumber(CHILD_MARRIAGE_COST)})</button>` : ''}
        </span>
        <button class="btn-mini tutor-btn" data-i="${i}" ${canT?'':'disabled'}>${maxed?'✓ Raised':'Tutor ¥'+GameNumbers.formatNumber(cost)}</button>`;
      kids.appendChild(d);
    });
    kids.querySelectorAll('.tutor-btn').forEach(b => b.addEventListener('click', () => {
      if (this.tutorChild(parseInt(b.dataset.i,10))) { this.render(el); UI.renderResources(); UI.toast('📚 Your child studies hard — a worthier heir.'); }
    }));
    kids.querySelectorAll('.path-btn').forEach(b => b.addEventListener('click', () => {
      const row = b.closest('.path-choice-row');
      const i = parseInt(row.dataset.i, 10);
      const pathId = b.dataset.path;
      if (this.choosePath(i, pathId)) {
        const p = GameData.childPaths.find(x => x.id === pathId);
        this.render(el); UI.renderResources();
        UI.toast(`${p.icon} ${this.s().children[i].name} takes up the ${p.name}.`);
      }
    }));
    kids.querySelectorAll('.marry-child-btn').forEach(b => b.addEventListener('click', () => {
      const res = this.arrangeMarriage(parseInt(b.dataset.i, 10));
      if (res) {
        this.render(el); UI.renderResources();
        UI.toast(`💍 ${res.child.name} marries ${res.spouse.name}! +¥${GameNumbers.formatNumber(res.gift)} in wedding gifts.`);
      }
    }));
    const hc = el.querySelector('#have-child');
    if (hc && this.canHaveChild()) hc.addEventListener('click', () => {
      const ch = this.haveChild();
      if (ch) { UI.toast(`👶 ${ch.name} was born with a ${ch.root.name}!`); this.render(el); UI.renderResources(); }
    });
    const st = el.querySelector('#spend-time');
    if (st && this.canSpendTimeWithSpouse()) st.addEventListener('click', () => {
      if (this.spendTimeWithSpouse()) { this.render(el); UI.renderResources(); UI.toast(`💞 A quiet moment with ${sp.name}.`); }
    });
  },

  tick(dt) {
    const s = this.s();
    if (s.childCooldown > 0) s.childCooldown = Math.max(0, s.childCooldown - dt);
    s.candidates.forEach(c => { if (c.chatCooldown > 0) c.chatCooldown = Math.max(0, c.chatCooldown - dt); });
    if (s.spouse && s.spouse.timeCooldown > 0) s.spouse.timeCooldown = Math.max(0, s.spouse.timeCooldown - dt);

    // Rival departure: once a primary exists, everyone else quietly decays,
    // and — once fully neglected — may leave for good (replaced by someone new).
    if (s.primaryCandidateId) {
      const departed = [];
      s.candidates = s.candidates.filter(c => {
        if (c.id === s.primaryCandidateId) return true;
        c.affinity = Math.max(0, c.affinity - RIVAL_DECAY_PER_SEC * dt);
        if (c.affinity <= 0 && Math.random() < RIVAL_DEPARTURE_CHANCE_PER_SEC * dt) {
          departed.push(c.name);
          return false;
        }
        return true;
      });
      if (departed.length && window.UI) {
        departed.forEach(name => UI.toast(`💔 ${name} has moved on with someone else.`));
        while (s.candidates.length < 3) s.candidates.push(this._makeCandidate('free', 20, false));
      }
    }

    // Spousal events + widowhood, gently paced.
    if (s.spouse) {
      this._applyPathTrickle(dt);
      s.spousalEventAcc = (s.spousalEventAcc || 0) + dt;
      if (s.spousalEventAcc >= SPOUSAL_EVENT_EVERY_SEC) {
        s.spousalEventAcc = 0;
        if (window.UI && !(UI._modalOpen && UI._modalOpen()) && Math.random() < SPOUSAL_EVENT_CHANCE) {
          const ev = this._trySpousalEvent();
          if (ev) UI.showSpousalEvent(ev);
        }
        if (s.spouse && window.UI && !(UI._modalOpen && UI._modalOpen())) {
          const widow = this._tryWidowRoll();
          if (widow) UI.showWidowEvent(widow);
        }
      }
    }
  },
};

window.Family = Family;
