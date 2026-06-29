# 🗺️ Plans / Roadmap

Tracking what's done and what's next for Party Games (web).

## ✅ Done
- [x] **Charades / Heads Up** — tilt (devicemotion) + tap zones + keyboard controls.
- [x] **Imposter** — pass-and-play role reveal, discussion, reveal.
- [x] **Spin the Wheel** — spin to land on a random word from any category.
- [x] **Retire-used-words flag** — toggle per session; rolled words are removed from a
      list until you refresh it. Tracked per category, persisted to `localStorage`.
      Wired into all three games + a "Refresh" / "no words left" flow.
- [x] **Lots of word lists** — 14 generated categories + 10 hand-authored ones
      (Sports, Countries, Superheroes, Disney, Emotions, Fruits & Veggies, Space,
      Mythical Creatures, Vehicles, Holidays) in `js/extra-data.js`.
- [x] **Custom lists** — create / edit / delete your own lists; they appear in every game.
- [x] **Sharing** — export a list to a copyable link (`#share=…`) or code; import by paste
      or by opening a shared link.
- [x] **Upvote / downvote** — vote on custom & imported lists (device-local for now).

## 🔜 Next
- [ ] **Real backend for community lists** — the upvote/downvote + sharing is currently
      `localStorage`-only, so votes don't sync between people. Add a lightweight API
      (e.g. Supabase / Firebase / a tiny serverless KV) so shared lists and their vote
      counts are global. Needs: submit list, browse/sort by score, one-vote-per-user.
- [ ] **Moderation / reporting** for community-submitted lists.
- [ ] **Spin the Wheel modes** — dare/penalty mode, team mode, "remove segment on land"
      animation polish.
- [ ] **Imposter tweaks** — multiple imposters, optional category hint for the imposter,
      score across rounds.
- [ ] **Charades** — per-category time recommendations, "act it out" timer presets.
- [ ] **PWA** — offline install, app icon, service worker.
- [ ] **i18n** — multi-language word packs.

## 🧱 Architecture notes
- Framework-free ES modules; no build step.
- `js/data.js` is auto-generated — do **not** hand-edit. Manual lists go in `js/extra-data.js`.
- All persistent state (settings, used words, custom lists, votes) is centralized in
  `js/store.js`.
