# 🕷️ Spider-Party

Free party games that run in any browser, on phones and laptops. No install, no signup.

**Play:** https://vitgruib.github.io/spider-party/

## 🎯 Why Spider-Party
Spider-Party is an attempt to make party games **genuinely accessible and free for everyone**.

Most party games put up barriers: you have to buy a card deck, download an app, make an
account, sit through ads, or pay to unlock the "full" set of cards. That's friction at exactly
the moment you want it least — when friends are already together and ready to play.

Spider-Party removes all of it:
- **Free, forever** — no purchase, no paywalled packs, no ads.
- **Nothing to install** — it runs in any browser. Share a link (or scan a code) and everyone's in.
- **No accounts, no tracking** — open it and play; your settings and custom lists stay on your device.
- **Works on the cheapest phone or any laptop** — lightweight, no app store, no big download.
- **Open source** — anyone can read it, run it, fork it, or contribute word lists and ideas.

The goal is simple: if you have a group of friends and any device with a browser, you should be
able to start a party game in seconds, for free.



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
