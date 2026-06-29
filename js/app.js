// ============================================================
//  Party Games - web port of the Flutter app by Vitgrub Studios
//  Games: Charades (Heads Up, tilt support), Imposter, Spin the Wheel
//  Works on phones (tilt + tap) and laptops (tap + keyboard).
//  Shared word lists + custom lists live in store.js.
// ============================================================
import {
  getCategories, getCustomLists, saveCustomList, deleteCustomList,
  getRetire, setRetire, availableWords, markUsed, refreshUsed,
} from './store.js';
import { wavelengthPairs } from './extra-data.js';

const REPO_URL = 'https://github.com/vitgruib/party-web';
const BUG_EMAIL = 'ethanc8858@gmail.com';
const APP_VERSION = '0.2';

// ---------- Game settings (mirrors theme.dart GameSettings) ----------
const SETTINGS = {
  defaultDuration: 60,
  feedbackDelayMs: 800,
  countdownSeconds: 3,
  timeOptions: [30, 45, 60, 90, 120],
  pointsPerCorrect: 1,
  pointsPerSkip: 0,
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
  'Animals': 'pets', 'Food & Drinks': 'restaurant', 'Food': 'restaurant', 'Brands': 'sell', 'Objects': 'category',
  'Actions': 'directions_run', 'Anime': 'animation', 'Jobs & Professions': 'work',
  'School Subjects': 'school', 'Instruments': 'piano', 'Landmarks': 'account_balance',
  'Everything': 'all_inclusive', 'Sports': 'sports_basketball', 'Countries': 'public',
  'Superheroes': 'bolt', 'Disney': 'castle', 'Emotions': 'mood', 'Fruits & Veggies': 'nutrition',
  'Space': 'rocket_launch', 'Mythical Creatures': 'auto_awesome', 'Vehicles': 'directions_car',
  'Holidays': 'celebration', 'Colleges': 'school', 'Japanese Foods': 'ramen_dining',
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
  { title: 'Wavelength', subtitle: 'Read minds on a hidden spectrum', color: '#1e8449', symbol: 'tune', open: wavelengthSetupScreen },
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
              <div class="ttl">Custom Lists</div>
              <div class="sub">Make your own word lists</div>
            </div>
            <div class="arrow">&rsaquo;</div>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="row" style="justify-content:center;gap:18px">
          <div class="credits-link" id="credits">Credits &amp; Feedback</div>
          <div class="credits-link" id="bug">Bug / suggestion</div>
        </div>
      </div>
    </div>`);
  on(node, '.game-card[data-i]', 'click', (e) => GAMES[+e.currentTarget.dataset.i].open());
  on(node, '#lists-card', 'click', listsScreen);
  on(node, '#credits', 'click', creditsScreen);
  on(node, '#bug', 'click', () => bugReportModal());
  mount(node);
}

// ============================================================
//  BUG REPORTS
// ============================================================
function bugReportModal(context = 'Main menu') {
  const diag = `\n\n---\nApp: Party Games v${APP_VERSION}\nScreen: ${context}\nDevice: ${navigator.userAgent}\nViewport: ${window.innerWidth}x${window.innerHeight}\nDate: ${new Date().toISOString()}`;
  const backdrop = openModal(`
    <div class="dialog">
      <h3>Bug report or suggestion</h3>
      <div class="muted mb12" style="font-size:13px">Report a bug (what happened, steps, what you expected) or suggest a feature / word list.</div>
      <textarea class="input" id="desc" rows="5" placeholder="Describe the bug or suggestion…"></textarea>
      <div class="muted2 mt8 mb12" style="font-size:11px">Device & version details are attached automatically.</div>
      <button class="btn btn-primary mb8" id="email">Send by email</button>
      <button class="btn btn-ghost mb8" id="gh">Open a GitHub issue</button>
      <button class="btn btn-ghost mb8" id="copy">Copy report</button>
      <button class="btn btn-faint" id="cancel">Cancel</button>
    </div>`, { center: true });

  const getBody = () => (backdrop.querySelector('#desc').value.trim() || '(no description)') + diag;
  backdrop.querySelector('#email').onclick = () => {
    location.href = `mailto:${BUG_EMAIL}?subject=${encodeURIComponent('Party Games — bug / suggestion')}&body=${encodeURIComponent(getBody())}`;
  };
  backdrop.querySelector('#gh').onclick = () => {
    window.open(`${REPO_URL}/issues/new?title=${encodeURIComponent('Bug / suggestion: ')}&body=${encodeURIComponent(getBody())}`, '_blank', 'noopener');
  };
  backdrop.querySelector('#copy').onclick = async () => toast((await copyText(getBody())) ? 'Report copied' : 'Copy failed');
  backdrop.querySelector('#cancel').onclick = () => closeModal(backdrop);
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
          <a class="btn btn-ghost mb8" style="text-decoration:none"
             href="${FEEDBACK_FORM}" target="_blank" rel="noopener">Anonymous Feedback Form</a>
          <button class="btn btn-ghost" id="bug">Report a bug or suggestion</button>
        </div>
        <button class="btn btn-primary mt16" id="cont">Continue to games</button>
      </div>
    </div>`);
  on(node, '#back', 'click', mainMenu);
  on(node, '#cont', 'click', mainMenu);
  on(node, '#bug', 'click', () => bugReportModal('Credits'));
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
              <div class="inst"><div class="l">Tap left</div><div class="sm">Pass</div></div>
              <div class="divider-v"></div>
              <div class="inst"><div class="l">Tap right</div><div class="sm">Correct</div></div>
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
        'Tap the RIGHT side of the screen (or press → / space) when you guess correct',
        'Tap the LEFT side of the screen (or press ←) to pass',
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
        <div class="mt16" style="font-size:16px;color:rgba(255,255,255,.75)">Phone to forehead — tap left to pass, right for correct</div>
        <div class="mt16" style="background:rgba(0,0,0,.3);border-radius:var(--radius);padding:6px 14px;font-weight:700">${duration} seconds</div>
      </div>
    </div>`);
  mount(node);
  runCountdown(node, category, duration);
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
  let timerId = null;

  const node = el(`
    <div class="screen">
      <div class="hu-game" id="stage" style="background:${grad(category.primary)}">
        <div class="hu-timerbar"><div id="bar" style="width:100%"></div></div>
        <button class="hu-exit" id="exit">Exit</button>
        <div class="hu-pill hu-score"><span id="score">0</span></div>
        <div class="hu-pill hu-timer"><span id="time">${timeLeft}</span>s</div>

        <div id="word" class="hu-word">${esc(words[0] || '—')}</div>

        <div class="hu-hints" id="hints">
          <div class="hu-hint"><div class="a">&larr; Tap left</div><div class="l" style="color:var(--skip-accent)">Pass</div></div>
          <div class="hu-hint"><div class="a">Tap right &rarr;</div><div class="l" style="color:var(--correct-accent)">Correct</div></div>
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

  // Tap the right half = correct, left half = pass. Clicks on the exit
  // button / pills are ignored so those controls keep working.
  stage.addEventListener('click', (e) => {
    if (e.target.closest('#exit, .hu-pill')) return;
    act(e.clientX >= window.innerWidth / 2);
  });
  const keyHandler = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); act(true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); act(false); }
    else if (e.key === 'Escape') showExit();
  };
  document.addEventListener('keydown', keyHandler);

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
          <div class="grow"><h1>Imposter</h1><p>One device, passed around</p></div>
        </div>
        <div class="scroll" style="flex:1">
          <div class="panel mb16">
            <div class="panel-title">HOW TO PLAY</div>
            ${[
              'One random player is secretly the imposter. Everyone else (the citizens) gets the same secret word — the imposter only sees ???.',
              'Single device: starting with Player 1, pass the phone around in turn order so each player privately sees their role, then hides it and passes it on.',
              'Now give clues. Starting from the first player and going in order, each player says ONE vague word out loud that hints at the secret word.',
              'After each full round of clues — from the second round onward — anyone can call a vote: the group decides whether to keep giving clues or stop and accuse.',
              'When you stop, everyone votes for who they think the imposter is. The imposter wins by surviving the vote, or by correctly guessing the secret word.',
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

    // Same background for every player/role so you can't read someone's role
    // from the screen glow / their reaction.
    const bg = '#1c1f24';
    let body;
    if (!revealed) {
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
      const flip = mid > 180; // keep text upright on the left half of the wheel
      return `<div class="wheel-label" style="transform:rotate(${mid - 90}deg)"><span class="txt" style="transform:translate(-50%,-50%)${flip ? ' rotate(180deg)' : ''}">${esc(w)}</span></div>`;
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
//  WAVELENGTH
// ============================================================
const WL_ACCENT = '#1e8449';
let wlTeams = 1;          // 1 = single shared score; 2-4 = alternating teams
let wlScores = [0];       // per-team totals
let wlRoundNo = 0;        // rounds completed; active team = wlRoundNo % wlTeams

function wlSetTeams(n) {
  wlTeams = Math.max(1, Math.min(4, n));
  wlScores = Array(wlTeams).fill(0);
  wlRoundNo = 0;
}

function wavelengthSetupScreen() {
  const max = Math.max(...wlScores);
  const scoreboard = !wlRoundNo ? '' : wlTeams === 1
    ? `<div class="panel tcenter mb16">Score: <b>${wlScores[0]}</b> over ${wlRoundNo} round${wlRoundNo === 1 ? '' : 's'} <button class="link-btn" id="reset">reset</button></div>`
    : `<div class="panel mb16">
         <div class="panel-title">SCORES</div>
         ${wlScores.map((s, i) => `<div class="row" style="justify-content:space-between;padding:3px 0"><span${s === max && s > 0 ? ' style="font-weight:700;color:var(--correct-accent)"' : ''}>Team ${i + 1}</span><b>${s}</b></div>`).join('')}
         <div class="tcenter"><button class="link-btn mt8" id="reset">reset scores</button></div>
       </div>`;

  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>Wavelength</h1><p>One device, passed around</p></div>
        </div>
        <div class="scroll" style="flex:1">
          <div class="panel mb16">
            <div class="panel-title">HOW TO PLAY</div>
            ${[
              'There is a spectrum between two opposites (e.g. Cold ↔ Hot) with a hidden target zone somewhere on it.',
              'Pick one player to be the Psychic. Only they tap to reveal the target, then hide it again.',
              'The Psychic gives a single clue that points to where the target sits between the two ends.',
              'Everyone else slides the dial to where they think the target is, then locks in the guess.',
              'Reveal scores 4 / 3 / 2 points by how close you land. With teams on, turns alternate each round.',
            ].map((t, i) => `<div class="rule-li"><div class="checkbox" style="background:var(--surface-2)">${i + 1}</div><span>${esc(t)}</span></div>`).join('')}
          </div>

          <div class="panel-title">TEAMS</div>
          <div class="stepper mb8">
            <button class="step-btn" id="tminus">&minus;</button>
            <div class="step-box" id="tcount">${wlTeams}</div>
            <button class="step-btn" id="tplus">+</button>
          </div>
          <div class="tcenter muted2 mb16" style="font-size:12px">${wlTeams === 1 ? 'Single shared score' : `${wlTeams} teams take turns each round`}</div>

          ${scoreboard}
        </div>
        <button class="btn btn-primary" id="start" style="background:${WL_ACCENT}">${wlTeams > 1 ? `Start round — Team ${wlRoundNo % wlTeams + 1}` : 'Start round'}</button>
      </div>
    </div>`);
  on(node, '#back', 'click', mainMenu);
  on(node, '#tminus', 'click', () => { if (wlTeams > 1) { wlSetTeams(wlTeams - 1); wavelengthSetupScreen(); } });
  on(node, '#tplus', 'click', () => { if (wlTeams < 4) { wlSetTeams(wlTeams + 1); wavelengthSetupScreen(); } });
  on(node, '#reset', 'click', () => { wlScores = Array(wlTeams).fill(0); wlRoundNo = 0; wavelengthSetupScreen(); });
  on(node, '#start', 'click', wavelengthRound);
  mount(node);
}

function wavelengthRound() {
  const [leftEnd, rightEnd] = wavelengthPairs[randInt(wavelengthPairs.length)];
  const target = 8 + randInt(85);   // target centre, 8..92
  let guess = 50;
  let phase = 'psychic';            // psychic -> guess -> reveal
  const team = wlRoundNo % wlTeams; // whose turn this round
  const teamTag = wlTeams > 1 ? `<div class="tcenter mb8"><span class="wl-team">Team ${team + 1}'s turn</span></div>` : '';

  // Band geometry (percent of bar width) and points by distance from centre.
  const bands = [
    { half: 20, cls: 'b2' },
    { half: 12, cls: 'b3' },
    { half: 5, cls: 'b4' },
  ];
  const scoreFor = (d) => (d <= 5 ? 4 : d <= 12 ? 3 : d <= 20 ? 2 : 0);

  function bandsHtml() {
    return bands.map((b) => {
      const left = Math.max(0, target - b.half);
      const right = Math.min(100, target + b.half);
      return `<div class="wl-band ${b.cls}" style="left:${left}%;width:${right - left}%"></div>`;
    }).join('');
  }

  // Point labels (2 · 3 · 4 · 3 · 2) centred on each scoring tier.
  function bandLabelsHtml() {
    const pts = [
      { at: target, n: 4 },
      { at: target - 8.5, n: 3 }, { at: target + 8.5, n: 3 },
      { at: target - 16, n: 2 }, { at: target + 16, n: 2 },
    ];
    return pts
      .filter((p) => p.at >= 2 && p.at <= 98)
      .map((p) => `<div class="wl-point" style="left:${p.at}%">${p.n}</div>`)
      .join('');
  }

  function render() {
    let body;
    if (phase === 'psychic') {
      body = `
        ${teamTag}
        <div class="tcenter mb8" style="font-weight:700;letter-spacing:1px;color:var(--muted)">PSYCHIC ONLY</div>
        <div class="muted tcenter mb16" style="font-size:13px">Memorise the target zone, give a one-word clue, then hide it.</div>
        ${spectrumHtml(true, false)}
        <div class="spacer"></div>
        <button class="btn btn-primary" id="hide" style="background:${WL_ACCENT}">Hide target & give clue</button>`;
    } else if (phase === 'guess') {
      body = `
        ${teamTag}
        <div class="tcenter mb8" style="font-weight:700;letter-spacing:1px;color:var(--muted)">EVERYONE ELSE</div>
        <div class="muted tcenter mb16" style="font-size:13px">Slide the dial to the Psychic's clue, then lock it in.</div>
        ${spectrumHtml(false, true)}
        <input type="range" class="wl-range" id="range" min="0" max="100" value="${guess}" />
        <div class="spacer"></div>
        <button class="btn btn-primary" id="lock" style="background:${WL_ACCENT}">Lock in guess</button>`;
    } else {
      const d = Math.abs(target - guess);
      const pts = scoreFor(d);
      const headline = wlTeams > 1
        ? (pts > 0 ? `Team ${team + 1}: +${pts}` : `Team ${team + 1}: missed`)
        : (pts > 0 ? `+${pts} points` : 'Missed it');
      const tally = wlTeams > 1 ? `Team ${team + 1} total: ${wlScores[team]}` : `total ${wlScores[0]}`;
      body = `
        <div class="tcenter mb8" style="font-weight:700;letter-spacing:1px;color:var(--muted)">RESULT</div>
        <div class="tcenter mb16" style="font-size:22px;font-weight:800">${headline}</div>
        ${spectrumHtml(true, true)}
        <div class="tcenter muted mt12" style="font-size:13px">You were ${d} away · ${tally}</div>
        <div class="spacer"></div>
        <button class="btn btn-primary mb8" id="next" style="background:${WL_ACCENT}">${wlTeams > 1 ? `Next round — Team ${wlRoundNo % wlTeams + 1}` : 'Next round'}</button>
        <button class="btn btn-faint" id="menu">Main menu</button>`;
    }

    const node = el(`
      <div class="screen">
        <div class="wrap">
          <div class="app-header">
            <button class="icon-btn" id="back">${icon('back')}</button>
            <div class="grow"><h1>Wavelength</h1></div>
          </div>
          ${body}
        </div>
      </div>`);

    on(node, '#back', 'click', wavelengthSetupScreen);
    if (phase === 'psychic') on(node, '#hide', 'click', () => { phase = 'guess'; render(); });
    if (phase === 'guess') {
      const range = node.querySelector('#range');
      const marker = node.querySelector('#wl-marker');
      range.addEventListener('input', () => { guess = +range.value; marker.style.left = `${guess}%`; });
      on(node, '#lock', 'click', () => {
        phase = 'reveal';
        wlScores[team] += scoreFor(Math.abs(target - guess));
        wlRoundNo++;
        render();
      });
    }
    if (phase === 'reveal') {
      on(node, '#next', 'click', wavelengthRound);
      on(node, '#menu', 'click', mainMenu);
    }
    mount(node);
  }

  /** Spectrum bar with optional target bands and/or the guess marker. */
  function spectrumHtml(showBands, showMarker) {
    return `
      <div class="wl-ends"><span>${esc(leftEnd)}</span><span>${esc(rightEnd)}</span></div>
      <div class="wl-bar">
        ${showBands ? bandsHtml() + bandLabelsHtml() : ''}
        ${showMarker ? `<div class="wl-marker" id="wl-marker" style="left:${guess}%"></div>` : ''}
      </div>`;
  }

  render();
}

// ============================================================
//  CUSTOM LISTS
// ============================================================
function listsScreen() {
  const lists = getCustomLists();
  const node = el(`
    <div class="screen">
      <div class="wrap">
        <div class="app-header">
          <button class="icon-btn" id="back">${icon('back')}</button>
          <div class="grow"><h1>Custom Lists</h1><p>Make your own word lists</p></div>
        </div>
        <button class="btn btn-primary mb16" id="create">${icon('plus', 16)} New list</button>
        <div class="scroll" style="flex:1" id="list">
          ${lists.length === 0 ? `
            <div class="panel tcenter muted" style="padding:28px">
              No custom lists yet. Tap "New list" to make one — it'll show up as a category in every game.
            </div>` :
            lists.map((l) => listCardHtml(l)).join('')}
        </div>
      </div>
    </div>`);

  on(node, '#back', 'click', mainMenu);
  on(node, '#create', 'click', () => listEditor(null));
  on(node, '.list-preview', 'click', (e) => wordPreviewModal(resolveCat(e.currentTarget.dataset.id)));
  on(node, '.list-edit', 'click', (e) => listEditor(getCustomListById(e.currentTarget.dataset.id)));
  on(node, '.list-delete', 'click', (e) => confirmDelete(getCustomListById(e.currentTarget.dataset.id)));
  mount(node);
}

function getCustomListById(id) { return getCustomLists().find((l) => l.id === id); }

function listCardHtml(l) {
  return `
    <div class="list-card">
      ${badge(catSymbol(l.name), l.primary, true)}
      <div class="grow" style="min-width:0">
        <b style="font-size:15px">${esc(l.name)}</b>
        <div class="muted2" style="font-size:12px;margin-top:1px">${l.words.length} words</div>
      </div>
      <button class="icon-btn list-preview" data-id="${l.id}" title="Preview words">${icon('preview', 16)}</button>
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
//  Boot
// ============================================================
mainMenu();
