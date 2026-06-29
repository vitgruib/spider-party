# 🕷️ Spider-Party

Free party games that run in any browser, on phones and laptops. No install, no signup.

**Play:** https://vitgruib.github.io/party-web/

## 🎮 Games
- 🎭 **Charades / Heads Up** — guess the word on your forehead. Tap the right half = correct, left half = pass (or →/← / Space). No tilt needed.
- 🕵️ **Imposter** — single-device pass-and-play; everyone sees the word except one random imposter, then give clues in turn and vote.
- 🎡 **Spin the Wheel** — spin and land on a random word from any category.
- 🎚️ **Wavelength** — a hidden target on a spectrum; the Psychic gives a clue, everyone guesses the dial, score 4/3/2. Solo or alternating teams.

Plus **♻️ Retire used words** (toggle on every game): words you roll are removed until you
hit **Refresh**, so you don't repeat. And **📝 Custom Lists**: make your own word lists
(stored on your device) that show up as a category in every game.

## 🚀 Run it locally
Pure static files served over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, GitHub Pages, Netlify…).

## 🌐 Deploy
Hosted on **GitHub Pages** from `main` / root — pushing to `main` auto-deploys.
`.nojekyll` makes the files serve as-is.

## 🗂️ Structure
```
index.html        # shell
styles.css        # all styling (responsive, safe-area aware)
js/
├── app.js        # router + all game logic & screens
├── store.js      # settings, used-word tracking, custom lists, curated category set
├── data.js       # generated categories + word pool (do not hand-edit)
└── extra-data.js # hand-authored extra word lists + Wavelength spectrums
```

## ✏️ Add word lists
- **Ship with the app:** add a category to `extraCategories` in `js/extra-data.js`, then list
  its name in `CURATED` in `js/store.js` so it appears (`{ name, emoji, primary, secondary, words }`).
- **In the app:** main menu → **Custom Lists** → **New list** (saved on your device).

## 🔄 Regenerating `data.js`
```bash
python3 convert_data.py   # from the repo root (parent of this folder)
```

---
Made with ❤️ — original game by Vitgrub Studios.
