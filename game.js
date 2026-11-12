const STORAGE_KEY = "giddys-game-v2";
const MAX_TRIES = 3;

const YAYS = ["Yes!! 🎉", "You got it!", "Correct, genius 💜", "Nailed it!", "Of course you knew that 😌"];
const NOPES = ["Nope, try again!", "Hmm, not quite…", "Ooh, so close? Maybe? 🙈", "Think harder 🤔"];

const $ = (sel) => document.querySelector(sel);
const app = $("#app");
// phones/tablets: the on-screen keyboard is involved, so we smooth out the transition
const TOUCH = matchMedia("(pointer: coarse)").matches;

// Add ?date=YYYY-MM-DD to the URL to preview a specific day.
const params = new URLSearchParams(location.search);
const TODAY = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : dateKey(new Date());

let days = [];
let progress = loadProgress();

/* ---------- helpers ---------- */

function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function prettyDate(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getDay = (k) => days.find((d) => d.date === k);
const getProg = (k) => (progress[k] ||= { index: 0, tries: 0, results: [], done: false, started: false });
const hasStarted = (p) => p.started || p.index > 0 || p.tries > 0;
const themeLabel = (day) => (day.theme ? `${day.emoji ? day.emoji + " " : ""}${day.theme}` : "");
const answersOf = (q) => [].concat(q.answers ?? q.answer ?? []).map(String);
const scoreOf = (p) => p.results.filter((r) => r && r.correct).length;

/* ---------- answer checking (forgiving!) ---------- */

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an|my|our) /, "");
}

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function isCorrect(guess, answers) {
  const g = normalize(guess);
  if (!g) return false;
  return answers.some((a) => {
    const n = normalize(a);
    if (n === g) return true;
    // numbers (years, counts) must match exactly, so "1913" doesn't pass for "1912"
    if (/\d/.test(n)) return false;
    // allow small typos on longer answers
    const tolerance = n.length >= 8 ? 2 : n.length >= 4 ? 1 : 0;
    return levenshtein(g, n) <= tolerance;
  });
}

/* ---------- streak ---------- */

function computeStreak() {
  // Only days that actually have questions count, so a day with no questions never breaks the streak.
  const past = days.map((d) => d.date).filter((k) => k <= TODAY).sort().reverse();
  let streak = 0;
  for (const k of past) {
    const p = progress[k];
    if (p && p.done && p.completedOn === k) streak++;
    else if (k === TODAY) continue; // today isn't over yet
    else break;
  }
  return streak;
}

function updateStreak() {
  const s = computeStreak();
  const el = $("#streak");
  el.hidden = s === 0;
  el.textContent = `🔥 ${s} day streak`;
}

/* ---------- views ---------- */

function hearts(left) {
  return Array.from({ length: MAX_TRIES }, (_, i) => `<span class="${i < left ? "on" : "off"}">♥</span>`).join("");
}
const hintHtml = (h) => `<p class="hint">💡 Hint: ${esc(h)}</p>`;

function openDay(k) {
  const day = getDay(k);
  if (!day) return renderEmpty();
  const p = getProg(k);
  if (p.done) return renderSummary(k);
  if (day.theme && !hasStarted(p)) return renderIntro(k);
  renderQuestion(k);
}

function renderIntro(k) {
  const day = getDay(k);
  const p = getProg(k);
  const n = day.questions.length;
  app.innerHTML = `
    <section class="card intro">
      <p class="eyebrow">${k === TODAY ? "Today's theme" : esc(prettyDate(k))}</p>
      <div class="big theme-emoji">${esc(day.emoji || "✨")}</div>
      <h2 class="theme-name">${esc(day.theme)}</h2>
      ${day.intro ? `<p class="muted">${esc(day.intro)}</p>` : ""}
      <p class="muted">${n} question${n === 1 ? "" : "s"} · ${MAX_TRIES} tries each</p>
      <button class="btn" id="start" type="button">Let's go →</button>
    </section>`;
  const start = $("#start");
  start.focus();
  start.onclick = () => {
    p.started = true;
    saveProgress();
    renderQuestion(k);
  };
}

function renderQuestion(k) {
  const day = getDay(k);
  const p = getProg(k);
  const q = day.questions[p.index];
  const total = day.questions.length;

  app.innerHTML = `
    <section class="card">
      <div class="dots">
        ${day.questions.map((_, i) => {
          const cls = i < p.index ? (p.results[i]?.correct ? "good" : "miss") : i === p.index ? "current" : "";
          return `<span class="dot ${cls}"></span>`;
        }).join("")}
      </div>
      <p class="eyebrow">${k !== TODAY ? esc(prettyDate(k)) + " · " : ""}${day.theme && k !== TODAY ? esc(themeLabel(day)) + " · " : ""}Question ${p.index + 1} of ${total}</p>
      <h2 class="question">${esc(q.question)}</h2>
      <form id="guess-form" autocomplete="off">
        <input id="guess" type="text" placeholder="Type your answer…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" />
        <button class="btn" type="submit">Guess</button>
      </form>
      <div class="hearts" aria-label="tries left">${hearts(MAX_TRIES - p.tries)}</div>
      <div id="feedback" class="feedback" aria-live="polite">${p.tries > 0 && q.hint ? hintHtml(q.hint) : ""}</div>
      <button class="link" id="give-up" type="button">I give up 🦤</button>
    </section>`;

  const input = $("#guess");
  input.focus();

  $("#guess-form").onsubmit = (e) => {
    e.preventDefault();
    const g = input.value;
    if (!g.trim()) return;
    if (isCorrect(g, answersOf(q))) return resolve(k, true);

    p.tries++;
    saveProgress();
    if (p.tries >= MAX_TRIES) return resolve(k, false);

    const card = $(".card");
    card.classList.remove("shake");
    void card.offsetWidth; // restart animation
    card.classList.add("shake");
    $(".hearts").innerHTML = hearts(MAX_TRIES - p.tries);
    $("#feedback").innerHTML = `<p class="nope">${esc(pick(NOPES))}</p>${q.hint ? hintHtml(q.hint) : ""}`;
    input.select();
  };

  $("#give-up").onclick = () => resolve(k, false);
}

function resolve(k, correct) {
  const day = getDay(k);
  const p = getProg(k);
  const q = day.questions[p.index];

  p.results[p.index] = { correct };
  p.index++;
  p.tries = 0;
  const last = p.index >= day.questions.length;
  if (last) {
    p.done = true;
    p.completedOn = TODAY;
  }
  saveProgress();
  updateStreak();

  // Start closing the keyboard right away, before the screen changes.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

  app.innerHTML = `
    <section class="card reveal${TOUCH ? " no-pop" : ""}">
      <div class="big">${correct ? "🎉" : "💭"}</div>
      <h2>${correct ? esc(pick(YAYS)) : "Not quite!"}</h2>
      <p class="answer">${correct ? "" : "The answer was "}<strong>${esc(answersOf(q)[0])}</strong></p>
      ${q.note ? `<p class="note">${esc(q.note)}</p>` : ""}
      <button class="btn" id="next" type="button">${last ? "See my score" : "Next question →"}</button>
    </section>`;

  // Undo the scroll the phone did to keep the text box visible, so nothing jumps.
  window.scrollTo(0, 0);
  // Let the keyboard finish sliding away before the confetti starts.
  if (correct) setTimeout(confetti, TOUCH ? 300 : 0);

  const next = $("#next");
  if (!TOUCH) next.focus();
  next.onclick = () => (last ? renderSummary(k, true) : renderQuestion(k));
}

function renderSummary(k, justFinished = false) {
  const day = getDay(k);
  const p = getProg(k);
  const score = scoreOf(p);
  const total = day.questions.length;
  const msg =
    score === total ? "Perfect score!! 🥹"
    : score >= total / 2 ? "So good!! I'm impressed sexy lady 💜"
    : "Arghh tough round today, thats okay!! you learned something new 😌";

  app.innerHTML = `
    <section class="card summary">
      <p class="eyebrow">${[k !== TODAY ? prettyDate(k) : "", themeLabel(day)].filter(Boolean).map(esc).join(" · ")}</p>
      <div class="score">${score}<span>/${total}</span></div>
      <h2>${msg}</h2>
      <ol class="recap">
        ${day.questions.map((q, i) => {
          const ok = p.results[i]?.correct;
          return `<li class="${ok ? "good" : "miss"}">
            <span class="mark">${ok ? "✓" : "✗"}</span>
            <div>
              <p class="rq">${esc(q.question)}</p>
              <p class="ra">${esc(answersOf(q)[0])}</p>
              ${q.note ? `<p class="note small">${esc(q.note)}</p>` : ""}
            </div>
          </li>`;
        }).join("")}
      </ol>
      ${k === TODAY ? `<p class="muted">New questions tomorrow 💌</p>` : ""}
    </section>`;

  if (justFinished && score === total) setTimeout(confetti, 150);
}

function renderArchive() {
  const past = days.filter((d) => d.date <= TODAY).reverse();
  app.innerHTML = `
    <section class="card">
      <h2 class="title">Past days</h2>
      ${past.length ? `<ul class="archive">
        ${past.map((d) => {
          const p = progress[d.date];
          const status = p?.done ? `${scoreOf(p)}/${d.questions.length}` : p && p.index > 0 ? "in progress" : "not played";
          return `<li><button type="button" data-k="${d.date}">
            <span class="arch-label">
              <span>${esc(prettyDate(d.date))}${d.date === TODAY ? " · today" : ""}</span>
              ${d.theme ? `<span class="arch-theme">${esc(themeLabel(d))}</span>` : ""}
            </span>
            <span class="badge ${p?.done ? "done" : ""}">${status}</span>
          </button></li>`;
        }).join("")}
      </ul>` : `<p class="muted center">Nothing here yet!</p>`}
    </section>`;
  app.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => openDay(b.dataset.k)));
}

function renderEmpty() {
  app.innerHTML = `
    <section class="card empty">
      <div class="big">🫠</div>
      <h2>No questions yet today!</h2>
      <p class="muted">Go bug your favorite person about it 😤</p>
    </section>`;
}

function renderError(msg, detail = "") {
  app.innerHTML = `
    <section class="card empty">
      <div class="big">🙃</div>
      <h2>Uh oh</h2>
      <p class="muted">${esc(msg)}</p>
      ${detail ? `<p class="muted" style="font-size:.8rem">${esc(detail)}</p>` : ""}
    </section>`;
}

/* ---------- confetti ---------- */

function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.className = "confetti";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = innerWidth, H = innerHeight;
  c.width = W * dpr;
  c.height = H * dpr;
  ctx.scale(dpr, dpr);

  const colors = ["#b9a5e4", "#f6c1cf", "#ffd98e", "#a8e0c9", "#a9cdf2"];
  const parts = Array.from({ length: 130 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 12 - 4,
    r: Math.random() * 360,
    vr: (Math.random() - 0.5) * 12,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  const DURATION = 2600;
  const start = performance.now();
  (function frame(t) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.r * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(frame);
    else c.remove();
  })(start);
}

/* ---------- start ---------- */

$("#nav-today").onclick = () => openDay(TODAY);
$("#nav-archive").onclick = renderArchive;
$("#today-date").textContent = prettyDate(TODAY);

(async function init() {
  let text;
  try {
    const res = await fetch(`questions.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    text = await res.text();
  } catch {
    return renderError("Couldn't load the questions. Try refreshing!");
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return renderError("The questions file has a typo in it (probably a missing comma or quote).", e.message);
  }

  days = (Array.isArray(data) ? data : [])
    .filter((d) => d && d.date && Array.isArray(d.questions) && d.questions.length)
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayDay = getDay(TODAY);
  if (todayDay && todayDay.theme) {
    const el = $("#today-theme");
    el.textContent = themeLabel(todayDay);
    el.hidden = false;
  }

  updateStreak();
  openDay(TODAY);
})();
