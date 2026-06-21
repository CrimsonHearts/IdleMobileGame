/* ===========================================================================
 * market.js — The Spirit Market (Round 8): a scaling ¥ sink with drifting
 * prices. Buy resources (stones / eggs / pills / Qi infusions) when cheap,
 * sell surplus when dear. Prices random-walk within a band each minute.
 * ========================================================================= */
const Market = {
  s() { return Game.state.market; },
  fresh() {
    const prices = {};
    GameData.market.goods.forEach(g => { prices[g.id] = 1; });
    return { prices, trend: {}, lastDrift: 0 };
  },
  init() {
    if (!Game.state.market) Game.state.market = this.fresh();
    GameData.market.goods.forEach(g => { if (this.s().prices[g.id] === undefined) this.s().prices[g.id] = 1; });
  },

  good(id) { return GameData.market.goods.find(g => g.id === id); },

  /** Realm-scaled / dynamic base price for a good (before drift). */
  baseOf(g) {
    if (g.dynamic === 'pill') {
      const next = Game.nextRealm();
      return next && next.pillCost ? next.pillCost : 5000; // no pill needed → token price
    }
    return Math.ceil(g.base * Math.pow(GameData.market.realmScale, Game.state.realm));
  },
  /** Current ¥ price per unit (base × drift multiplier). */
  price(id) { return Math.max(1, Math.ceil(this.baseOf(this.good(id)) * (this.s().prices[id] || 1))); },
  sellPrice(id) { return Math.max(1, Math.floor(this.price(id) * GameData.market.sellRate)); },
  trend(id) { return this.s().trend[id] || 0; }, // -1 down, 0 flat, +1 up

  /** Random-walk prices on the configured cadence (called from tick/render). */
  drift(force) {
    const M = GameData.market, s = this.s();
    const now = TimeService.now();
    if (!force && now - (s.lastDrift || 0) < M.driftEverySec * 1000) return false;
    s.lastDrift = now;
    M.goods.forEach(g => {
      const cur = s.prices[g.id] || 1;
      const step = (Math.random() * 2 - 1) * M.driftAmt;
      const next = Math.min(M.bandHigh, Math.max(M.bandLow, cur + step));
      s.trend[g.id] = next > cur + 0.005 ? 1 : next < cur - 0.005 ? -1 : 0;
      s.prices[g.id] = next;
    });
    return true;
  },

  maxAffordable(id) {
    const money = (Game.state.life && Game.state.life.money) || 0;
    return Math.floor(money / this.price(id));
  },

  buy(id, qty) {
    qty = Math.max(0, Math.floor(qty));
    if (!qty) return false;
    const cost = this.price(id) * qty;
    const life = Game.state.life;
    if (!life || life.money < cost) return false;
    life.money -= cost;
    const g = this.good(id);
    if (g.give.stones) Game.state.spiritStones += g.give.stones * qty;
    if (g.give.eggs)   Game.state.beastEggs   += g.give.eggs   * qty;
    if (g.give.pill)   Game.state.breakthroughPills = (Game.state.breakthroughPills || 0) + g.give.pill * qty;
    if (g.give.qiHours) Game._addQi(Game.qiPerSecond() * 3600 * g.give.qiHours * qty + 50);
    Game.persist();
    return true;
  },

  sell(id, qty) {
    const def = GameData.market.sellable.find(x => x.id === id);
    if (!def) return false;
    qty = Math.max(0, Math.floor(qty));
    const have = Game.state[def.from] || 0;
    qty = Math.min(qty, have);
    if (!qty) return false;
    Game.state[def.from] -= qty;
    if (Game.state.life) Game.state.life.money += this.sellPrice(id) * qty;
    Game.persist();
    return true;
  },
};
window.Market = Market;
