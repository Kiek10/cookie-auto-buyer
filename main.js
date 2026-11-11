
Game.registerMod("auto_buyer", {
  init: function () {
    const mod = this;

    // =====================================
    // CONFIGURATION
    // =====================================

    const CONFIG = {
      checkEveryTicks: 15,
      reserveSeconds: 0,
      maxBuysPerCheck: 3,
      buyBuildings: true,
      buyUpgrades: true
    };

    const MODES = {
      all: "Best CPS overall (saves up)",
      afford: "Best CPS I can afford",
      smart: "Fastest payback"
    };

    const MODE_ORDER = ["all", "afford", "smart"];

    mod.on = false;
    mod.mode = MODE_ORDER.includes(mod.mode) ? mod.mode : "all";
    mod.target = null;

    // =====================================
    // MODE MANAGEMENT
    // =====================================

    mod.cycleMode = function () {
      const current = MODE_ORDER.indexOf(mod.mode);
      mod.mode = MODE_ORDER[(current + 1) % MODE_ORDER.length];

      Game.Notify(
        "Auto Buyer Mode",
        MODES[mod.mode],
        [16, 5],
        3
      );

      if (Game.onMenu === "prefs") Game.UpdateMenu();
    };

    mod.toggleOn = function () {
      mod.on = !mod.on;

      Game.Notify(
        "Auto Buyer",
        mod.on ? "ON" : "OFF",
        [16, 5],
        2
      );

      if (Game.onMenu === "prefs") Game.UpdateMenu();
    };

    // =====================================
    // KEYBOARD CONTROLS
    // =====================================

    if (mod.keyHandler) {
      document.removeEventListener(
        "keydown",
        mod.keyHandler,
        true
      );
    }

    mod.keyHandler = function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target;

      if (
        target &&
        target.closest &&
        target.closest(
          "input, textarea, select, [contenteditable='true']"
        )
      ) return;

      if (e.code === "KeyB") {
        e.preventDefault();
        e.stopPropagation();
        mod.toggleOn();
      }

      else if (e.code === "KeyN") {
        e.preventDefault();
        e.stopPropagation();

        mod.cycleMode();

        Game.Popup(
          "Auto Buyer: " + MODES[mod.mode],
          Game.mouseX,
          Game.mouseY
        );
      }
    };

    document.addEventListener(
      "keydown",
      mod.keyHandler,
      true
    );

    // =====================================
    // PURCHASE EVALUATION
    // =====================================

    function evaluate() {
      const items = [];
      const savedHighest = Game.cookiesPsRawHighest;

      try {
        Game.CalculateGains();

        const base = Game.cookiesPs;

        // BUILDINGS
        if (CONFIG.buyBuildings) {
          for (const b of Game.ObjectsById) {
            if (b.locked) continue;

            const originalAmount = b.amount;

            try {
              const price = b.getPrice();

              if (!Number.isFinite(price) || price <= 0) continue;

              b.amount = originalAmount + 1;
              Game.CalculateGains();

              const gain = Game.cookiesPs - base;

              if (gain > 0 && Number.isFinite(gain)) {
                items.push({
                  obj: b,
                  isBuilding: true,
                  name: b.name,
                  price: price,
                  gain: gain
                });
              }
            } catch (err) {
              console.warn("Building evaluation error:", err);
            } finally {
              b.amount = originalAmount;
              Game.CalculateGains();
            }
          }
        }

        // UPGRADES
        if (CONFIG.buyUpgrades) {
          for (const u of Game.UpgradesInStore) {
            if (
              u.pool === "toggle" ||
              u.pool === "debug" ||
              u.bought
            ) continue;

            const originalBought = u.bought;

            try {
              const price = u.getPrice();

              if (!Number.isFinite(price) || price <= 0) continue;

              u.bought = 1;
              Game.CalculateGains();

              const gain = Game.cookiesPs - base;

              if (gain > 0 && Number.isFinite(gain)) {
                items.push({
                  obj: u,
                  isBuilding: false,
                  name: u.name,
                  price: price,
                  gain: gain
                });
              }
            } catch (err) {
              console.warn("Upgrade evaluation error:", err);
            } finally {
              u.bought = originalBought;
              Game.CalculateGains();
            }
          }
        }

        return { items, base };

      } finally {
        Game.cookiesPsRawHighest = savedHighest;
        Game.CalculateGains();
      }
    }

    // =====================================
    // PURCHASE SELECTION
    // =====================================

    function pick(items, base) {
      const spendable =
        Game.cookies - CONFIG.reserveSeconds * base;

      const cps = Math.max(base, 0.1);

      let best = null;
      let bestScore = -Infinity;

      for (const item of items) {
        if (
          mod.mode === "afford" &&
          item.price > spendable
        ) continue;

        let score;

        if (mod.mode === "smart") {
          const waitingTime =
            Math.max(0, item.price - spendable) / cps;

          const paybackTime =
            item.price / item.gain;

          score = -(waitingTime + paybackTime);
        } else {
          score = item.gain / item.price;
        }

        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }

      return best ? { best, spendable } : null;
    }

    // =====================================
    // AUTOMATIC BUYING
    // =====================================

    Game.registerHook("logic", function () {
      if (!mod.on) return;

      if (Game.T % CONFIG.checkEveryTicks !== 0) return;

      if (Game.OnAscend || Game.AscendTimer > 0) return;

      if (Game.buyMode === -1) return;

      try {
        for (let i = 0; i < CONFIG.maxBuysPerCheck; i++) {
          const result = evaluate();

          if (!result || !result.items.length) {
            mod.target = null;
            return;
          }

          const choice = pick(result.items, result.base);

          if (!choice) {
            mod.target = null;
            return;
          }

          const { best, spendable } = choice;

          mod.target =
            best.name +
            " (" + Beautify(best.price) + " cookies)";

          if (spendable < best.price) return;

          if (best.isBuilding) {
            best.obj.buy(1);
          } else {
            best.obj.buy();
          }
        }

      } catch (err) {
        console.error("Auto Buyer error:", err);
      }
    });

// =====================================
// KEYBOARD CONTROLS
// =====================================

mod.keyHandler = function (e) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

  if (
    e.target &&
    e.target.closest &&
    e.target.closest("input, textarea, select, [contenteditable]")
  ) return;

  if (e.key.toLowerCase() === "b") {
    e.preventDefault();
    mod.toggleOn();
  }

  else if (e.key.toLowerCase() === "n") {
    e.preventDefault();
    mod.cycleMode();
  }
};

window.addEventListener("keydown", mod.keyHandler, true);

    // =====================================
    // LOAD NOTIFICATION
    // =====================================

    Game.Notify(
      "Auto Buyer Loaded",
      "B = ON/OFF | N = Change Mode",
      [16, 5],
      5
    );
  },

  // =====================================
  // SAVE AND LOAD
  // =====================================

  save: function () {
    return JSON.stringify({
      mode: this.mode
    });
  },

  load: function (str) {
    try {
      const data = JSON.parse(str);

      if (
        data &&
        ["all", "afford", "smart"].includes(data.mode)
      ) {
        this.mode = data.mode;
      }

    } catch (err) {
      if (["all", "afford", "smart"].includes(str)) {
        this.mode = str;
      }
    }
  }
});
