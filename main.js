Game.registerMod("auto_buyer", {
  init: function() {
    let on = false;

    document.addEventListener("keydown", e => {
      if (e.key.toLowerCase() !== "b" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
      on = !on;
      Game.Notify("Auto Buyer", on ? "ON" : "OFF", [16, 5], 2);
    });

    Game.registerHook("logic", function() {
      if (!on || Game.T % 15 !== 0) return;

      let best = null, bestRatio = 0;

      // Buildings: CPS from one more building / price
      for (const b of Game.ObjectsById) {
        if (b.locked) continue;
        const ratio = b.storedCps * Game.globalCpsMult / b.price;
        if (ratio > bestRatio) { bestRatio = ratio; best = b; }
      }

      // Upgrades: simulate buying, measure the CPS change, then undo
      const base = Game.cookiesPs;
      for (const u of Game.UpgradesInStore) {
        if (u.pool === "toggle" || u.pool === "debug") continue;
        u.bought = 1;
        Game.CalculateGains();
        const gain = Game.cookiesPs - base;
        u.bought = 0;
        if (gain <= 0) continue;
        const ratio = gain / u.getPrice();
        if (ratio > bestRatio) { bestRatio = ratio; best = u; }
      }
      Game.CalculateGains(); // restore real values

      if (!best) return;
      const price = best.getPrice ? best.getPrice() : best.price;
      if (Game.cookies >= price) best.buy(best instanceof Game.Object ? 1 : undefined);
    });

    Game.Notify("Auto Buyer loaded", "Press B to toggle.", [16, 5]);
  },
  save: function() { return ""; },
  load: function() {}
});
