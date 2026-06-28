/* ===========================================================================
 * onboarding.js — New-player experience: progressive feature unlocks + a
 * guided tutorial (spotlight coach-marks) + one-time contextual hints.
 *
 * Feature unlocks: tabs and quick-actions start hidden and reveal themselves
 * as the player reaches state-based milestones, each with a celebration and a
 * "NEW" badge until first visited. Existing saves (created before this system
 * shipped) are grandfathered in with everything unlocked.
 *
 * All progress lives in Game.state.onboarding so it persists and never
 * repeats. Conditions are pure functions of state, so loading an advanced
 * save silently unlocks everything already earned.
 * ========================================================================= */

const Onboarding = {

  /* -- Progressive feature unlocks ----------------------------------------
   * kind 'tab' hides a bottom-nav tab; kind 'qa' hides a quick-action button.
   * when() — unlock condition, evaluated against Game.state every tick.
   * celebrate 'modal' pauses for a full unlock sheet; 'toast' is lightweight.
   */
  FEATURES: [
    { id: 'quests', kind: 'qa', sel: '#quest-btn', celebrate: 'toast',
      icon: '📜', name: 'Quest Log',
      desc: 'Quests now guide your path — open the log to claim rewards.',
      when: s => (s.owned.mat || 0) >= 1 },

    { id: 'study', kind: 'tab', tab: 'study', celebrate: 'modal',
      icon: '🎓', name: 'The Academy',
      desc: 'Your mind awakens alongside your Qi. Enroll in courses to raise <b>Talent</b> (faster cultivation), <b>Intellect</b> (better pay) and <b>Charm</b>.',
      when: s => s.stagesCleared >= 1 },

    { id: 'work', kind: 'tab', tab: 'work', celebrate: 'modal',
      icon: '💼', name: 'Career',
      desc: 'Even cultivators pay rent. Take a job to earn <b>¥ money</b> — you will need it for courses, romance and, one day, <b>Breakthrough Pills</b>.',
      when: s => !!s.life && s.life.education >= 1 },

    { id: 'arts', kind: 'tab', tab: 'techniques', celebrate: 'modal',
      icon: '📜', name: 'Arts & Techniques',
      desc: 'Ancient manuals reveal themselves. Learn <b>Techniques</b> to multiply your Qi — and later, open <b>Meridians</b> and brew <b>Pills</b>.',
      when: s => s.lifetimeQi >= 250 },

    { id: 'world', kind: 'tab', tab: 'world', celebrate: 'modal',
      icon: '⚔️', name: 'The Outside World',
      desc: 'You can now sense Qi — and so can the demons. Battle through <b>Trials</b>, tame <b>Spirit Beasts</b> and pledge to a <b>Sect</b>.',
      when: () => Game.combatUnlocked() },

    { id: 'life', kind: 'tab', tab: 'life', celebrate: 'modal',
      icon: '❤️', name: 'Life & Legacy',
      desc: 'The dao is long; do not walk it alone. Court a partner — your <b>spouse and children</b> strengthen your cultivation, and one day an <b>heir</b> will carry your legacy.',
      when: s => s.realm >= 1 },

    { id: 'shop', kind: 'qa', sel: '#shop-btn', celebrate: 'toast',
      icon: '🛒', name: 'Immortal Shop',
      desc: 'The Immortal Shop is open.',
      when: s => s.realm >= 1 },

    { id: 'daily', kind: 'qa', sel: '#daily-btn', celebrate: 'toast',
      icon: '🎁', name: 'Daily Blessings',
      desc: 'Return each day for escalating blessings.',
      when: s => s.realm >= 1 },
  ],

  /* -- Guided tutorial steps ------------------------------------------------
   * Each step spotlights an element on the Cultivate tab. A step activates
   * when when() turns true and retires when done() turns true (the action
   * itself completes it — there is no "next" button to dismiss).
   */
  STEPS: [
    { id: 'tap', tab: 'cultivate',
      target: () => document.getElementById('meditate-btn'),
      text: '🧘 Tap <b>Meditate</b> to gather Qi — the essence of all cultivation.',
      when: s => (s.owned.mat || 0) === 0 && s.lifetimeQi < 15,
      done: s => s.lifetimeQi >= 15 || (s.owned.mat || 0) >= 1 },

    { id: 'gen', tab: 'cultivate',
      target: () => document.getElementById('gen-mat'),
      text: '⛩ Spend Qi on a <b>Cultivation Ground</b>. It gathers Qi for you — even while you rest.',
      when: s => (s.owned.mat || 0) === 0 && s.qi >= 15,
      done: s => (s.owned.mat || 0) >= 1 },

    { id: 'stage', tab: 'cultivate',
      target: () => document.getElementById('advance-btn'),
      text: '⬆ Advance your <b>cultivation stage</b>: the Qi is consumed, but every stage grants a permanent +5% power.',
      when: s => s.stagesCleared === 0 && Game.canAdvanceStage(),
      done: s => s.stagesCleared >= 1 },

    { id: 'trib', tab: 'cultivate',
      target: () => document.getElementById('breakthrough-btn'),
      text: '⚡ Face the <b>Heavenly Tribulation</b> to ascend to a new realm. Qi and grounds reset — but the Dao you comprehend makes you permanently stronger.',
      when: s => s.realm === 0 && Game.realmComplete(),
      done: s => s.realm >= 1 },
  ],

  /* -- One-time contextual hints (modal, fires once) ----------------------- */
  HINTS: [
    { id: 'pill_gate', icon: '💊', title: 'The Pill Gate',
      html: 'From <b>Foundation Establishment</b> onward, the Heavenly Tribulation demands a <b>Breakthrough Pill</b> — and success is no longer certain.<br><br>Earn <b>¥</b> through your <b>💼 Career</b> to buy pills, and raise <b>Talent</b> & <b>Intellect</b> at the 🎓 Academy to improve your odds.',
      when: s => s.realm === 1 && Game.realmComplete() && Game.pillRequired() && !Game.hasPill() },
  ],

  _queue: [],        // pending 'modal' celebrations (shown one at a time)
  _showingModal: false,
  _spot: null,       // spotlight cutout element
  _tip: null,        // tutorial tooltip element

  ob() { return Game.state.onboarding; },
  isUnlocked(id) { return !!this.ob().unlocked[id]; },

  init() {
    const ob = this.ob();
    // Saves from before this system shipped (or post-tutorial heirs/rebirths)
    // skip straight to a fully unlocked game — never re-lock a veteran.
    if (!ob.ready) {
      ob.ready = true;
      if (Game.state.characterCreated) {
        this.FEATURES.forEach(f => { ob.unlocked[f.id] = true; ob.seen[f.id] = true; });
        this.STEPS.forEach(st => { ob.steps[st.id] = true; });
        this.HINTS.forEach(h => { ob.hints[h.id] = true; });
      }
    }
    this.applyVisibility();

    // First visit clears the "NEW" badge.
    this.FEATURES.forEach(f => {
      const btn = this._featureBtn(f);
      if (btn) btn.addEventListener('click', () => {
        if (this.ob().unlocked[f.id] && !this.ob().seen[f.id]) {
          this.ob().seen[f.id] = true;
          btn.classList.remove('nav-new');
        }
      });
    });
  },

  _featureBtn(f) {
    return f.kind === 'tab'
      ? document.querySelector(`#bottom-nav .nav-btn[data-tab="${f.tab}"]`)
      : document.querySelector(f.sel);
  },

  /** Show/hide gated tabs & quick-actions to match the unlock map. */
  applyVisibility() {
    const ob = this.ob();
    let qaVisible = false;
    this.FEATURES.forEach(f => {
      const btn = this._featureBtn(f);
      if (!btn) return;
      const open = !!ob.unlocked[f.id];
      btn.style.display = open ? '' : 'none';
      btn.classList.toggle('nav-new', open && !ob.seen[f.id]);
      if (f.kind === 'qa' && open) qaVisible = true;
    });
    // Collapse the quick-action bar entirely until something lives in it.
    const qa = document.getElementById('quick-actions');
    if (qa) qa.style.display = qaVisible ? '' : 'none';
  },

  /** Called ~10×/s from the main loop (after character creation). */
  tick() {
    if (!Game.state.characterCreated) return;
    this._checkUnlocks();
    this._checkHints();
    this._runTutorial();
  },

  // -- Feature unlocks --------------------------------------------------------
  _checkUnlocks() {
    const ob = this.ob();
    let changed = false;
    this.FEATURES.forEach(f => {
      if (ob.unlocked[f.id]) return;
      let met = false;
      try { met = !!f.when(Game.state); } catch (e) { /* state not ready yet */ }
      if (!met) return;
      ob.unlocked[f.id] = true;
      changed = true;
      if (f.celebrate === 'modal') this._queue.push(f);
      else if (window.UI) UI.toast(`${f.icon} Unlocked: ${f.name}!`);
    });
    if (changed) {
      this.applyVisibility();
      Game.persist();
    }
    this._drainQueue();
  },

  _drainQueue() {
    if (this._showingModal || !this._queue.length) return;
    // Don't stack on top of another modal (tribulation, life event, …).
    if (document.querySelector('.modal-overlay')) return;
    const f = this._queue.shift();
    this._showingModal = true;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal unlock-modal">
        <div class="unlock-burst">${f.icon}</div>
        <div class="unlock-kicker">✦ New Feature Unlocked ✦</div>
        <h2>${f.name}</h2>
        <p>${f.desc}</p>
        <button class="modal-close">Continue ☯</button>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => {
      overlay.remove();
      this._showingModal = false;
      // Defer so the removed overlay is gone from the DOM before the next
      // _drainQueue call checks document.querySelector('.modal-overlay').
      setTimeout(() => this._drainQueue(), 0);
    });
    document.body.appendChild(overlay);
    if (window.UI) UI.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 12);
  },

  // -- Contextual hints --------------------------------------------------------
  _checkHints() {
    const ob = this.ob();
    if (this._showingModal || document.querySelector('.modal-overlay')) return;
    for (const h of this.HINTS) {
      if (ob.hints[h.id]) continue;
      let met = false;
      try { met = !!h.when(Game.state); } catch (e) { /* ignore */ }
      if (!met) continue;
      ob.hints[h.id] = true;
      Game.persist();
      if (window.UI) UI.modal(`${h.icon} ${h.title}`, h.html, null);
      break; // one hint at a time
    }
  },

  // -- Guided tutorial -----------------------------------------------------------
  _runTutorial() {
    const ob = this.ob();
    if (ob.skipped) { this._hideSpot(); return; }
    const s = Game.state;

    // Find the first live step: not finished, trigger met (or met earlier).
    let active = null;
    for (const st of this.STEPS) {
      if (ob.steps[st.id]) continue;
      let isDone = false, isOn = false;
      try { isDone = !!st.done(s); isOn = !!st.when(s); } catch (e) { /* ignore */ }
      if (isDone) { ob.steps[st.id] = true; continue; } // completed before it could show
      if (isOn) { active = st; break; }
      break; // steps are sequential — don't look ahead of an unmet trigger
    }
    if (!active) { this._hideSpot(); return; }

    // Only spotlight when the step's tab is up and nothing covers the screen.
    const target = active.target();
    const onTab = !window.UI || UI.activeTab === active.tab;
    const covered = document.querySelector('.modal-overlay');
    if (!target || !onTab || covered || target.offsetParent === null) {
      this._hideSpot();
      return;
    }
    this._showSpot(target, active.text);
  },

  _ensureSpotEls() {
    if (this._spot) return;
    this._spot = document.createElement('div');
    this._spot.id = 'tut-spot';
    this._tip = document.createElement('div');
    this._tip.id = 'tut-tip';
    this._tip.innerHTML = `<div id="tut-tip-text"></div><button id="tut-skip">Skip tutorial</button>`;
    this._tip.querySelector('#tut-skip').addEventListener('click', () => {
      this.ob().skipped = true;
      this.STEPS.forEach(st => { this.ob().steps[st.id] = true; });
      Game.persist();
      this._hideSpot();
    });
    document.body.appendChild(this._spot);
    document.body.appendChild(this._tip);
  },

  _showSpot(target, text) {
    this._ensureSpotEls();
    const r = target.getBoundingClientRect();
    const pad = 6;
    this._spot.style.display = 'block';
    this._spot.style.left = (r.left - pad) + 'px';
    this._spot.style.top = (r.top - pad) + 'px';
    this._spot.style.width = (r.width + pad * 2) + 'px';
    this._spot.style.height = (r.height + pad * 2) + 'px';

    const txt = this._tip.querySelector('#tut-tip-text');
    if (txt.innerHTML !== text) txt.innerHTML = text;
    this._tip.style.display = 'block';
    // Place the tip below the target, or above when there is no room.
    const tipH = this._tip.offsetHeight || 90;
    const below = r.bottom + pad + 10;
    const top = (below + tipH < window.innerHeight - 70) ? below : (r.top - pad - tipH - 10);
    this._tip.style.top = Math.max(8, top) + 'px';
  },

  _hideSpot() {
    if (this._spot) this._spot.style.display = 'none';
    if (this._tip) this._tip.style.display = 'none';
  },
};

window.Onboarding = Onboarding;
