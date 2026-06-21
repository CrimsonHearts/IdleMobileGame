/* ===========================================================================
 * family.js — Romance & Family.
 *   • Meet candidates, build Affinity by chatting / dating / gifting (Charm + ¥).
 *   • Marry your chosen partner, then raise children who inherit a Spiritual
 *     Root from their parents — each child boosts the household's cultivation.
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

const MAX_CHILDREN = 6;

const Family = {
  s() { return Game.state.family; },
  fresh() { return { candidates: [], spouse: null, children: [], childCooldown: 0 }; },
  init() {
    if (!Game.state.family) Game.state.family = this.fresh();
    if (!this.s().candidates.length && !this.s().spouse) this._seed();
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
      c.traits = ['spiritual', 'ironwill']; c.aligned = 'righteous';
      list.unshift(c);
    } else if (tier === 'demonic') {
      const c = this._makeCandidate('min_heaven', 65, false);
      c.name = 'Devil ' + c.name.split(' ')[0];
      c.profession = 'Demon Cultivator'; c.trait = 'Seductive';
      c.traits = ['warlike', 'lucky']; c.aligned = 'demonic';
      list.unshift(c);
    }
    this.s().candidates = list;
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
  /** Household cultivation multiplier: spouse + children. */
  familyMult() {
    const s = this.s();
    let m = 1;
    if (s.spouse) m += 0.10 + (s.spouse.root.mult - 1) * 0.05; // partner shares dao
    m += (s.children.length) * 0.05;
    return m;
  },

  // -- Romance actions ------------------------------------------------------
  _gain(cand, base) {
    const charm = (Game.state.life && Game.state.life.charm) || 0;
    const charmMod = window.Game && Game.modVal ? Game.modVal('charm') : 1;
    cand.affinity = Math.min(100, cand.affinity + base * (1 + charm * 0.01) * charmMod);
  },
  chat(id) { const c = this._find(id); if (c) { this._gain(c, 4); Game.persist(); } return c; },
  date(id) { const c = this._find(id); if (c && Life.s().money >= 200) { Life.s().money -= 200; this._gain(c, 14); Game.persist(); } return c; },
  gift(id) { const c = this._find(id); if (c && Life.s().money >= 1000) { Life.s().money -= 1000; this._gain(c, 30); Game.persist(); } return c; },
  _find(id) { return this.s().candidates.find(c => c.id === id); },

  marry(id) {
    const c = this._find(id);
    if (!c || c.affinity < 100 || this.s().spouse) return false;
    this.s().spouse = c;
    this.s().candidates = [];
    Game.persist();
    return true;
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
    };
    s.children.push(child);
    Game.persist();
    return child;
  },
  ageUp() { this.s().children.forEach(c => c.age += 1); },

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
      <div class="hint">Build Affinity by spending time and ¥. Higher Charm makes you more endearing. Reach 100 Affinity to propose. A partner's Spiritual Root strengthens your whole household — and your children inherit it.</div>
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
      const card = document.createElement('div');
      card.className = 'card candidate' + (c.destined ? ' destined' : '');
      card.innerHTML = `
        <div class="cand-head">
          <span class="cand-avatar" style="background:${c.root.color}">${c.gender==='female'?'♀':'♂'}</span>
          <div class="cand-id">
            <div class="cand-name">${c.name}${c.destined?' <span class="badge destined-badge">✦ Destined</span>':''}</div>
            <div class="cand-meta">${c.trait} · ${c.profession} · <span style="color:${c.root.color}">${c.root.name}</span> · ♥ Charm ${c.charm}</div>
          </div>
        </div>
        ${this._traitChips(c.traits)}
        ${c.story ? `<div class="cand-story">“${c.story}”</div>` : ''}
        <div class="progress-track heart"><div class="progress-fill" style="width:${c.affinity}%"></div></div>
        <div class="row-between"><span class="muted">Affinity ${Math.floor(c.affinity)}/100</span></div>
        <div class="btn-row">
          <button class="btn-mini" data-a="chat">Chat</button>
          <button class="btn-mini" data-a="date" ${Life.s().money>=200?'':'disabled'}>Date ¥200</button>
          <button class="btn-mini" data-a="gift" ${Life.s().money>=1000?'':'disabled'}>Gift ¥1K</button>
          <button class="btn-primary sm" data-a="marry" ${c.affinity>=100?'':'disabled'}>Propose 💍</button>
        </div>`;
      card.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'marry') { if (this.marry(c.id)) { UI.toast(`💍 You married ${c.name}!`); this.render(el); UI.renderResources(); } return; }
        this[a](c.id); this.render(el); UI.renderResources();
      }));
      list.appendChild(card);
    });
    el.querySelector('#meet-new').addEventListener('click', () => { this.refreshCandidates(); this.render(el); });
    el.querySelector('#meet-destined').addEventListener('click', async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      const c = await this.meetDestined();
      if (c) UI.toast(`✨ Fate intervenes — ${c.name} appears, bearing a ${c.root.name}!`);
      this.render(el);
    });
  },

  _renderFamily(el) {
    const s = this.s();
    const sp = s.spouse;
    el.innerHTML = `
      <div class="section-title">Family</div>
      <div class="card spouse">
        <div class="cand-head">
          <span class="cand-avatar" style="background:${sp.root.color}">${sp.gender==='female'?'♀':'♂'}</span>
          <div class="cand-id"><div class="cand-name">${sp.name} <span class="badge">Spouse</span></div>
            <div class="cand-meta">${sp.trait} · ${sp.profession} · <span style="color:${sp.root.color}">${sp.root.name}</span></div></div>
        </div>
        ${this._traitChips(sp.traits)}
        <div class="hint">Household cultivation bonus: <b>+${((this.familyMult()*(Game.modVal?Game.modVal('family'):1)-1)*100).toFixed(0)}%</b> Qi · spouse traits apply to you while married.</div>
      </div>
      <div class="section-title small">Children (${s.children.length}/${MAX_CHILDREN})</div>
      <div id="kids"></div>
      <button class="btn-primary" id="have-child" ${this.canHaveChild()?'':'disabled'}>
        ${s.children.length>=MAX_CHILDREN ? 'Family Complete' : (s.childCooldown>0 ? `Resting… ${Math.ceil(s.childCooldown)}s` : 'Have a Child (¥2K)')}
      </button>`;
    const kids = el.querySelector('#kids');
    if (!s.children.length) kids.innerHTML = `<div class="hint">No children yet. Each child adds +5% cultivation, inherits a Spiritual Root and traits, and can become your heir. Tutor them so the heir starts their life ahead.</div>`;
    s.children.forEach((ch, i) => {
      const d = document.createElement('div');
      d.className = 'list-item';
      const nLvl = ch.nurture || 0;
      const canT = this.canTutor(ch);
      const cost = this.tutorCost(ch);
      const maxed = nLvl >= GameData.nurture.maxLevel;
      d.innerHTML = `<span class="li-icon" style="color:${ch.root.color}">${ch.gender==='female'?'👧':'👦'}</span>
        <span class="li-main">
          <span class="li-name">${ch.name}${ch.adopted?' <span class="badge">adopted</span>':''}</span>
          <span class="li-sub">Age ${ch.age} · <span style="color:${ch.root.color}">${ch.root.name}</span> · Tutored Lv ${nLvl}/${GameData.nurture.maxLevel}</span>
          ${this._traitChips(ch.traits)}
        </span>
        <button class="btn-mini tutor-btn" data-i="${i}" ${canT?'':'disabled'}>${maxed?'✓ Raised':'Tutor ¥'+GameNumbers.formatNumber(cost)}</button>`;
      kids.appendChild(d);
    });
    kids.querySelectorAll('.tutor-btn').forEach(b => b.addEventListener('click', () => {
      if (this.tutorChild(parseInt(b.dataset.i,10))) { this.render(el); UI.renderResources(); UI.toast('📚 Your child studies hard — a worthier heir.'); }
    }));
    const hc = el.querySelector('#have-child');
    if (hc && this.canHaveChild()) hc.addEventListener('click', () => {
      const ch = this.haveChild();
      if (ch) { UI.toast(`👶 ${ch.name} was born with a ${ch.root.name}!`); this.render(el); UI.renderResources(); }
    });
  },

  tick(dt) { if (this.s().childCooldown > 0) this.s().childCooldown = Math.max(0, this.s().childCooldown - dt); },
};

window.Family = Family;
