# 🎉 Party Games — Web Edition

Framework-free party games that run in any browser, on phones and laptops. No install.

## 🎮 Games
- 🙆 **Charades / Heads Up** — guess the word on your forehead. Tilt up = correct, down = pass (or tap top/bottom, or ↑/↓ keys).
- 🕵️ **Imposter** — pass-and-play; everyone sees the word except one random imposter.
- 🎡 **Spin the Wheel** — spin and land on a random word from any category.

Plus **♻️ Retire used words** (toggle on every game): words you roll are removed from the
list until you hit **Refresh**, so you don't repeat. And **📝 Custom Lists**: make your own
lists, share them by link/code, and upvote/downvote.

## 🚀 Run it
Pure static files served over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, GitHub Pages, Netlify, Vercel…).

> Tilt/motion controls need **HTTPS or `localhost`**. On iOS, tap *Enable tilt controls* to grant the motion permission.

## 🗂️ Structure
```
index.html        # shell
styles.css        # all styling (responsive, safe-area aware)
js/
├── app.js        # router + all game logic & screens
├── store.js      # settings, used-word tracking, custom lists, sharing, votes
├── data.js       # generated categories + word pool (do not hand-edit)
└── extra-data.js # hand-authored extra word lists
```

## ✏️ Add word lists
- **By hand (ships with the app):** add a category to `extraCategories` in `js/extra-data.js`
  (`{ name, emoji, primary, secondary, words: [...] }`).
- **In the app:** main menu → *Custom Lists & Community* → **New list**.

> ⚠️ Sharing and votes are **device-local** — a real online community backend is on the
> roadmap. See [PLANS.md](PLANS.md).

## 🔄 Regenerating `data.js`
```bash
python3 convert_data.py   # from the repo root (parent of this folder)
```

---
Made with ❤️ — original game by Vitgrub Studios.
