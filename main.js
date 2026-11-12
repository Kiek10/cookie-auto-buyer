(function() {
  // If an earlier copy of this mod is already running, switch it off
  if (window.__autoBuyer) {
    window.__autoBuyer.dead = true;
    document.removeEventListener("keydown", window.__autoBuyer.keyHandler, true);
  }

  const VERSION = "3.1";

  // ---- Settings you can edit ----
  const CONFIG = {
    checkEveryTicks: 15,   // 30 ticks = 1 second
    reserveSeconds: 0,     // keep this many seconds of CPS unspent
    maxBuysPerCheck: 3,
    buyBuildings: true,
    buyUpgrades: true
  };

  const MODES = {
    all:    "Best CPS overall (saves up)",
    afford: "Best CPS I can afford now",
    smart:  "Fastest payback (price + waiting time)"
  };
  const MODE_ORDER = ["all", "afford", "smart"];

  const mod = { on: false, mode: "all", target: null, dead: false };
  window.__autoBuyer = mod;

  function notify(title, text) {
    try { Game.Notify(title, text, [16, 5], 3); }
    catch (e) { console.log("[Auto Buyer]", title, text); }
  }

  mod.toggleOn = function() {
    mod.on = !mod.on;
    notify("Auto Buyer", mod.on ? "ON" : "OFF");
    if (Game.onMenu === "prefs") Game.UpdateMenu();
  };

  mod.cycleMode = function() {
    mod.mode = MODE_ORDER[(MODE_ORDER.indexOf(mod.mode) + 1) % MODE_ORDER.length];
    notify("Auto Buyer mode", MODES[mod.mode]);
    if (Game.onMenu === "prefs") Game.UpdateMenu();
  };

  // ---- Keybinds: B = on/off, N = change mode ----
  mod.keyHandler = function(e) {
    if (mod.dead) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.code === "KeyB") mod.toggleOn();
    else if (e.code === "KeyN") mod.cycleMode();
  };
  document.addEventListener("keydown", mod.keyHandler, true);

  // ---- Measure each purchase by simulating it, then undoing it ----
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
      Game.cookiesPsRawHighest = savedHighest;
      Game.CalculateGains();
    }
  }

  function pick(items, base) {
    const spendable = Game.cookies - CONFIG.reserveSeconds * base;
    const cps = Math.max(base, 0.1);
    let best = null, bestScore = -Infinity;
    for (const it of items) {
      if (mod.mode === "afford" && it.price > spendable) continue;
      const score = mod.mode === "smart"
        ? -(Math.max(0, it.price - spendable) / cps + it.price / it.gain)
        : it.gain / it.price;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best ? { best, spendable } : null;
  }

  Game.registerMod("auto_buyer", {
    init: function() {
      Game.registerHook("logic", function() {
        if (mod.dead || !mod.on || Game.T % CONFIG.checkEveryTicks !== 0) return;
        if (Game.OnAscend || Game.AscendTimer > 0 || Game.buyMode === -1) return;
        try {
          for (let i = 0; i < CONFIG.maxBuysPerCheck; i++) {
            const { items, base } = evaluate();
            const choice = pick(items, base);
            if (!choice) { mod.target = null; return; }
            const { best, spendable } = choice;
            mod.target = best.name + " (" + Beautify(best.price) + " cookies)";
            if (spendable < best.price) return; // saving up
            if (best.isBuilding) best.obj.buy(1); else best.obj.buy();
          }
        } catch (err) {
          console.error("[Auto Buyer]", err);
          mod.on = false;
          notify("Auto Buyer error", "Turned off. Check the console (F12).");
        }
      });

      Game.customOptionsMenu.push(function() {
        try {
          const menu = l("menu");
          const div = document.createElement("div");
          div.className = "subsection";
          div.innerHTML =
            '<div class="title">Auto Buyer v' + VERSION + '</div>' +
            '<div class="listing"><a class="option' + (mod.on ? '' : ' off') +
              '" onclick="window.__autoBuyer.toggleOn();">Auto Buyer ' + (mod.on ? 'ON' : 'OFF') +
              '</a><label>Hotkey: B</label></div>' +
            '<div class="listing"><a class="option" onclick="window.__autoBuyer.cycleMode();">Mode: ' +
              MODES[mod.mode] + '</a><label>Hotkey: N</label></div>' +
            '<div class="listing"><label>Next target: ' + (mod.target || "none") + '</label></div>';
          const subs = menu.querySelectorAll(".subsection");
          if (subs.length) subs[subs.length - 1].parentNode.insertBefore(div, subs[subs.length - 1]);
          else menu.appendChild(div);
        } catch (err) { console.error("[Auto Buyer] menu error:", err); }
      });

      notify("Auto Buyer v" + VERSION + " loaded", "B = on/off, N = change mode");
    },
    save: function() { return JSON.stringify({ mode: mod.mode }); },
    load: function(str) {
      try {
        const d = JSON.parse(str);
        if (d && MODES[d.mode]) mod.mode = d.mode;
      } catch (e) { if (MODES[str]) mod.mode = str; }
    }
  });
})();
