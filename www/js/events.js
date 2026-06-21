/* ===========================================================================
 * events.js — Karma & life events (Round 5 depth).
 * On a timer, a moral dilemma surfaces. Each choice shifts Righteous/Demonic
 * karma and trades resources, giving the idle loop "moments" with consequence.
 * ========================================================================= */
const Events = {
  _active: false,

  tick(dt) {
    const k = GameData.karma;
    Game.state.eventAcc = (Game.state.eventAcc || 0) + dt;
    if (Game.state.eventAcc >= k.eventEverySec) {
      Game.state.eventAcc = 0;
      if (!this._active && Math.random() < k.eventChance) this.trigger();
    }
  },

  /** Events available at the current karma tier (neutral events always show;
   *  align-tagged events only appear when you're on that path). */
  pool() {
    const tier = (window.Game && Game.karmaTier) ? Game.karmaTier() : 'neutral';
    return GameData.lifeEvents.filter(e => !e.align || e.align === tier);
  },

  /** Force a random event (used by the timer; also handy for testing). */
  trigger() {
    if (!window.UI || !UI.showLifeEvent) return null;
    const pool = this.pool();
    const ev = pool[Math.floor(Math.random() * pool.length)];
    if (!ev) return null;
    this._active = true;
    UI.showLifeEvent(ev, () => { this._active = false; });
    return ev;
  },

  /** Apply a chosen option. Returns {ok, opt} or {ok:false, reason}. */
  resolve(ev, optIndex) {
    const opt = ev.options[optIndex];
    if (!opt) return { ok: false, reason: 'invalid' };
    if (opt.cost && !Game.payEventCost(opt.cost)) return { ok: false, reason: 'cost' };
    Game.addKarma(opt.karma || 0);
    Game.applyEventEffects(opt.effects);
    Game.persist();
    return { ok: true, opt };
  },
};
window.Events = Events;
