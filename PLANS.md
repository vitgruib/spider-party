# 🗺️ Plans / Roadmap

Tracking what's done and what's next for Spider-Party (web).

## ✅ Done
- [x] **Charades / Heads Up** — left/right tap (no tilt) + keyboard controls.
- [x] **Imposter** — single-device pass-around role reveal; clue rounds in turn order.
- [x] **Spin the Wheel** — spin to land on a random word; radial labels.
- [x] **Wavelength** — hidden spectrum, psychic clue, dial guess, 4/3/2 scoring.
- [x] **Retire-used-words flag** — toggle per session; rolled words are removed from a
      list until you refresh it. Tracked per category, persisted to `localStorage`.
- [x] **Curated word lists** — mainstream category set (incl. Colleges, Japanese Foods).
- [x] **Custom lists** — create / edit / delete / preview your own lists (local-only);
      they appear as a category in every game.
- [x] **Bug / suggestion reports** — email, GitHub issue, or copy, with auto diagnostics.

## 🔜 Next
- [ ] **Spin the Wheel modes** — dare/penalty mode, team mode, "remove segment on land".
- [ ] **Imposter tweaks** — multiple imposters, optional category hint, score across rounds.
- [ ] **Charades** — per-category time recommendations, "act it out" timer presets.
- [ ] **Wavelength** — team turns and score-to-win target.
- [ ] **PWA** — offline install, app icon, service worker.
- [ ] **i18n** — multi-language word packs.

## 🧱 Architecture notes
- Framework-free ES modules; no build step.
- `js/data.js` is auto-generated — do **not** hand-edit. Manual lists go in `js/extra-data.js`;
  the visible category set is curated in `js/store.js` (`CURATED`).
- All persistent state (settings, used words, custom lists) is centralized in `js/store.js`.
