Game.registerMod("auto_buyer", {
  init: function() {
    const mod = this;

    // ---- Settings you can edit ----
    const CONFIG = {
      checkEveryTicks: 15,   // 30 ticks = 1 second
      reserveSeconds: 0,     // keep this many seconds of CPS unspent (e.g. 900 for golden cookie combos)
      maxBuysPerCheck: 3,    // how many purchases it can make per check
      buyBuildings: true,
      buyUpgrades: true
    };

    const MODES = {
      all:    "Best CPS overall (saves up)",
      afford: "Best CPS I can afford now",
      smart:  "Fastest payback (price + waiting time)"
    };
    const MODE_ORDER = ["all", "afford", "smart"];

    mod.on = false;
    mod.mode = "all";
    mod.target = null;

    // Measure the CPS gain of every purchase by simulating it, then undoing it.
    // This counts all upgrades you own, synergies and multipliers.
    function evaluate() {
      const items = [];
      const savedHighest = Game.cookiesPsRawHighest;
      try {
        Game.CalculateGains();
        const base = Game.cookiesPs;

        if (CONFIG.buyBuildings) {
          for (const b of Game.ObjectsById) {
            if (b.locked) continue;
            const price = b.getPrice();
            b.amount++;
            Game.CalculateGains();
            const gain = Game.cookiesPs - base;
            b.amount--;
            if (gain > 0) items.push({ obj: b, isBuilding: true, name: b.name, price, gain });
          }
        }

        if (CONFIG.buyUpgrades) {
          for (const u of Game.UpgradesInStore) {
            if (u.pool === "toggle" || u.pool === "debug") continue;
            const price = u.getPrice();
            u.bought = 1;
            Game.CalculateGains();
            const gain = Game.cookiesPs - base;
            u.bought = 0;
            if (gain > 0) items.push({ obj: u, isBuilding: false, name: u.name, price, gain });
          }
        }
        return { items, base };
      } finally {
        Game.cookiesPsRawHighest = savedHighest; // don't let simulations inflate the game's records
        Game.CalculateGains();                   // restore the real values
      }
    }

    // Choose the best purchase according to the current mode.
    function pick(items, base) {
      const spendable = Game.cookies - CONFIG.reserveSeconds * base;
      const cps = Math.max(base, 0.1);
      let best = null, bestScore = -Infinity;

      for (const it of items) {
        if (mod.mode === "afford" && it.price > spendable) continue;
        let score;
        if (mod.mode === "smart") {
          // lower total time (waiting + paying itself back) is better
          score = -(Math.max(0, it.price - spendable) / cps + it.price / it.gain);
        } else {
          score = it.gain / it.price; // CPS gained per cookie spent
        }
        if (score > bestScore) { bestScore = score; best = it; }
      }
      return best ? { best, spendable } : null;
    }

    Game.registerHook("logic", function() {
      if (!mod.on || Game.T % CONFIG.checkEveryTicks !== 0) return;
      if (Game.OnAscend || Game.AscendTimer > 0) return; // not while ascending
      if (Game.buyMode === -1) return;                   // sell mode would SELL buildings

      for (let i = 0; i < CONFIG.maxBuysPerCheck; i++) {
        const { items, base } = evaluate();
        const choice = pick(items, base);
        if (!choice) { mod.target = null; return; }

        const { best, spendable } = choice;
        mod.target = best.name + " (" + Beautify(best.price) + " cookies)";
        if (spendable < best.price) return; // saving up for it

        if (best.isBuilding) best.obj.buy(1); else best.obj.buy();
      }
    });

    // ---- Controls ----
    mod.toggleOn = function() {
      mod.on = !mod.on;
      Game.Notify("Auto Buyer", mod.on ? "ON" : "OFF", [16, 5], 2);
      if (Game.onMenu === "prefs") Game.UpdateMenu();
    };

    mod.cycleMode = function() {
      mod.mode = MODE_ORDER[(MODE_ORDER.indexOf(mod.mode) + 1) % MODE_ORDER.length];
      Game.Notify("Auto Buyer mode", MODES[mod.mode], [16, 5], 3);
      if (Game.onMenu === "prefs") Game.UpdateMenu();
    };

    document.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "b") mod.toggleOn();
      else if (k === "n") mod.cycleMode();
    });

    // ---- Options menu ----
    Game.customOptionsMenu.push(function() {
      try {
        const menu = l("menu");
        const div = document.createElement("div");
        div.className = "subsection";
        div.innerHTML =
          '<div class="title">Auto Buyer</div>' +
          '<div class="listing"><a class="option' + (mod.on ? '' : ' off') +
            '" onclick="Game.mods[\'auto_buyer\'].toggleOn();">Auto Buyer ' + (mod.on ? 'ON' : 'OFF') +
            '</a><label>Hotkey: B</label></div>' +
          '<div class="listing"><a class="option" onclick="Game.mods[\'auto_buyer\'].cycleMode();">Mode: ' +
            MODES[mod.mode] + '</a><label>Hotkey: N</label></div>' +
          '<div class="listing"><label>Next target: ' + (mod.target || "none") + '</label></div>';
        const subs = menu.querySelectorAll(".subsection");
        if (subs.length) subs[subs.length - 1].parentNode.insertBefore(div, subs[subs.length - 1]);
        else menu.appendChild(div);
      } catch (err) { console.error("Auto Buyer menu error:", err); }
    });

    Game.Notify("Auto Buyer loaded", "B = on/off, N = change mode", [16, 5]);
  },

  save: function() { return JSON.stringify({ mode: this.mode }); },
  load: function(str) {
    try {
      const d = JSON.parse(str);
      if (d && ["all", "afford", "smart"].includes(d.mode)) this.mode = d.mode;
    } catch (e) {
      if (["all", "afford", "smart"].includes(str)) this.mode = str; // old save format
    }
  }
});
