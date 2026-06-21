/* ===========================================================================
 * tutorial.js — First-session onboarding (Round 9).
 * A lightweight spotlight + coach-mark walkthrough of the core loop. Runs once
 * after character creation (Game.state.tutorialDone), fully skippable, and can
 * be replayed via Tutorial.start(true). Never soft-locks: every step has Next.
 * ========================================================================= */
const Tutorial = {
  i: 0,
  active: false,
  _onResize: null,

  steps: [
    { title: 'Welcome, Cultivator', target: null,
      text: 'Your journey from mortal to immortal begins. Here is the path in a few breaths.' },
    { title: 'Meditate for Qi', target: '#meditate-btn', interactive: true,
      text: 'Tap the emblem to <b>Meditate</b> and gather <b>Qi</b> — the energy of all cultivation. Give it a tap!' },
    { title: 'Build Your Grounds', target: '#shop-list',
      text: 'Spend Qi on <b>facilities</b> here. Each one generates Qi automatically, even while you are away.' },
    { title: 'Advance & Ascend', target: '#realm-progress',
      text: 'Spend Qi to <b>cultivate</b> through minor stages. Clear them all, then face the <b>Heavenly Tribulation</b> to ascend a realm and earn permanent Dao power.' },
    { title: 'Study & Work', target: '.nav-btn[data-tab="study"]',
      text: '<b>Study</b> raises Talent (faster cultivation). <b>Work</b> earns ¥ to buy Breakthrough Pills and fund your life.' },
    { title: 'A Whole Life', target: '.nav-btn[data-tab="life"]',
      text: 'In <b>Life</b>, romance a partner and raise children — your heir inherits your Spiritual Root and continues the bloodline when your lifespan ends.' },
    { title: 'The Wider World', target: '.nav-btn[data-tab="world"]',
      text: '<b>World</b> holds Trials, Spirit Beasts, your Sect, Artifacts, and the Market. Plenty to explore as you grow stronger.' },
    { title: 'Begin Your Ascension', target: null,
      text: 'That is the path. Cultivate diligently, Daoist — immortality awaits. 🗻' },
  ],

  start(force) {
    if (!force && Game.state.tutorialDone) return;
    if (this.active) return;
    this.active = true; this.i = 0;
    this._ensureDom();
    this._onResize = () => this._position();
    window.addEventListener('resize', this._onResize);
    this._render();
  },

  finish() {
    this.active = false;
    Game.state.tutorialDone = true;
    Game.persist();
    if (this._root) this._root.style.display = 'none';
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  },

  next() { this.i++; if (this.i >= this.steps.length) this.finish(); else this._render(); },

  _ensureDom() {
    if (this._root) { this._root.style.display = ''; return; }
    const root = document.createElement('div');
    root.id = 'tutorial-root';
    root.innerHTML = `
      <div class="tut-block" id="tut-block"></div>
      <div class="tut-hole" id="tut-hole"></div>
      <div class="tut-card" id="tut-card">
        <div class="tut-step" id="tut-step"></div>
        <h3 id="tut-title"></h3>
        <p id="tut-text"></p>
        <div class="tut-actions">
          <button class="tut-skip" id="tut-skip">Skip</button>
          <button class="tut-next" id="tut-next">Next →</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    this._root = root;
    root.querySelector('#tut-next').addEventListener('click', () => this.next());
    root.querySelector('#tut-skip').addEventListener('click', () => this.finish());
    this._block = root.querySelector('#tut-block');
    this._hole = root.querySelector('#tut-hole');
    this._card = root.querySelector('#tut-card');
  },

  _render() {
    const step = this.steps[this.i];
    this._root.querySelector('#tut-step').textContent = `Step ${this.i + 1} of ${this.steps.length}`;
    this._root.querySelector('#tut-title').innerHTML = step.title;
    this._root.querySelector('#tut-text').innerHTML = step.text;
    this._root.querySelector('#tut-next').textContent = this.i === this.steps.length - 1 ? 'Begin ☯' : 'Next →';

    // Release any previously lifted target.
    this._releaseTarget();
    const el = step.target ? document.querySelector(step.target) : null;
    this._lifted = (step.interactive && el) ? el : null;
    if (this._lifted) {
      this._prevStyle = { position: el.style.position, zIndex: el.style.zIndex };
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.style.zIndex = '402';
      this._tapHandler = () => this.next();
      el.addEventListener('click', this._tapHandler, { once: true });
    }
    this._position();
  },

  _releaseTarget() {
    if (this._lifted) {
      if (this._tapHandler) this._lifted.removeEventListener('click', this._tapHandler);
      this._lifted.style.position = this._prevStyle.position;
      this._lifted.style.zIndex = this._prevStyle.zIndex;
      this._lifted = null; this._tapHandler = null;
    }
  },

  _position() {
    const step = this.steps[this.i];
    const el = step.target ? document.querySelector(step.target) : null;
    const card = this._card, hole = this._hole;
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = 8;
      hole.style.display = '';
      hole.style.left = (r.left - pad) + 'px';
      hole.style.top = (r.top - pad) + 'px';
      hole.style.width = (r.width + pad * 2) + 'px';
      hole.style.height = (r.height + pad * 2) + 'px';
      // Place the card below the target if it sits in the top 55% of the screen.
      card.style.display = '';
      const below = r.bottom < window.innerHeight * 0.55;
      card.style.left = '50%';
      card.style.transform = 'translateX(-50%)';
      if (below) { card.style.top = (r.bottom + 16) + 'px'; card.style.bottom = 'auto'; }
      else { card.style.bottom = (window.innerHeight - r.top + 16) + 'px'; card.style.top = 'auto'; }
    } else {
      hole.style.display = 'none';
      card.style.left = '50%'; card.style.transform = 'translateX(-50%)';
      card.style.top = '50%'; card.style.bottom = 'auto';
      card.style.transform = 'translate(-50%, -50%)';
    }
  },
};
window.Tutorial = Tutorial;
