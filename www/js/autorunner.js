/* ===========================================================================
 * autorunner.js — Auto-Runner (Round 30): hands-off automation for the core
 * cultivation grind (generators, one-time upgrades, minor stage advances,
 * major realm breakthroughs). Scope deliberately stops there — artifacts,
 * techniques, pills, market, sect, etc. all involve real choices (which Dao
 * Path, which gear, whether to risk a Tribulation pill right now) and stay
 * manual. Off by default; toggled from the Cultivate tab.
 *
 * Priority per tick (highest-value action first, since all four compete for
 * the same `Game.state.qi` pool):
 *   1. Realm breakthrough — resets Qi/generators anyway, so there's never a
 *      reason to defer it once available.
 *   2. Minor stage advances — cheap, permanent +5%/stage Cultivation Base,
 *      and the requirement only rises, so clearing every one currently
 *      affordable is always correct (never a "wait, might be better spent
 *      elsewhere" case the way generators are).
 *   3. One-time upgrades — don't compound in cost like generators (there's
 *      no "the price will still be this good later"), so buy every
 *      affordable one immediately.
 *   4. Generators — greedy marginal-ROI: repeatedly buy whichever
 *      currently-affordable generator gives the most production per Qi
 *      spent right now (not just "cheapest" or "first in the list").
 * ========================================================================= */
const AutoRunner = {
  MAX_STAGE_ADVANCES_PER_TICK: 50,
  MAX_GENERATOR_BUYS_PER_TICK: 500,

  s() { return Game.state.autoRunner; },
  enabled() { return !!(this.s() && this.s().enabled); },

  setEnabled(on) {
    if (!Game.state.autoRunner) Game.state.autoRunner = { enabled: false };
    Game.state.autoRunner.enabled = !!on;
    Game.persist();
    if (window.UI) UI.toast(on ? '🤖 Auto-Runner engaged — grinding the core loop for you.' : '🤖 Auto-Runner stopped.');
  },
  toggle() { this.setEnabled(!this.enabled()); },

  tick() {
    if (!this.enabled()) return;

    // 1. Realm breakthrough — bypasses UI.doBreakthrough() on purpose: that
    // wrapper opens a confirmation modal and fires a paid interstitial ad
    // every 3rd breakthrough, neither of which belongs in an automated
    // background loop. Call the underlying engine method directly.
    if (Game.canBreakThrough()) {
      const result = Game.breakThrough();
      if (result && result.failed) {
        if (window.UI) UI.toast('🤖 Auto-Runner: Tribulation attempt failed — recovering.');
      } else if (result) {
        if (window.UI) UI.toast(`🤖 Auto-Runner: ascended to ${result.realm.name}! +${GameNumbers.formatNumber(result.gain)} Dao`);
      }
      return; // state just reset (Qi/generators wiped) — resume from here next tick
    }

    // 2. Minor stage advances.
    let stagesAdvanced = 0;
    while (Game.canAdvanceStage() && stagesAdvanced < this.MAX_STAGE_ADVANCES_PER_TICK) {
      if (!Game.advanceStage()) break;
      stagesAdvanced++;
    }
    if (stagesAdvanced > 0 && window.UI) {
      const tier = Game.tierLabel();
      UI.toast(`🤖 Auto-Runner: advanced ${stagesAdvanced} stage${stagesAdvanced>1?'s':''} → ${tier.realm} · ${tier.stage}`);
      UI.renderAll();
    }

    // 3. One-time upgrades.
    let upgradesBought = 0;
    GameData.upgrades.forEach(u => {
      if (!Game.state.upgrades[u.id] && Game.buyUpgrade(u.id)) upgradesBought++;
    });
    if (upgradesBought > 0 && window.UI) {
      UI.toast(`🤖 Auto-Runner: learned ${upgradesBought} manual${upgradesBought>1?'s':''}`);
      UI.renderAll();
    }

    // 4. Generators — greedy marginal-ROI, no toast (too frequent/low-signal;
    // matches manual generator purchases, which are also silent — see
    // ui.js buyGen()).
    const bought = this._buyGeneratorsGreedy();
    if ((stagesAdvanced > 0 || upgradesBought > 0 || bought > 0) && window.UI) UI.renderShop();
  },

  /** Production gained by owning one more of generator `g`, and its cost,
   * ignoring the shared global multiplier (root/stage/dao/sect/pet/...) —
   * it applies equally to every generator's contribution, so it cancels out
   * when just RANKING which purchase is most efficient right now. Skips the
   * (much more expensive) full Game.qiPerSecond() recompute per candidate. */
  _generatorMarginalValue(g) {
    if (g.reqRealm && Game.state.realm < g.reqRealm) return null;
    const owned = Game.state.owned[g.id] || 0;
    const cost = Game.generatorCost(g, 1);
    if (!(cost > 0) || cost > Game.state.qi) return null;
    const before = g.baseProd * owned * GameData.genMilestoneMultiplier(owned);
    const after  = g.baseProd * (owned + 1) * GameData.genMilestoneMultiplier(owned + 1);
    const gain = after - before;
    return { cost, gain, efficiency: gain / cost };
  },

  /** Repeatedly buys ONE unit of whichever affordable generator currently
   * has the best production-per-Qi-spent, re-ranking after every purchase
   * (a milestone/synergy threshold crossing can reorder who's best next).
   * Returns how many units were bought. */
  _buyGeneratorsGreedy() {
    let bought = 0;
    for (let i = 0; i < this.MAX_GENERATOR_BUYS_PER_TICK; i++) {
      let best = null, bestGen = null;
      for (const g of GameData.generators) {
        const v = this._generatorMarginalValue(g);
        if (v && (!best || v.efficiency > best.efficiency)) { best = v; bestGen = g; }
      }
      if (!best) break; // nothing affordable this pass
      if (!Game.buyGenerator(bestGen.id, 1)) break; // safety net, shouldn't trigger
      bought++;
    }
    return bought;
  },
};
window.AutoRunner = AutoRunner;
