# Cookie Auto Buyer

A Cookie Clicker mod that automatically buys whichever building or upgrade gives the most CPS per cookie spent. Toggle it with the **B** key.

## Features
- Ranks buildings and upgrades by CPS gained per cookie spent
- Simulates each upgrade to measure its real CPS gain, including multipliers and synergies
- Saves up for the best option instead of buying worse ones
- Press **B** to turn it on or off
- No dependencies

## Install

### Browser version
1. Open Cookie Clicker and press F12 to open the console.
2. Paste this and press Enter (replace `Kiek10`):
   ```javascript
   Game.LoadMod("https://cdn.jsdelivr.net/gh/Kiek10/cookie-auto-buyer@main/main.js");
   ```

### Steam version
1. Copy this folder into `Cookie Clicker/resources/app/mods/local/`.
2. Launch the game and go to Options → Mods.
3. Enable **Auto Buyer** and restart if prompted.

## Usage
Press **B** in game. A notification shows whether it is ON or OFF.

## Notes
- Upgrades that only boost clicking or golden cookies show no CPS gain, so they are never bought.
- Using an auto-buyer can interfere with some achievements. Avoid it on a save you care about.
- Change `"b"` in `main.js` to use a different key.

## License
MIT
