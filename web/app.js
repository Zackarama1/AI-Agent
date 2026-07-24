"use strict";

/* ---------------- tiny helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = (p, opts) => fetch(p, opts).then((r) => (r.ok ? r.json() : Promise.reject(r)));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const state = { hasKey: false, reservations: [], intent: null };

const TOOL_ICON = { navigate: "🧭", read_page: "👀", click: "👆", fill: "⌨️", screenshot: "📸", submit_payment: "💳" };
const STATUS_LABEL = { confirmed: "Confirmed", pending: "Booking…", draft: "Draft", failed: "Failed", needs_human: "Needs you", cancelled: "Cancelled" };

/* ---------------- boot ---------------- */
async function boot() {
  try { const h = await api("api/health"); state.hasKey = !!h.has_key; } catch (_) {}
  paintMode();

  $$(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  $("#modePill").addEventListener("click", () =>
    toast(state.hasKey ? "A live API key is set — bookings use the real AI agent."
                       : "No API key on the server — running in scripted dry-run mode."));

  $("#promptForm").addEventListener("submit", (e) => { e.preventDefault(); submitPrompt($("#prompt").value); });
  $$("#chips button").forEach((b) => b.addEventListener("click", () => { $("#prompt").value = b.dataset.fill; submitPrompt(b.dataset.fill); }));
  $("#mic").addEventListener("click", toggleVoice);
  $("#sheetClose").addEventListener("click", () => $("#sheet").hidden = true);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  loadReservations();
}

function paintMode() {
  const pill = $("#modePill");
  pill.textContent = state.hasKey ? "● Live agent" : "● Dry run";
  pill.className = "pill " + (state.hasKey ? "real" : "dry");
}

/* ---------------- view routing ---------------- */
function switchView(name) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + name));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "calendar" || name === "activity") loadReservations();
}

/* ---------------- voice (Web Speech API) ---------------- */
let recog = null, listening = false;
function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice isn't supported in this browser — type instead."); $("#prompt").focus(); return; }
  if (listening) { recog && recog.stop(); return; }
  recog = new SR();
  recog.lang = "en-US"; recog.interimResults = true; recog.maxAlternatives = 1;
  listening = true;
  $("#mic").classList.add("listening");
  $("#micHint").textContent = "Listening…";
  recog.onresult = (e) => {
    const text = [...e.results].map((r) => r[0].transcript).join("");
    $("#prompt").value = text;
    if (e.results[e.results.length - 1].isFinal) { stopVoice(); submitPrompt(text); }
  };
  recog.onerror = () => { stopVoice(); toast("Didn't catch that — try again or type."); };
  recog.onend = () => stopVoice();
  recog.start();
}
function stopVoice() {
  listening = false;
  $("#mic").classList.remove("listening");
  $("#micHint").textContent = "Tap to speak";
}

/* ---------------- prompt -> intent ---------------- */
async function submitPrompt(text) {
  text = (text || "").trim();
  if (!text) return;
  const wrap = $("#intentWrap");
  wrap.innerHTML = `<div class="card"><div class="card-title">Understanding your request<span class="spinner" style="border-top-color:var(--violet)"></span></div></div>`;
  wrap.scrollIntoView({ behavior: "smooth", block: "center" });
  try {
    const intent = await api("api/parse", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }),
    });
    state.intent = intent;
    renderIntent(intent);
  } catch (_) {
    wrap.innerHTML = `<div class="card"><div class="banner bad">Couldn't reach the concierge server.</div></div>`;
  }
}

function fieldRow(label, id, value, type = "text", wide = false) {
  const safe = String(value ?? "").replace(/"/g, "&quot;");
  return `<div class="f ${wide ? "wide" : ""}"><label>${label}</label><input id="if-${id}" type="${type}" value="${safe}"></div>`;
}

function renderIntent(it) {
  const pct = Math.round((it.confidence || 0) * 100);
  const assumptions = (it.assumptions || []).length
    ? `<div class="assume">💡 ${it.assumptions.join(" ")}</div>` : "";
  const engine = it.used_model ? "AI understood your request" : "Parsed your request";
  $("#intentWrap").innerHTML = `
    <div class="card">
      <div class="card-title">${engine}<span class="conf">${pct}% sure</span></div>
      <div class="fields">
        ${fieldRow("Venue", "venue", it.venue, "text", true)}
        ${fieldRow("Party", "party_size", it.party_size, "number")}
        ${fieldRow("Date", "date", it.date, "date")}
        ${fieldRow("Time", "time", it.time, "time")}
        ${fieldRow("Under name", "name", it.name)}
        ${fieldRow("Phone", "phone", it.phone, "tel", true)}
        ${fieldRow("Notes", "notes", it.notes, "text", true)}
        ${fieldRow("Booking form URL (optional)", "start_url", it.start_url, "url", true)}
      </div>
      ${assumptions}
      <div class="actions">
        <button class="btn" id="callBtn">📞 Call venue</button>
        <button class="btn primary" id="bookBtn">✨ Book with AI</button>
      </div>
    </div>`;
  $("#bookBtn").addEventListener("click", () => confirmAndBook());
  $("#callBtn").addEventListener("click", () => confirmAndCall());
}

function collectIntent() {
  const g = (id) => { const e = $("#if-" + id); return e ? e.value.trim() : ""; };
  return {
    venue: g("venue"), party_size: parseInt(g("party_size") || "2", 10),
    date: g("date"), time: g("time"), name: g("name"), phone: g("phone"),
    notes: g("notes"), start_url: g("start_url"),
    method: "agent", source_prompt: (state.intent && state.intent.source_prompt) || "",
  };
}

async function createReservation() {
  const body = collectIntent();
  return api("api/reservations", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

/* ---------------- book with AI agent (live sheet) ---------------- */
async function confirmAndBook() {
  const btn = $("#bookBtn");
  btn.disabled = true; btn.innerHTML = 'Starting<span class="spinner"></span>';
  let res, run;
  try {
    res = await createReservation();
    run = await api(`api/reservations/${res.id}/book`, { method: "POST" });
  } catch (_) {
    btn.disabled = false; btn.textContent = "✨ Book with AI";
    toast("Could not start the booking.");
    return;
  }
  openSheet(`Booking ${res.venue || "your table"}`, `${run.mode === "real" ? "Live AI agent" : "Dry-run agent"} · party of ${res.party_size}`);
  streamRun(run.run_id, () => { btn.disabled = false; btn.textContent = "✨ Book with AI"; loadReservations(); });
}

async function confirmAndCall() {
  let res;
  try { res = await createReservation(); }
  catch (_) { toast("Could not save the reservation."); return; }
  try {
    const r = await api(`api/reservations/${res.id}/call`, { method: "POST" });
    openSheet("Phone agent", "Calling on your behalf");
    $("#sheetLog").innerHTML = "";
    $("#sheetBanner").hidden = false;
    $("#sheetBanner").className = "banner warn";
    $("#sheetBanner").innerHTML = `Not connected yet<small>${r.message}</small>`;
    $("#sheetClose").hidden = false;
    loadReservations();
  } catch (_) { toast("Phone agent unavailable."); }
}

/* ---------------- SSE streaming into the sheet ---------------- */
function openSheet(title, sub) {
  $("#sheetTitle").textContent = title;
  $("#sheetSub").textContent = sub || "";
  $("#sheetLog").innerHTML = "";
  $("#sheetBanner").hidden = true;
  $("#sheetClose").hidden = true;
  $("#sheet").hidden = false;
}

function addEvent(icon, tool, detail, cls) {
  const li = el("li", "event" + (cls ? " " + cls : ""));
  li.appendChild(el("div", "ic", icon));
  const body = el("div", "body");
  body.appendChild(el("div", "tool", tool));
  if (detail) { const d = el("div", "detail"); d.textContent = detail; body.appendChild(d); }
  li.appendChild(body);
  $("#sheetLog").appendChild(li);
  li.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function streamRun(runId, onDone) {
  const src = new EventSource(`api/runs/${runId}/stream`);
  src.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    switch (ev.type) {
      case "status": addEvent("⚙️", "Session", ev.message); break;
      case "assistant": addEvent("💭", "Agent", ev.text, "assistant"); break;
      case "action": {
        const input = ev.input && Object.keys(ev.input).length ? JSON.stringify(ev.input) : "";
        addEvent(TOOL_ICON[ev.tool] || "🔧", `${ev.tool} · step ${ev.step}`, [input, ev.result].filter(Boolean).join("\n"));
        break;
      }
      case "result": showBanner(ev); break;
      case "error": addEvent("⛔", "Error", ev.message, "error"); showBanner({ outcome: "failed", note: ev.message }); break;
      case "end": src.close(); $("#sheetClose").hidden = false; onDone && onDone(); break;
    }
  };
  src.onerror = () => { src.close(); $("#sheetClose").hidden = false; onDone && onDone(); };
}

function showBanner(ev) {
  const map = { success: ["ok", "✅ Booked"], confirmed: ["ok", "✅ Booked"], needs_human: ["warn", "🙋 Needs your input"], failed: ["bad", "❌ Couldn't complete"] };
  const [cls, title] = map[ev.outcome] || ["", ev.outcome];
  const b = $("#sheetBanner");
  b.className = "banner " + cls;
  b.innerHTML = title + (ev.note ? `<small>${ev.note}</small>` : "");
  b.hidden = false;
  if (cls === "ok") toast("Added to your calendar ✨");
}

/* ---------------- reservations / calendar / activity ---------------- */
async function loadReservations() {
  try { state.reservations = await api("api/reservations"); }
  catch (_) { state.reservations = []; }
  renderMonthStrip();
  renderAgenda();
  renderActivity();
}

function fmtTime(t) {
  if (!t) return "--";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM"; const h12 = ((h + 11) % 12) + 1;
  return { top: `${h12}:${String(m).padStart(2, "0")}`, ap };
}
function dateLabel(d) {
  if (!d) return "Someday";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = new Date(d + "T00:00:00");
  const diff = Math.round((dt - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function renderMonthStrip() {
  const strip = $("#monthStrip"); strip.innerHTML = "";
  const days = {}; state.reservations.forEach((r) => { if (r.date && r.status !== "cancelled") days[r.date] = true; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const dt = new Date(today.getTime() + i * 86400000);
    const iso = dt.toISOString().slice(0, 10);
    const col = el("div", "daycol" + (days[iso] ? " has" : "") + (i === 0 ? " today" : ""));
    col.innerHTML = `<div class="dow">${dt.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}</div>
                     <div class="dnum">${dt.getDate()}</div>${days[iso] ? '<div class="dot"></div>' : ""}`;
    strip.appendChild(col);
  }
}

function resCard(r) {
  const t = fmtTime(r.time);
  const card = el("div", "res");
  card.innerHTML = `
    <div class="time"><b>${t.top || "--"}</b><span>${t.ap || ""}</span></div>
    <div><div class="name">${r.venue || "Reservation"}</div>
      <div class="meta">Party of ${r.party_size}${r.name ? " · " + r.name : ""}${r.notes ? " · " + r.notes : ""}</div></div>
    <div class="status ${r.status}">${STATUS_LABEL[r.status] || r.status}</div>`;
  card.addEventListener("click", () => resDetail(r));
  return card;
}

function renderAgenda() {
  const wrap = $("#agenda"); wrap.innerHTML = "";
  const active = state.reservations.filter((r) => r.status !== "cancelled");
  if (!active.length) { wrap.appendChild(emptyState("No reservations yet", "Ask the concierge to book one.")); return; }
  const groups = {};
  active.forEach((r) => { (groups[r.date || ""] ||= []).push(r); });
  Object.keys(groups).sort().forEach((d) => {
    wrap.appendChild(el("div", "date-group", dateLabel(d)));
    groups[d].forEach((r) => wrap.appendChild(resCard(r)));
  });
}

function renderActivity() {
  const wrap = $("#activity"); wrap.innerHTML = "";
  const all = [...state.reservations].sort((a, b) => (b.created || 0) - (a.created || 0));
  if (!all.length) { wrap.appendChild(emptyState("Nothing here yet", "Your booking history will appear here.")); return; }
  all.forEach((r) => wrap.appendChild(resCard(r)));
}

function emptyState(title, sub) {
  return el("div", "empty",
    `<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
     <div style="font-weight:700;font-size:16px;color:var(--text)">${title}</div><div class="muted">${sub}</div>`);
}

function resDetail(r) {
  openSheet(r.venue || "Reservation", `${dateLabel(r.date)} · ${(fmtTime(r.time).top || "")} ${(fmtTime(r.time).ap || "")}`);
  const b = $("#sheetBanner"); b.hidden = false;
  const cls = { confirmed: "ok", pending: "warn", failed: "bad", needs_human: "warn" }[r.status] || "";
  b.className = "banner " + cls;
  b.innerHTML = `${STATUS_LABEL[r.status] || r.status}<small>Party of ${r.party_size}${r.name ? " · " + r.name : ""}${r.source_prompt ? '<br>“' + r.source_prompt + '”' : ""}</small>`;
  const log = $("#sheetLog"); log.innerHTML = "";
  if (r.status !== "cancelled") {
    const row = el("li"); const btn = el("button", "btn", "Cancel reservation");
    btn.style.width = "100%";
    btn.addEventListener("click", async () => { await api(`api/reservations/${r.id}/cancel`, { method: "POST" }); $("#sheet").hidden = true; loadReservations(); toast("Reservation cancelled."); });
    row.appendChild(btn); log.appendChild(row);
  }
  $("#sheetClose").hidden = false;
}

/* ---------------- toast ---------------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

boot();
