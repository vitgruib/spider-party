// ============================================================
//  Party Games - web port of the Flutter app by Vitgrub Studios
//  Games: Charades (Heads Up, tilt support), Imposter, Spin the Wheel
//  Works on phones (tilt + tap) and laptops (tap + keyboard).
//  Shared word lists + custom lists live in store.js.
// ============================================================
import {
  getCategories, getCustomLists, saveCustomList, deleteCustomList,
  getRetire, setRetire, availableWords, markUsed, refreshUsed,
  voteList, decodeList, importList, shareUrl, encodeList,
} from './store.js';

// ---------- Game settings (mirrors theme.dart GameSettings) ----------
const SETTINGS = {
  defaultDuration: 60,
  feedbackDelayMs: 800,
  countdownSeconds: 3,
  timeOptions: [30, 45, 60, 90, 120],
  pointsPerCorrect: 1,
  pointsPerSkip: 0,
  triggerAngle: 60,
  neutralAngle: 30,
};

const FEEDBACK_FORM = 'https://forms.gle/yC7SvG9SeS1nLwmS6';

// ---------- Tiny DOM helpers ----------
const $app = document.getElementById('app');

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function mount(node) { $app.innerHTML = ''; $app.appendChild(node); window.scrollTo(0, 0); }
function on(node, selector, event, handler) {
  node.querySelectorAll(selector).forEach((n) => n.addEventListener(event, handler));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const grad = (a) => a; // flat solid fills
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const randInt = (n) => (Math.random() * n) | 0;

function vibrate(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ } }

let _wakeLock = null;
async function requestWakeLock() { try { if ('wakeLock' in navigator) _wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ } }
function releaseWakeLock() { try { _wakeLock?.release(); _wakeLock = null; } catch { /* ignore */ } }

function toast(msg, ms = 2200) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = el(`<textarea style="position:fixed;opacity:0"></textarea>`);
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}

// ---------- Icons: Google Material Symbols (Rounded) — one homogeneous set ----------
const UI_ICONS = {
  back: 'arrow_back', close: 'close', info: 'info', refresh: 'refresh',
  share: 'ios_share', edit: 'edit', trash: 'delete',
  up: 'keyboard_arrow_up', down: 'keyboard_arrow_down', check: 'check',
  lock: 'lock', plus: 'add', preview: 'visibility',
};
function icon(name, size = 20) {
  return `<span class="ms" style="font-size:${size}px">${UI_ICONS[name] || name}</span>`;
}

// Category name -> Material Symbol. Unknown names (custom lists) fall back to a list glyph.
const CAT_ICONS = {
  'Movies & TV': 'movie', 'Video Games': 'sports_esports', 'Music (Artist — Song)': 'music_note',
  'Animals': 'pets', 'Food & Drinks': 'restaurant', 'Brands': 'sell', 'Objects': 'category',
  'Actions': 'directions_run', 'Anime': 'animation', 'Jobs & Professions': 'work',
  'School Subjects': 'school', 'Instruments': 'piano', 'Landmarks': 'account_balance',
  'Everything': 'all_inclusive', 'Sports': 'sports_basketball', 'Countries': 'public',
  'Superheroes': 'bolt', 'Disney': 'castle', 'Emotions': 'mood', 'Fruits & Veggies': 'nutrition',
  'Space': 'rocket_launch', 'Mythical Creatures': 'auto_awesome', 'Vehicles': 'directions_car',
  'Holidays': 'celebration',
};
function catSymbol(name) { return CAT_ICONS[name] || 'label'; }

/** Coloured square holding a Material Symbol icon (category / game "icon"). */
function badge(symbol, color, sm = false) {
  return `<span class="mono ${sm ? 'mono-sm' : ''}" style="background:${color}"><span class="ms">${symbol}</span></span>`;
}

// ---------- Modal helper ----------
function openModal(innerHtml, { center = false } = {}) {
  const backdrop = el(`<div class="modal-backdrop ${center ? 'center' : ''}"></div>`);
  backdrop.innerHTML = innerHtml;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(backdrop); });
  document.body.appendChild(backdrop);
  return backdrop;
}
function closeModal(node) { node?.remove(); }

// ---------- Shared: retire-used-words toggle ----------
function retireBar() {
  return `
    <div class="panel toggle-row mb12 pressable" id="retire-row">
      <div class="grow">
        <div style="font-weight:600">Retire used words</div>
        <div class="muted" style="font-size:12px">Rolled words are removed until you refresh the list</div>
      </div>
      <div class="switch ${getRetire() ? 'on' : ''}" id="retire-sw"><div class="knob"></div></div>
    </div>`;
}
function wireRetire(node) {
  on(node, '#retire-row', 'click', () => {
    setRetire(!getRetire());
    node.querySelector('#retire-sw').classList.toggle('on', getRetire());
  });
}
function countLabel(c) {
  const total = c.words.length;
  const avail = availableWords(c).length;
  return getRetire() && avail !== total ? `${avail} / ${total} left` : `${total} words`;
}

// ---------- Shared: category selection via a searchable picker ----------
function resolveCat(id) {
  const cats = getCategories();
  return cats.find((c) => c.id === id) || cats[0];
}

/** Compact "selected category" field with a preview button; opens the picker. */
function categoryField(cat) {
  return `
    <div class="panel-title">CATEGORY</div>
    <div class="select-field pressable mb24" id="catfield">
      ${badge(catSymbol(cat.name), cat.primary, true)}
      <div class="grow">
        <div style="font-weight:600">${esc(cat.name)}</div>
        <div class="muted2" style="font-size:12px">${countLabel(cat)}</div>
      </div>
      <button class="icon-btn" id="catpreview" title="Preview words">${icon('preview', 18)}</button>
      <span class="chev">${icon('down', 18)}</span>
    </div>`;
}

/** Wire the category field + its preview button on a setup screen. */
function wireCategoryField(node, getId, onPick) {
  on(node, '#catfield', 'click', () => openCategoryPicker(getId(), onPick));
  on(node, '#catpreview', 'click', (e) => { e.stopPropagation(); wordPreviewModal(resolveCat(getId())); });
}

/** Bottom-sheet listing every word in a category. */
function wordPreviewModal(cat) {
  const backdrop = openModal(`
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="row mb8 gap8">
        ${badge(catSymbol(cat.name), cat.primary, true)}
        <h2 style="margin:0;font-size:18px">${esc(cat.name)}</h2>
        <div class="spacer"></div>
        <button class="icon-btn" id="x">${icon('close')}</button>
      </div>
      <div class="muted2 mb12" style="font-size:12px">${cat.words.length} words</div>
      <div class="word-cloud">
        ${cat.words.map((w) => `<span class="word-chip">${esc(w)}</span>`).join('')}
      </div>
    </div>`);
  backdrop.querySelector('#x').onclick = () => closeModal(backdrop);
}

/** Bottom-sheet picker with a search box; calls onPick(id) on choose. */
function openCategoryPicker(currentId, onPick) {
  const cats = getCategories();
  const backdrop = openModal(`
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="row mb12"><h2 style="margin:0;font-size:18px">Choose a category</h2><div class="spacer"></div><button class="icon-btn" id="x">${icon('close')}</button></div>
      <input class="input mb12" id="catsearch" placeholder="Search categories…" autocomplete="off" />
      <div class="picker-list" id="plist"></div>
    </div>`);
  const listEl = backdrop.querySelector('#plist');
  const searchEl = backdrop.querySelector('#catsearch');

  function draw(filter) {
    const f = filter.trim().toLowerCase();
    const shown = cats.filter((c) => c.name.toLowerCase().includes(f));
    listEl.innerHTML = shown.length
      ? shown.map((c) => `
          <div class="picker-row pressable ${c.id === currentId ? 'sel' : ''}" data-id="${c.id}">
            ${badge(catSymbol(c.name), c.primary, true)}
            <div class="grow"><div>${esc(c.name)}</div><div class="muted2" style="font-size:12px">${countLabel(c)}</div></div>
            <button class="icon-btn row-preview" data-id="${c.id}" title="Preview words">${icon('preview', 16)}</button>
            ${c.id === currentId ? icon('check', 18) : ''}
          </div>`).join('')
      : '<div class="muted tcenter" style="padding:20px">No matches</div>';
  }

  listEl.addEventListener('click', (e) => {
    const prev = e.target.closest('.row-preview');
    if (prev) { e.stopPropagation(); wordPreviewModal(resolveCat(prev.dataset.id)); return; }
    const row = e.target.closest('.picker-row');
    if (!row) return;
    closeModal(backdrop);
    onPick(row.dataset.id);
  });
  searchEl.addEventListener('input', () => draw(searchEl.value));
  backdrop.querySelector('#x').onclick = () => closeModal(backdrop);
  draw('');
  setTimeout(() => searchEl.focus(), 50);
}

// ============================================================
//  MAIN MENU
// ============================================================
const GAMES = [
  { title: 'Charades', subtitle: 'Guess the word on your forehead', color: '#c0392b', symbol: 'theater_comedy', open: headsUpCategoryScreen },
  { title: 'Imposter', subtitle: 'Find the fake among you', color: '#7d3c98', symbol: 'person_search', open: imposterSetupScreen },
  { title: 'Spin the Wheel', subtitle: 'Spin and land on a random word', color: '#2471a3', symbol: 'casino', open: spinWheelSetupScreen },
];

function mainMenu() {
  releaseWakeLock();
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="title-block">
          <div class="title-grad">Party Games</div>
          <div class="title-sub">Choose your game</div>
        </div>
        <div id="game-list">
          ${GAMES.map((g, i) => `
            <div class="game-card pressable" data-i="${i}">
              ${badge(g.symbol, g.color)}
              <div class="grow">
                <div class="ttl">${esc(g.title)}</div>
                <div class="sub">${esc(g.subtitle)}</div>
              </div>
              <div class="arrow">&rsaquo;</div>
            </div>`).join('')}
          <div class="game-card pressable" id="lists-card">
            ${badge('format_list_bulleted', '#5d6d7e')}
            <div class="grow">
              <div class="ttl">Custom Lists &amp; Community</div>
              <div class="sub">Make your own word lists &amp; vote on shared ones</div>
            </div>
            <div class="arrow">&rsaquo;</div>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="credits-link" id="credits">Credits &amp; Feedback</div>
      </div>
    </div>`);
  on(node, '.game-card[data-i]', 'click', (e) => GAMES[+e.currentTarget.dataset.i].open());
  on(node, '#lists-card', 'click', listsScreen);
  on(node, '#credits', 'click', creditsScreen);
  mount(node);
}

// ============================================================
//  CREDITS
// ============================================================
function creditsScreen() {
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <h1>Credits &amp; Notes</h1>
        </div>
        <div class="scroll" style="flex:1">
          <div class="panel" style="line-height:1.6;color:var(--text)">
            Thanks for playing! Feedback is very much appreciated. Please suggest any cool games you
            think would be fun to play with your friends, or improvements to the general game.
            I'll try my best to implement ASAP. Thanks to all my closed testers.
          </div>
          <div class="tcenter muted mt24 mb12">Have feedback or suggestions?</div>
          <a class="btn btn-ghost" style="text-decoration:none"
             href="${FEEDBACK_FORM}" target="_blank" rel="noopener">Anonymous Feedback Form</a>
        </div>
        <button class="btn btn-primary mt16" id="cont">Continue to games</button>
      </div>
    </div>`);
  on(node, '#back', 'click', mainMenu);
  on(node, '#cont', 'click', mainMenu);
  mount(node);
}

// ============================================================
//  CHARADES / HEADS UP — category select
// ============================================================
let huSelectedTime = SETTINGS.defaultDuration;
let huCategoryId = null;

function headsUpCategoryScreen() {
  const cat = resolveCat(huCategoryId);
  huCategoryId = cat.id;
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>Charades</h1><p>Set up your round</p></div>
          <button class="icon-btn" id="info">${icon('info')}</button>
        </div>

        <div class="scroll" style="flex:1">
          <div class="panel mb16">
            <div class="inst-bar">
              <div class="inst"><div class="l">Tilt up / tap top</div><div class="sm">Correct</div></div>
              <div class="divider-v"></div>
              <div class="inst"><div class="l">Tilt down / tap bottom</div><div class="sm">Skip</div></div>
            </div>
          </div>

          ${retireBar()}

          ${categoryField(cat)}

          <div class="panel-title">TIME</div>
          <div class="chips mb24" id="times">
            ${SETTINGS.timeOptions.map((t) => `<button class="chip ${t === huSelectedTime ? 'active' : ''}" data-t="${t}">${t}s</button>`).join('')}
          </div>
        </div>

        <button class="btn btn-primary" id="start">Start game</button>
      </div>
    </div>`);
  on(node, '#back', 'click', mainMenu);
  on(node, '#info', 'click', headsUpRulesModal);
  wireRetire(node);
  wireCategoryField(node, () => huCategoryId, (id) => { huCategoryId = id; headsUpCategoryScreen(); });
  on(node, '#times .chip', 'click', (e) => {
    huSelectedTime = +e.currentTarget.dataset.t;
    node.querySelectorAll('#times .chip').forEach((c) => c.classList.toggle('active', +c.dataset.t === huSelectedTime));
  });
  on(node, '#start', 'click', () => {
    const c = resolveCat(huCategoryId);
    if (availableWords(c).length === 0) { offerRefresh(c, headsUpCategoryScreen); return; }
    headsUpCountdown(c, huSelectedTime);
  });
  mount(node);
}

function offerRefresh(cat, after) {
  const backdrop = openModal(`
    <div class="dialog">
      <h3>No words left</h3>
      <div class="muted mb16">Every word in ${esc(cat.name)} has been retired. Refresh to put them all back into play.</div>
      <button class="btn btn-primary mb8" id="refresh">Refresh list</button>
      <button class="btn btn-faint" id="cancel">Cancel</button>
    </div>`, { center: true });
  backdrop.querySelector('#refresh').onclick = () => { refreshUsed(cat); closeModal(backdrop); after(); };
  backdrop.querySelector('#cancel').onclick = () => closeModal(backdrop);
}

function headsUpRulesModal() {
  const backdrop = openModal(`
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="row mb8"><h2 style="margin:0;font-size:18px">How to Play</h2><div class="spacer"></div><button class="icon-btn" id="x">${icon('close')}</button></div>
      <div class="rule-h">Basic Rules</div>
      ${[
        'Hold the phone to your forehead with the screen facing outward',
        'Your friends give you clues about the word on screen',
        'Tilt the phone down (or tap the bottom / press the down arrow) to skip',
        'Tilt the phone up (or tap the top / press the up arrow or space) when you guess correct',
        'Get as many correct answers as possible before time runs out',
      ].map((t) => `<div class="rule-li"><div class="dot"></div><span>${esc(t)}</span></div>`).join('')}
      <div class="rule-h">Variations</div>
      <div class="variation"><div class="vt">Classic</div><div class="vd">Clue-givers describe the word without saying it, rhyming words, or "sounds like".</div></div>
      <div class="variation"><div class="vt">Act It Out</div><div class="vd">No talking — clue-givers can only use gestures and body language.</div></div>
      <div class="variation"><div class="vt">Sound Effects</div><div class="vd">Clue-givers can only make sounds, no words allowed.</div></div>
    </div>`);
  backdrop.querySelector('#x').onclick = () => closeModal(backdrop);
}

function headsUpCountdown(category, duration) {
  const node = el(`
    <div class="screen">
      <div class="hu-game" style="background:${grad(category.primary)}">
        <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.85)">GET READY</div>
        <div class="cd-num mt16" id="num">${SETTINGS.countdownSeconds}</div>
        <div class="mt16" style="font-size:16px;color:rgba(255,255,255,.75)">Hold phone to forehead</div>
        <div class="mt16" style="background:rgba(0,0,0,.3);border-radius:var(--radius);padding:6px 14px;font-weight:700">${duration} seconds</div>
      </div>
    </div>`);
  mount(node);
  showTiltInstructions(category, () => runCountdown(node, category, duration));
}

function showTiltInstructions(category, onStart) {
  const supportsMotion = typeof DeviceMotionEvent !== 'undefined';
  const backdrop = openModal(`
    <div class="dialog">
      <h3>How controls work</h3>
      <div class="mb12" style="font-weight:600">On a phone — tilt detection:</div>
      ${[
        'Tilt the phone fully up or down',
        'Hold the tilt for a moment',
        'Wait for the vibration / colour flash',
        'Return to level before the next tilt',
      ].map((t) => `<div class="rule-li"><div class="dot"></div><span>${esc(t)}</span></div>`).join('')}
      <div class="panel mt12" style="font-size:13px;color:var(--muted)">
        No tilt sensor (laptop)? Tap the top half or press the up arrow / space for correct;
        tap the bottom or press the down arrow for pass.
      </div>
      <div id="motion-wrap" class="${supportsMotion ? '' : 'hidden'} mt12">
        <button class="btn btn-ghost" id="enable-motion">Enable tilt controls</button>
        <div class="muted2 tcenter mt8" id="motion-status" style="font-size:12px"></div>
      </div>
      <button class="btn btn-primary mt16" id="gotit">Got it</button>
    </div>`, { center: true });

  const status = backdrop.querySelector('#motion-status');
  backdrop.querySelector('#enable-motion').onclick = async () => {
    const ok = await enableMotion();
    motionEnabled = ok;
    status.textContent = ok ? 'Tilt enabled' : 'Not available — use taps / keys instead';
  };
  backdrop.querySelector('#gotit').onclick = () => { closeModal(backdrop); onStart(); };
}

function runCountdown(node, category, duration) {
  let n = SETTINGS.countdownSeconds;
  const numEl = node.querySelector('#num');
  const tick = () => {
    if (n <= 0) { headsUpGame(category, duration); return; }
    numEl.textContent = n;
    n--;
    setTimeout(tick, 1000);
  };
  tick();
}

// ---------- Motion control ----------
let motionEnabled = false;
async function enableMotion() {
  try {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      return res === 'granted';
    }
    return true;
  } catch { return false; }
}

// ---------- Heads Up gameplay ----------
function headsUpGame(category, duration) {
  requestWakeLock();
  const words = shuffle(availableWords(category));
  const shown = words.length ? [words[0]] : [];
  const results = [];
  let idx = 0;
  let timeLeft = duration;
  let canAct = true;
  let paused = false;
  let lastPitch = 0;
  let returnedToNeutral = true;
  let timerId = null;
  let motionHandler = null;

  const node = el(`
    <div class="screen">
      <div class="hu-game" id="stage" style="background:${grad(category.primary)}">
        <div class="hu-timerbar"><div id="bar" style="width:100%"></div></div>
        <button class="hu-exit" id="exit">Exit</button>
        <div class="hu-pill hu-score"><span id="score">0</span></div>
        <div class="hu-pill hu-timer"><span id="time">${timeLeft}</span>s</div>

        <div class="hu-tap top" id="tap-correct"></div>
        <div class="hu-tap bottom" id="tap-skip"></div>

        <div id="word" class="hu-word">${esc(words[0] || '—')}</div>

        <div class="hu-hints" id="hints">
          <div class="hu-hint"><div class="a">Tilt up · tap top · &uarr;</div><div class="l" style="color:var(--correct-accent)">Correct</div></div>
          <div class="hu-hint"><div class="a">Tilt down · tap bottom · &darr;</div><div class="l" style="color:var(--skip-accent)">Pass</div></div>
        </div>
      </div>
    </div>`);

  const stage = node.querySelector('#stage');
  const wordEl = node.querySelector('#word');
  const scoreEl = node.querySelector('#score');
  const timeEl = node.querySelector('#time');
  const barEl = node.querySelector('#bar');
  const hintsEl = node.querySelector('#hints');

  const correctCount = () => results.filter((r) => r.correct).length;

  function showFeedback(correct) {
    canAct = false;
    vibrate(correct ? 100 : 50);
    results.push({ word: words[idx], correct });
    scoreEl.textContent = correctCount();
    stage.style.background = correct ? 'var(--correct)' : 'var(--skip)';
    hintsEl.style.visibility = 'hidden';
    wordEl.className = 'hu-feedback';
    wordEl.textContent = correct ? 'CORRECT' : 'PASS';
    setTimeout(() => {
      stage.style.background = grad(category.primary);
      hintsEl.style.visibility = 'visible';
      nextWord();
    }, SETTINGS.feedbackDelayMs);
  }

  function nextWord() {
    if (idx < words.length - 1) {
      idx++;
      shown.push(words[idx]);
      canAct = true;
      returnedToNeutral = true;
      wordEl.className = 'hu-word';
      wordEl.textContent = words[idx];
    } else { endGame(); }
  }

  function act(correct) { if (canAct && !paused) showFeedback(correct); }

  function endGame() {
    clearInterval(timerId);
    cleanup();
    markUsed(category, shown);
    headsUpResults(category, results, duration);
  }

  function cleanup() {
    document.removeEventListener('keydown', keyHandler);
    if (motionHandler) window.removeEventListener('devicemotion', motionHandler);
    releaseWakeLock();
  }

  timerId = setInterval(() => {
    if (paused) return;
    timeLeft--;
    timeEl.textContent = Math.max(timeLeft, 0);
    barEl.style.width = `${Math.max((timeLeft / duration) * 100, 0)}%`;
    if (timeLeft <= 10) { barEl.style.background = 'var(--warning)'; }
    if (timeLeft <= 0) endGame();
  }, 1000);

  node.querySelector('#tap-correct').addEventListener('click', () => act(true));
  node.querySelector('#tap-skip').addEventListener('click', () => act(false));
  const keyHandler = (e) => {
    if (e.key === 'ArrowUp' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); act(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); act(false); }
    else if (e.key === 'Escape') showExit();
  };
  document.addEventListener('keydown', keyHandler);

  if (motionEnabled) {
    motionHandler = (event) => {
      const g = event.accelerationIncludingGravity;
      if (!g || g.x == null || !canAct || paused) return;
      const { x, y, z } = g;
      const pitch = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
      const inNeutral = Math.abs(pitch) < SETTINGS.neutralAngle;
      if (inNeutral && !returnedToNeutral) returnedToNeutral = true;
      if (returnedToNeutral) {
        if (pitch > SETTINGS.triggerAngle && lastPitch <= SETTINGS.triggerAngle) { returnedToNeutral = false; act(true); }
        else if (pitch < -SETTINGS.triggerAngle && lastPitch >= -SETTINGS.triggerAngle) { returnedToNeutral = false; act(false); }
      }
      lastPitch = pitch;
    };
    window.addEventListener('devicemotion', motionHandler);
  }

  function showExit() {
    paused = true;
    const backdrop = openModal(`
      <div class="dialog">
        <h3>Exit game?</h3>
        <div class="muted mb16">You've scored ${correctCount()} so far. Are you sure you want to quit?</div>
        <button class="btn btn-faint mb8" id="keep">Keep playing</button>
        <button class="btn btn-faint mb8" id="end">End game</button>
        <button class="btn btn-faint" id="quit">Quit to categories</button>
      </div>`, { center: true });
    backdrop.querySelector('#keep').onclick = () => { closeModal(backdrop); paused = false; };
    backdrop.querySelector('#end').onclick = () => { closeModal(backdrop); endGame(); };
    backdrop.querySelector('#quit').onclick = () => { closeModal(backdrop); clearInterval(timerId); cleanup(); markUsed(category, shown); headsUpCategoryScreen(); };
  }
  node.querySelector('#exit').addEventListener('click', showExit);

  mount(node);
}

function headsUpResults(category, results, duration) {
  const correct = results.filter((r) => r.correct).length;
  const skipped = results.length - correct;
  const pct = results.length ? (correct / results.length) * 100 : 0;
  const message = pct >= 90 ? 'Legendary' : pct >= 70 ? 'Amazing' : pct >= 50 ? 'Great job' : pct >= 30 ? 'Keep trying' : 'Practice makes perfect';

  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="tcenter">
          <div style="font-size:20px;font-weight:700;letter-spacing:1px;color:var(--muted)">GAME OVER</div>
          <div class="mt8 center" style="gap:6px">${badge(catSymbol(category.name), category.primary, true)} ${esc(category.name)}</div>
        </div>
        <div class="row mt16 mb8" style="justify-content:space-evenly">
          <div class="center" style="flex-direction:column;width:90px;height:90px;border-radius:50%;background:${grad(category.primary)};color:#fff">
            <div id="big" style="font-size:32px;font-weight:800">0</div>
            <div style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,.85)">POINTS</div>
          </div>
          <div>
            <div class="panel mb8" style="width:150px"><b style="color:var(--correct-accent)">${correct}</b> Correct</div>
            <div class="panel" style="width:150px"><b style="color:var(--skip-accent)">${skipped}</b> Skipped</div>
          </div>
        </div>
        <div class="tcenter mb12" style="font-size:16px;font-weight:600">${message}</div>

        <div class="panel scroll" style="flex:1;padding:6px">
          <div class="panel-title row" style="padding:6px 8px"><span>RESULTS</span><span class="spacer"></span><span class="muted2">${results.length} words</span></div>
          ${results.length === 0 ? '<div class="tcenter muted" style="padding:24px">No words played</div>' :
            results.map((r, i) => `
              <div class="row gap8" style="padding:8px 12px">
                <span class="muted2" style="width:22px">${i + 1}</span>
                <span class="res-dot ${r.correct ? 'ok' : 'no'}"></span>
                <span class="grow">${esc(r.word)}</span>
                <b style="color:${r.correct ? 'var(--correct-accent)' : 'var(--skip-accent)'}">${r.correct ? '+' + SETTINGS.pointsPerCorrect : SETTINGS.pointsPerSkip}</b>
              </div>`).join('')}
        </div>

        <div class="row gap8 mt12">
          <button class="btn btn-primary" id="again">Play again</button>
          <button class="btn btn-ghost" id="cats">Categories</button>
        </div>
        <button class="btn btn-faint mt8" id="menu">Main menu</button>
      </div>
    </div>`);

  on(node, '#again', 'click', () => {
    if (availableWords(category).length === 0) { offerRefresh(category, () => headsUpCountdown(category, duration)); return; }
    headsUpCountdown(category, duration);
  });
  on(node, '#cats', 'click', headsUpCategoryScreen);
  on(node, '#menu', 'click', mainMenu);
  mount(node);

  const bigEl = node.querySelector('#big');
  const start = performance.now(), dur = 1000;
  const animate = (t) => {
    const p = Math.min((t - start) / dur, 1);
    bigEl.textContent = Math.round((1 - Math.pow(1 - p, 3)) * correct);
    if (p < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

// ============================================================
//  IMPOSTER
// ============================================================
let impPlayers = 4;
let impCategoryId = null;
let impAllowFirst = true;

function imposterSetupScreen() {
  const cat = resolveCat(impCategoryId);
  impCategoryId = cat.id;
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>Imposter</h1><p>Find the fake</p></div>
          <button class="icon-btn" id="info">${icon('info')}</button>
        </div>
        <div class="scroll" style="flex:1">
          <div class="panel mb16">
            <div class="panel-title">HOW TO PLAY</div>
            ${[
              'Each player views their screen privately',
              'One random player is the imposter',
              'The imposter sees "???" instead of the word',
              'Discuss and vote on who the imposter is',
              'The imposter wins if they can guess the word',
            ].map((t, i) => `<div class="rule-li"><div class="checkbox" style="background:var(--surface-2)">${i + 1}</div><span>${esc(t)}</span></div>`).join('')}
          </div>

          ${retireBar()}

          <div class="panel-title">PLAYERS</div>
          <div class="stepper mb8">
            <button class="step-btn" id="pminus">&minus;</button>
            <div class="step-box" id="pcount">${impPlayers}</div>
            <button class="step-btn" id="pplus">+</button>
          </div>
          <div class="tcenter muted2 mb24" style="font-size:12px">3-12 players</div>

          ${categoryField(cat)}

          <div class="panel pressable mb24" id="firsttoggle">
            <div class="row gap12">
              <div class="checkbox ${impAllowFirst ? 'on' : ''}" id="cb">${impAllowFirst ? icon('check', 14) : ''}</div>
              <span>First player can be imposter</span>
            </div>
          </div>

          <button class="btn btn-primary" id="start">Start game</button>
        </div>
      </div>
    </div>`);

  on(node, '#back', 'click', mainMenu);
  on(node, '#info', 'click', imposterRulesModal);
  wireRetire(node);
  on(node, '#pminus', 'click', () => { if (impPlayers > 3) { impPlayers--; node.querySelector('#pcount').textContent = impPlayers; } });
  on(node, '#pplus', 'click', () => { if (impPlayers < 12) { impPlayers++; node.querySelector('#pcount').textContent = impPlayers; } });
  wireCategoryField(node, () => impCategoryId, (id) => { impCategoryId = id; imposterSetupScreen(); });
  on(node, '#firsttoggle', 'click', () => {
    impAllowFirst = !impAllowFirst;
    const cb = node.querySelector('#cb');
    cb.classList.toggle('on', impAllowFirst);
    cb.innerHTML = impAllowFirst ? icon('check', 14) : '';
  });
  on(node, '#start', 'click', () => {
    const c = resolveCat(impCategoryId);
    if (availableWords(c).length === 0) { offerRefresh(c, imposterSetupScreen); return; }
    imposterGame(c);
  });
  mount(node);
}

function imposterRulesModal() {
  const sections = [
    ['Basic Rules', [
      'One player is randomly chosen as the imposter',
      'All other players (citizens) see the secret word',
      'The imposter sees "???" instead of the word',
      'During discussion, everyone talks about the word vaguely',
      'The imposter must pretend they know the word',
      'After discussion, vote on who you think is the imposter',
    ]],
    ['Tips for Citizens', [
      "Be vague — don't give away the exact word",
      'Ask questions that only someone who knows the word could answer',
      'Watch for people who give very generic answers',
    ]],
    ['Tips for the Imposter', [
      "Listen carefully to others' clues to figure out the word",
      'Give vague answers that could apply to many words',
      'Blend in by nodding and agreeing with others',
    ]],
  ];
  const backdrop = openModal(`
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="row mb8"><h2 style="margin:0;font-size:18px">How to Play</h2><div class="spacer"></div><button class="icon-btn" id="x">${icon('close')}</button></div>
      ${sections.map(([h, items]) => `<div class="rule-h">${h}</div>${items.map((t) => `<div class="rule-li"><div class="dot"></div><span>${esc(t)}</span></div>`).join('')}`).join('')}
    </div>`);
  backdrop.querySelector('#x').onclick = () => closeModal(backdrop);
}

function imposterGame(category) {
  const playerCount = impPlayers;
  const imposterIndex = impAllowFirst ? randInt(playerCount) : 1 + randInt(playerCount - 1);
  const secretWord = shuffle(availableWords(category))[0];
  markUsed(category, secretWord);
  let current = 0;
  let revealed = false;

  const isImposter = () => current === imposterIndex;

  function render() {
    const dots = () => `<div class="dots">${Array.from({ length: playerCount }, (_, i) =>
      `<div class="dot-pip ${i < current ? 'done' : i === current ? 'cur' : ''}"></div>`).join('')}</div>`;

    let bg, body;
    if (!revealed) {
      bg = '#1c1f24';
      body = `
        <div class="spacer"></div>
        <div class="tcenter">
          <div style="letter-spacing:2px;font-weight:700;color:var(--muted)">PLAYER ${current + 1}</div>
          <div class="muted2 mt8">${current + 1} of ${playerCount}</div>
        </div>
        <div class="reveal-card mt24" style="background:var(--surface);border-color:var(--line)">
          <div class="big-ic">${icon('lock', 44)}</div>
          <div class="muted mt16">Tap to reveal your role</div>
          <div class="muted2 mt8" style="font-size:12px">Make sure no one else can see</div>
        </div>
        <button class="btn btn-ghost mt24" id="reveal" style="max-width:360px;margin:0 auto">Reveal</button>
        <div class="spacer"></div>
        ${dots()}`;
    } else {
      bg = isImposter() ? '#3a2230' : grad(category.primary);
      const badge = isImposter()
        ? '<div class="role-badge" style="background:rgba(255,255,255,.18);color:#fff">IMPOSTER</div>'
        : '<div class="role-badge" style="background:rgba(255,255,255,.18);color:#fff">CITIZEN</div>';
      const sub = isImposter()
        ? '<div class="muted mt12" style="color:rgba(255,255,255,.8)">Blend in. Pretend you know the word.</div>'
        : `<div class="mt12" style="display:inline-block;padding:6px 14px;border-radius:var(--radius);background:rgba(0,0,0,.25);font-size:12px;color:#fff">${esc(category.name)}</div>`;
      const last = current >= playerCount - 1;
      body = `
        <div class="spacer"></div>
        <div class="tcenter" style="letter-spacing:2px;font-weight:700;color:rgba(255,255,255,.8)">PLAYER ${current + 1}</div>
        <div class="reveal-card mt24">
          ${badge}
          <div class="secret-word">${isImposter() ? '???' : esc(secretWord)}</div>
          ${sub}
        </div>
        <button class="btn ${last ? 'btn-primary' : 'btn-ghost'} mt24" id="next" style="max-width:380px;margin:0 auto">
          ${last ? 'Start discussion' : 'Hide word and pass to next player'}
        </button>
        <div class="spacer"></div>
        ${dots()}`;
    }

    const node = el(`<div class="screen"><div class="wrap" style="background:${bg};color:#fff">${body}</div></div>`);
    if (!revealed) {
      on(node, '#reveal', 'click', () => { revealed = true; render(); });
      on(node, '.reveal-card', 'click', () => { revealed = true; render(); });
    } else {
      on(node, '#next', 'click', () => {
        if (current < playerCount - 1) { current++; revealed = false; render(); }
        else imposterDiscussion(category, imposterIndex, secretWord);
      });
    }
    mount(node);
  }
  render();
}

function imposterDiscussion(category, imposterIndex, secretWord) {
  let revealed = false;
  function render() {
    let node;
    if (!revealed) {
      node = el(`
        <div class="screen"><div class="wrap">
          <div class="tcenter mt24" style="font-size:24px;font-weight:700;letter-spacing:1px">DISCUSSION TIME</div>
          <div class="tcenter muted mt8">Find the imposter</div>
          <div class="panel mt24">
            ${['Ask questions about the word', "Be vague — don't give it away", 'Vote on who you think is faking']
              .map((t) => `<div class="rule-li"><div class="dot"></div><span>${esc(t)}</span></div>`).join('')}
          </div>
          <div class="spacer"></div>
          <button class="btn btn-primary" id="reveal">Reveal imposter</button>
        </div></div>`);
      on(node, '#reveal', 'click', () => { revealed = true; render(); });
    } else {
      node = el(`
        <div class="screen"><div class="wrap">
          <div class="tcenter panel-title mt24">THE IMPOSTER WAS</div>
          <div class="tcenter">
            <div style="display:inline-block;padding:14px 32px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--line);font-size:28px;font-weight:800">Player ${imposterIndex + 1}</div>
          </div>
          <div class="tcenter panel-title mt24">THE WORD WAS</div>
          <div class="tcenter">
            <div style="display:inline-block;padding:14px 26px;border-radius:var(--radius);background:${grad(category.primary)};color:#fff">
              <div style="font-size:24px;font-weight:700">${esc(secretWord)}</div>
              <div class="mt8" style="font-size:12px;color:rgba(255,255,255,.8)">${esc(category.name)}</div>
            </div>
          </div>
          <div class="spacer"></div>
          <button class="btn btn-primary mb8" id="again">Play again</button>
          <button class="btn btn-faint" id="menu">Main menu</button>
        </div></div>`);
      on(node, '#again', 'click', imposterSetupScreen);
      on(node, '#menu', 'click', mainMenu);
    }
    mount(node);
  }
  render();
}

// ============================================================
//  SPIN THE WHEEL
// ============================================================
let swCategoryId = null;
const WHEEL_MAX = 8;

function spinWheelSetupScreen() {
  const cat = resolveCat(swCategoryId);
  swCategoryId = cat.id;
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>Spin the Wheel</h1><p>Pick a category, then spin</p></div>
        </div>
        <div class="scroll" style="flex:1">
          <div class="panel mb16">
            <div class="panel-title">HOW IT WORKS</div>
            ${[
              'Pick a category and tap Spin',
              'The wheel lands on a random word',
              'Use it however you like — dares, drawing, debates',
              'With "Retire used words" on, each landed word is removed until you refresh',
            ].map((t) => `<div class="rule-li"><div class="dot"></div><span>${esc(t)}</span></div>`).join('')}
          </div>

          ${retireBar()}

          ${categoryField(cat)}

          <button class="btn btn-primary" id="start">Spin</button>
        </div>
      </div>
    </div>`);
  on(node, '#back', 'click', mainMenu);
  wireRetire(node);
  wireCategoryField(node, () => swCategoryId, (id) => { swCategoryId = id; spinWheelSetupScreen(); });
  on(node, '#start', 'click', () => {
    const c = resolveCat(swCategoryId);
    if (availableWords(c).length === 0) { offerRefresh(c, spinWheelSetupScreen); return; }
    spinWheelGame(c);
  });
  mount(node);
}

function spinWheelGame(category) {
  let rotation = 0;
  let spinning = false;
  let segments = [];

  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>${esc(category.name)}</h1><p id="remain"></p></div>
          <button class="icon-btn" id="refresh" title="Refresh list">${icon('refresh')}</button>
        </div>
        <div class="center" style="flex:1;flex-direction:column">
          <div class="wheel-wrap">
            <div class="wheel-pointer"></div>
            <div class="wheel" id="wheel"></div>
            <div class="wheel-hub"></div>
          </div>
          <div class="wheel-result" id="result">Tap Spin to start</div>
        </div>
        <button class="btn btn-primary" id="spin">Spin</button>
        <button class="btn btn-faint mt8" id="menu">Main menu</button>
      </div>
    </div>`);

  const wheelEl = node.querySelector('#wheel');
  const resultEl = node.querySelector('#result');
  const remainEl = node.querySelector('#remain');
  const spinBtn = node.querySelector('#spin');

  function updateRemain() {
    remainEl.textContent = getRetire()
      ? `${availableWords(category).length} of ${category.words.length} words left`
      : `${category.words.length} words`;
  }

  function buildWheel() {
    const pool = availableWords(category);
    if (pool.length === 0) { offerRefresh(category, () => spinWheelGame(category)); return false; }
    segments = shuffle(pool).slice(0, Math.min(WHEEL_MAX, pool.length));
    const n = segments.length;
    const seg = 360 / n;
    const colors = [category.primary, category.secondary];
    const stops = segments.map((_, i) => `${colors[i % 2]} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');
    wheelEl.style.background = n === 1 ? colors[0] : `conic-gradient(${stops})`;
    wheelEl.innerHTML = segments.map((w, i) => {
      const mid = i * seg + seg / 2;
      return `<div class="wheel-label" style="transform:rotate(${mid}deg)"><span class="txt" style="transform:translate(-50%,-50%) rotate(${-mid}deg)">${esc(w)}</span></div>`;
    }).join('');
    updateRemain();
    return true;
  }

  function spin() {
    if (spinning) return;
    if (!segments.length && !buildWheel()) return;
    spinning = true;
    spinBtn.disabled = true;
    resultEl.textContent = '…';
    resultEl.classList.remove('show');

    const n = segments.length;
    const seg = 360 / n;
    const k = randInt(n);
    const landed = segments[k];
    const targetMod = (360 - (k * seg + seg / 2)) % 360;
    let next = rotation - (rotation % 360) + targetMod;
    while (next < rotation + 360 * 4) next += 360;
    rotation = next;
    wheelEl.style.transform = `rotate(${rotation}deg)`;
    vibrate(20);

    const done = () => {
      wheelEl.removeEventListener('transitionend', done);
      spinning = false;
      spinBtn.disabled = false;
      spinBtn.textContent = 'Spin again';
      vibrate(120);
      resultEl.textContent = landed;
      resultEl.classList.add('show');
      markUsed(category, landed);
      segments = [];
      updateRemain();
    };
    wheelEl.addEventListener('transitionend', done);
  }

  on(node, '#back', 'click', spinWheelSetupScreen);
  on(node, '#menu', 'click', mainMenu);
  on(node, '#refresh', 'click', () => { refreshUsed(category); segments = []; buildWheel(); resultEl.textContent = 'List refreshed — spin'; toast('Words restored'); });
  on(node, '#spin', 'click', spin);

  mount(node);
  buildWheel();
}

// ============================================================
//  CUSTOM LISTS & COMMUNITY
// ============================================================
function listsScreen() {
  const lists = getCustomLists().slice().sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>Custom Lists</h1><p>Make your own &amp; vote on shared lists</p></div>
        </div>
        <div class="row gap8 mb16">
          <button class="btn btn-primary" id="create">${icon('plus', 16)} New list</button>
          <button class="btn btn-ghost" id="import">${icon('share', 16)} Import</button>
        </div>
        <div class="scroll" style="flex:1" id="list">
          ${lists.length === 0 ? `
            <div class="panel tcenter muted" style="padding:28px">
              No custom lists yet. Create one, or import a list a friend shared with you.
            </div>` :
            lists.map((l) => listCardHtml(l)).join('')}
          <div class="panel mt16 muted2" style="font-size:12px;line-height:1.5">
            Lists and votes are saved on this device only. Use Share to send a list to friends via a
            link or code. A real online community with global votes is on the roadmap (see PLANS.md).
          </div>
        </div>
      </div>
    </div>`);

  on(node, '#back', 'click', mainMenu);
  on(node, '#create', 'click', () => listEditor(null));
  on(node, '#import', 'click', importModal);
  on(node, '.vote-up', 'click', (e) => { voteList(e.currentTarget.dataset.id, 1); listsScreen(); });
  on(node, '.vote-down', 'click', (e) => { voteList(e.currentTarget.dataset.id, -1); listsScreen(); });
  on(node, '.list-preview', 'click', (e) => wordPreviewModal(resolveCat(e.currentTarget.dataset.id)));
  on(node, '.list-edit', 'click', (e) => listEditor(getCustomListById(e.currentTarget.dataset.id)));
  on(node, '.list-share', 'click', (e) => shareModal(getCustomListById(e.currentTarget.dataset.id)));
  on(node, '.list-delete', 'click', (e) => confirmDelete(getCustomListById(e.currentTarget.dataset.id)));
  mount(node);
}

function getCustomListById(id) { return getCustomLists().find((l) => l.id === id); }

function listCardHtml(l) {
  const vote = l.myVote || 0;
  return `
    <div class="list-card">
      <div class="votes">
        <button class="vote-up ${vote === 1 ? 'on' : ''}" data-id="${l.id}">${icon('up', 18)}</button>
        <div class="score">${l.votes || 0}</div>
        <button class="vote-down ${vote === -1 ? 'on' : ''}" data-id="${l.id}">${icon('down', 18)}</button>
      </div>
      ${badge(catSymbol(l.name), l.primary, true)}
      <div class="grow" style="min-width:0">
        <b style="font-size:15px">${esc(l.name)}</b>
        <div class="muted2" style="font-size:12px;margin-top:1px">${l.words.length} words${l.shared ? ' · shared with you' : ''}</div>
      </div>
      <button class="icon-btn list-preview" data-id="${l.id}" title="Preview words">${icon('preview', 16)}</button>
      <button class="icon-btn list-share" data-id="${l.id}" title="Share">${icon('share', 16)}</button>
      <button class="icon-btn list-edit" data-id="${l.id}" title="Edit">${icon('edit', 16)}</button>
      <button class="icon-btn list-delete" data-id="${l.id}" title="Delete">${icon('trash', 16)}</button>
    </div>`;
}

function listEditor(existing) {
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>${existing ? 'Edit list' : 'New list'}</h1></div>
        </div>
        <div class="scroll" style="flex:1">
          <label class="field-label">Name</label>
          <input class="input mb16" id="name" placeholder="My word list" value="${existing ? esc(existing.name) : ''}" />
          <label class="field-label">Words (one per line)</label>
          <textarea class="input" id="words" rows="12" placeholder="Pizza&#10;Dragon&#10;Taylor Swift">${existing ? esc(existing.words.join('\n')) : ''}</textarea>
          <div class="muted2 mt8" id="wcount" style="font-size:12px"></div>
        </div>
        <button class="btn btn-primary mt12" id="save">${existing ? 'Save changes' : 'Create list'}</button>
      </div>
    </div>`);

  const wordsEl = node.querySelector('#words');
  const countEl = node.querySelector('#wcount');
  const recount = () => {
    const n = wordsEl.value.split('\n').map((w) => w.trim()).filter(Boolean).length;
    countEl.textContent = `${n} word${n === 1 ? '' : 's'}`;
  };
  wordsEl.addEventListener('input', recount); recount();

  on(node, '#back', 'click', listsScreen);
  on(node, '#save', 'click', () => {
    const name = node.querySelector('#name').value.trim();
    const words = wordsEl.value.split('\n').map((w) => w.trim()).filter(Boolean);
    if (!name) { toast('Give your list a name'); return; }
    if (words.length < 2) { toast('Add at least 2 words'); return; }
    saveCustomList({ id: existing?.id, name, words });
    toast(existing ? 'List saved' : 'List created');
    listsScreen();
  });
  mount(node);
}

function shareModal(list) {
  const url = shareUrl(list);
  const code = encodeList(list);
  const backdrop = openModal(`
    <div class="dialog">
      <h3>Share "${esc(list.name)}"</h3>
      <div class="muted mb12" style="font-size:13px">Send this link to friends. Opening it lets them import the list and vote on it.</div>
      <textarea class="input" id="url" rows="3" readonly>${esc(url)}</textarea>
      <button class="btn btn-ghost mt8 mb16" id="copyurl">Copy link</button>
      <div class="muted2 mb8" style="font-size:12px">Or share just the code:</div>
      <textarea class="input" id="code" rows="3" readonly>${esc(code)}</textarea>
      <button class="btn btn-ghost mt8" id="copycode">Copy code</button>
      <button class="btn btn-faint mt12" id="close">Done</button>
    </div>`, { center: true });
  backdrop.querySelector('#copyurl').onclick = async () => toast((await copyText(url)) ? 'Link copied' : 'Copy failed');
  backdrop.querySelector('#copycode').onclick = async () => toast((await copyText(code)) ? 'Code copied' : 'Copy failed');
  backdrop.querySelector('#close').onclick = () => closeModal(backdrop);
}

function importModal() {
  const backdrop = openModal(`
    <div class="dialog">
      <h3>Import a list</h3>
      <div class="muted mb12" style="font-size:13px">Paste a share link or code from a friend.</div>
      <textarea class="input" id="code" rows="4" placeholder="Paste link or code…"></textarea>
      <button class="btn btn-primary mt12" id="go">Import</button>
      <button class="btn btn-faint mt8" id="cancel">Cancel</button>
    </div>`, { center: true });
  backdrop.querySelector('#cancel').onclick = () => closeModal(backdrop);
  backdrop.querySelector('#go').onclick = () => {
    let raw = backdrop.querySelector('#code').value.trim();
    const m = raw.match(/#share=(.+)$/);
    if (m) raw = m[1];
    const decoded = decodeList(raw);
    if (!decoded) { toast('That code looks invalid'); return; }
    importList(decoded);
    closeModal(backdrop);
    toast(`Imported "${decoded.name}"`);
    listsScreen();
  };
}

function confirmDelete(list) {
  const backdrop = openModal(`
    <div class="dialog">
      <h3>Delete "${esc(list.name)}"?</h3>
      <div class="muted mb16">This can't be undone.</div>
      <button class="btn btn-faint mb8" id="del">Delete</button>
      <button class="btn btn-faint" id="cancel">Cancel</button>
    </div>`, { center: true });
  backdrop.querySelector('#cancel').onclick = () => closeModal(backdrop);
  backdrop.querySelector('#del').onclick = () => { deleteCustomList(list.id); closeModal(backdrop); listsScreen(); };
}

// ============================================================
//  Boot — handle a #share= link, then show the menu
// ============================================================
function handleShareLink() {
  const m = location.hash.match(/#share=(.+)$/);
  if (!m) return false;
  const decoded = decodeList(m[1]);
  history.replaceState(null, '', location.pathname + location.search);
  if (!decoded) { toast('That shared link looks invalid'); return false; }
  const backdrop = openModal(`
    <div class="dialog">
      <h3>Import shared list?</h3>
      <div class="row gap8 mb12">${badge(catSymbol(decoded.name), decoded.primary || '#5d6d7e', true)}<b style="font-size:16px">${esc(decoded.name)}</b></div>
      <div class="muted mb16">${decoded.words.length} words — add it to your custom lists?</div>
      <button class="btn btn-primary mb8" id="add">Import list</button>
      <button class="btn btn-faint" id="skip">Not now</button>
    </div>`, { center: true });
  backdrop.querySelector('#add').onclick = () => { importList(decoded); closeModal(backdrop); toast(`Imported "${decoded.name}"`); listsScreen(); };
  backdrop.querySelector('#skip').onclick = () => closeModal(backdrop);
  return true;
}

mainMenu();
handleShareLink();
