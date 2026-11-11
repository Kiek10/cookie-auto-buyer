Game.registerMod("auto_buyer", {
  init: function() {
    const mod = this;
    mod.on = false;
    mod.mode = "all"; // "all" = best CPS overall (saves up), "afford" = best CPS you can afford now

    const modeText = () =>
      mod.mode === "all" ? "Best CPS overall (saves up)" : "Best CPS I can afford";

    const toggleMode = () => {
      mod.mode = mod.mode === "all" ? "afford" : "all";
      Game.Notify("Auto Buyer mode", modeText(), [16, 5], 3);
      if (Game.onMenu === "prefs") Game.UpdateMenu();
    };

    // Keybinds: B = on/off, N = change mode
    document.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "b") {
        mod.on = !mod.on;
        Game.Notify("Auto Buyer", mod.on ? "ON" : "OFF", [16, 5], 2);
      } else if (k === "n") {
        toggleMode();
      }
    });

    // Options menu entry
    mod.toggleMode = toggleMode;
    mod.modeText = modeText;
    Game.customOptionsMenu.push(function() {
      const menu = l("menu").childNodes[2];
      const div = document.createElement("div");
      div.className = "listing";
      div.innerHTML =
        '<a class="option" onclick="Game.mods[\'auto_buyer\'].toggleMode();">Auto Buyer mode</a>' +
        '<label>' + modeText() + ' (key: N, on/off: B)</label>';
      menu.insertBefore(div, menu.childNodes[menu.childNodes.length - 1]);
    });

    Game.registerHook("logic", function() {
      if (!mod.on || Game.T % 15 !== 0) return;

      const affordOnly = mod.mode === "afford";
      let best = null, bestRatio = 0, bestIsBuilding = false;

      // Buildings: CPS from one more building / price
      for (const b of Game.ObjectsById) {
        if (b.locked) continue;
        if (affordOnly && b.price > Game.cookies) continue;
        const ratio = b.storedCps * Game.globalCpsMult / b.price;
        if (ratio > bestRatio) { bestRatio = ratio; best = b; bestIsBuilding = true; }
      }

      // Upgrades: simulate buying, measure the CPS change, then undo
      const base = Game.cookiesPs;
      for (const u of Game.UpgradesInStore) {
        if (u.pool === "toggle" || u.pool === "debug") continue;
        const price = u.getPrice();
        if (affordOnly && price > Game.cookies) continue;
        u.bought = 1;
        Game.CalculateGains();
        const gain = Game.cookiesPs - base;
        u.bought = 0;
        if (gain <= 0) continue;
        const ratio = gain / price;
        if (ratio > bestRatio) { bestRatio = ratio; best = u; bestIsBuilding = false; }
      }
      Game.CalculateGains(); // restore real values

      if (!best) return;
      const cost = bestIsBuilding ? best.price : best.getPrice();
      if (Game.cookies >= cost) {
        if (bestIsBuilding) best.buy(1); else best.buy();
      }
    });

    Game.Notify("Auto Buyer loaded", "B = on/off, N = change mode", [16, 5]);
  },
  save: function() { return this.mode; },
  load: function(str) { if (str === "all" || str === "afford") this.mode = str; }
});
