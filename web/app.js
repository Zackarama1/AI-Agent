"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

const API_BASE = ((window.APP_CONFIG && window.APP_CONFIG.apiBase) || "").replace(/\/$/, "");
const api = (p, o) => fetch(API_BASE ? `${API_BASE}/${p}` : p, o).then((r) => (r.ok ? r.json() : Promise.reject(r)));
const urlOf = (p) => (API_BASE ? `${API_BASE}/${p}` : p);

const PHOTO = {
  ember:  "linear-gradient(140deg,#f0b168,#d9743f 55%,#7c2f2a)",
  sage:   "linear-gradient(150deg,#bcd8a6,#6fa96f 52%,#3c6b58)",
  citrus: "linear-gradient(140deg,#f6d488,#e79b3f 55%,#b5532e)",
  wine:   "linear-gradient(150deg,#c98a9b,#8f3f5c 55%,#3a1f36)",
  slate:  "linear-gradient(150deg,#b8c2cc,#6f8091 52%,#39434f)",
  cream:  "linear-gradient(150deg,#efe2c6,#d8b986 55%,#a97f52)",
};
const TOOL_ICON = { navigate: "🧭", read_page: "👀", click: "👆", fill: "⌨️", select_option: "⌨️", screenshot: "📸", submit_payment: "💳" };

const state = { venues: [], reservations: [], saved: new Set(JSON.parse(localStorage.getItem("saved") || "[]")), hasKey: false, mode: "" };

async function boot() {
  try { const h = await api("api/health"); state.hasKey = h.has_key; state.mode = h.has_key ? "Live AI agent" : "Dry run (demo)"; } catch (_) {}
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  $("#goSaved").addEventListener("click", () => switchView("reservations"));
  $("#askForm").addEventListener("submit", (e) => { e.preventDefault(); askConcierge($("#ask").value); });
  $("#mic").addEventListener("click", toggleVoice);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  await loadVenues();
  await loadReservations();
  paintProfile();
}

function switchView(name) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + name));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "reservations") loadReservations();
  if (name === "profile") paintProfile();
  window.scrollTo(0, 0);
}

/* ---------- venues ---------- */
async function loadVenues() {
  try { state.venues = await api("api/venues"); } catch (_) { state.venues = []; }
  renderVenues();
}
function renderVenues() {
  const list = $("#list"); list.innerHTML = "";
  $("#count").textContent = `${state.venues.length} places with tables`;
  state.venues.forEach((v, i) => {
    const card = el("div", "hotel");
    card.style.animationDelay = `${i * 45}ms`;
    const slots = v.slots.slice(0, 3).map((s) =>
      `<button class="slot-chip" data-slot="${s}">${s}</button>`).join("") +
      `<button class="slot-chip more" data-open="1">More…</button>`;
    card.innerHTML = `
      <div class="photo" style="background-image:${PHOTO[v.photo] || PHOTO.ember}">
        <button class="fav ${state.saved.has(v.id) ? "on" : ""}" aria-label="Save">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="${state.saved.has(v.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-8.5C.5 9 2 5.5 5.3 5.5c2 0 3.2 1.2 3.7 2.2.5-1 1.7-2.2 3.7-2.2 3.3 0 4.8 3.5 2.8 7C19 16.5 12 21 12 21z"/></svg>
        </button>
      </div>
      <div class="body">
        <div class="row1">
          <h3 class="name">${v.name}</h3>
          <div class="price-level">${v.price_level}</div>
        </div>
        <div class="loc"><span class="pin"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 0 0-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg></span>${v.cuisine} <span class="dot">·</span> ${v.neighborhood}</div>
        <div class="rating">${stars(v.rating)}<span class="reviews">${v.reviews} Reviews</span></div>
        <div class="slots-row">${slots}</div>
      </div>`;
    card.querySelector(".fav").addEventListener("click", (e) => { e.stopPropagation(); toggleSaved(v.id); });
    card.addEventListener("click", () => openVenue(v));
    card.querySelectorAll(".slot-chip").forEach((chip) => chip.addEventListener("click", (e) => {
      e.stopPropagation();
      if (chip.dataset.open) return openVenue(v);
      quickBook(v, chip.dataset.slot);
    }));
    list.appendChild(card);
  });
}
function stars(n) {
  let s = '<span class="stars">';
  for (let i = 1; i <= 5; i++) s += `<svg class="${i <= n ? "" : "off"}" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2l2.9 6.3 6.8.7-5.1 4.6 1.5 6.7L12 17.8 5.9 20.9l1.5-6.7L2.3 9.6l6.8-.7z"/></svg>`;
  return s + "</span>";
}
function toggleSaved(id) {
  state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
  localStorage.setItem("saved", JSON.stringify([...state.saved]));
  renderVenues();
}

/* ---------- venue detail ---------- */
function openVenue(v) {
  const slots = v.slots.map((s) => `<button class="slot-chip" data-slot="${s}">${s}</button>`).join("");
  $("#sheetCard").innerHTML = `
    <div class="sheet-photo" style="background-image:${PHOTO[v.photo] || PHOTO.ember}">
      <button class="close" id="closeSheet" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="sheet-body">
      <div class="row1" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
        <h2>${v.name}</h2><div class="price-level" style="font-size:16px">${v.price_level}</div></div>
      <div class="loc" style="display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-top:4px">${v.cuisine} · ${v.neighborhood} · ${v.distance}</div>
      <div class="rating" style="margin-top:8px;display:flex;gap:8px;align-items:center">${stars(v.rating)}<span class="reviews">${v.reviews} Reviews</span></div>
      <div class="amenities">${(v.amenities || []).map((a) => `<span class="chip">${a}</span>`).join("")}</div>
      <p class="desc">${v.description || ""}</p>
      <div style="font-size:13px;color:var(--muted);font-weight:600;margin:16px 2px 8px">Available tonight · party of 2</div>
      <div class="slots-row" id="detailSlots">${slots}</div>
      <div id="bookArea"><button class="cta ghost" id="closeBtn" style="margin-top:16px">Close</button></div>
    </div>`;
  $("#sheet").hidden = false;
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#closeBtn").addEventListener("click", closeSheet);
  $$("#detailSlots .slot-chip").forEach((chip) =>
    chip.addEventListener("click", () => bookNow({ venue: v.name, party_size: 2, time: to24(chip.dataset.slot),
      date: todayISO(), notes: "Party of 2", start_url: v.booking_url || "",
      source_prompt: `Book ${v.name} for 2 at ${chip.dataset.slot}` }, v.name, chip.dataset.slot)));
}
function closeSheet() { $("#sheet").hidden = true; }
function quickBook(v, slot) {
  bookNow({ venue: v.name, party_size: 2, time: to24(slot), date: todayISO(), notes: "Party of 2",
    start_url: v.booking_url || "", source_prompt: `Book ${v.name} for 2 at ${slot}` }, v.name, slot);
}

/* ---------- AI ask -> parse -> confirm ---------- */
async function askConcierge(text) {
  text = (text || "").trim(); if (!text) return;
  openSheetShell("One sec…", `<div class="book-head"><h3>Reading your request</h3><span class="spin" style="border-top-color:var(--teal)"></span></div>`);
  let intent;
  try { intent = await api("api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }) }); }
  catch (_) { closeSheet(); toast("Couldn't reach the concierge."); return; }
  const a = (intent.assumptions || []).length ? `<div class="ask-hint" style="color:var(--teal-2);text-align:left">💡 ${intent.assumptions.join(" ")}</div>` : "";
  $("#sheetCard").innerHTML = `
    <div class="sheet-body" style="padding-top:22px">
      <div class="book-head"><h3>Confirm your table</h3><button class="close" id="closeSheet" style="position:static;box-shadow:none;background:var(--card)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="amenities" style="margin:6px 0 12px">
        ${fieldChip("Venue", "venue", intent.venue || "a nearby spot")}
        ${fieldChip("Party", "party", intent.party_size)}
        ${fieldChip("Date", "date", intent.date)}
        ${fieldChip("Time", "time", to12(intent.time))}
      </div>${a}
      <button class="cta" id="confirmBook">✨ Book with AI</button>
      <button class="cta ghost" id="closeBtn">Cancel</button>
    </div>`;
  $("#sheet").hidden = false;
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#closeBtn").addEventListener("click", closeSheet);
  $("#confirmBook").addEventListener("click", () => bookNow({
    venue: intent.venue || "the venue", party_size: intent.party_size, time: intent.time, date: intent.date,
    notes: intent.notes || `Party of ${intent.party_size}`, start_url: "", source_prompt: intent.source_prompt || text,
  }, intent.venue || "your table", to12(intent.time)));
}
function fieldChip(label, k, val) { return `<span class="chip"><b style="color:var(--muted);font-weight:600">${label}:</b> ${val}</span>`; }

/* ---------- voice ---------- */
let recog = null, listening = false;
function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice needs Chrome/Safari — type instead."); $("#ask").focus(); return; }
  if (listening) { recog && recog.stop(); return; }
  recog = new SR(); recog.lang = "en-US"; recog.interimResults = true; listening = true;
  $("#mic").classList.add("listening"); $("#askHint").textContent = "Listening…";
  recog.onresult = (e) => { const t = [...e.results].map((r) => r[0].transcript).join(""); $("#ask").value = t;
    if (e.results[e.results.length - 1].isFinal) { stopVoice(); askConcierge(t); } };
  recog.onerror = () => { stopVoice(); toast("Didn't catch that — try typing."); };
  recog.onend = stopVoice; recog.start();
}
function stopVoice() { listening = false; $("#mic").classList.remove("listening"); $("#askHint").textContent = "Say it or type it — the agent books it for you."; }

/* ---------- booking (live agent) ---------- */
function openSheetShell(title, inner) { $("#sheetCard").innerHTML = `<div class="sheet-body" style="padding-top:22px">${inner}</div>`; $("#sheet").hidden = false; }

async function bookNow(payload, venueName, whenLabel) {
  openSheetShell("Booking", `
    <div class="book-head"><h3>Booking ${venueName}</h3></div>
    <div class="banner" id="bk-banner" hidden></div>
    <ol class="timeline" id="bk-log"></ol>
    <button class="cta ghost" id="bk-done" hidden>View reservation</button>`);
  addEvent("⚙️", "Session", whenLabel ? `Requested ${whenLabel}` : "");
  let res, run;
  try { res = await api("api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
  catch (_) { toast("Couldn't start booking."); return; }
  try { run = await api(`api/reservations/${res.id}/book`, { method: "POST" }); }
  catch (_) { toast("Couldn't reach the agent."); return; }
  $("#bk-done").addEventListener("click", () => { closeSheet(); switchView("reservations"); });
  streamRun(run.run_id, () => { $("#bk-done").hidden = false; loadReservations(); });
}

function streamRun(runId, onDone) {
  const src = new EventSource(urlOf(`api/runs/${runId}/stream`));
  src.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (!$("#bk-log")) { src.close(); return; }
    if (ev.type === "status") addEvent("⚙️", "Session", ev.message);
    else if (ev.type === "assistant") addEvent("💭", "Agent", ev.text, "assistant");
    else if (ev.type === "action") {
      const inp = ev.input && Object.keys(ev.input).length ? JSON.stringify(ev.input) : "";
      addEvent(TOOL_ICON[ev.tool] || "🔧", `${ev.tool} · step ${ev.step}`, [inp, ev.result].filter(Boolean).join("\n"));
    } else if (ev.type === "result") showBanner(ev);
    else if (ev.type === "error") { addEvent("⛔", "Error", ev.message); showBanner({ outcome: "failed", note: ev.message }); }
    else if (ev.type === "end") { src.close(); onDone && onDone(); }
  };
  src.onerror = () => { src.close(); onDone && onDone(); };
}
function addEvent(ic, tl, dt, cls) {
  const log = $("#bk-log"); if (!log || (!dt && tl === "Session")) return;
  const li = el("li", "event" + (cls ? " " + cls : ""));
  li.appendChild(el("div", "ic", ic));
  const b = el("div"); b.appendChild(el("div", "tl", tl));
  if (dt) { const d = el("div", "dt"); d.textContent = dt; b.appendChild(d); }
  li.appendChild(b); log.appendChild(li);
  li.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function showBanner(ev) {
  const b = $("#bk-banner"); if (!b) return;
  const ok = ev.outcome === "success" || ev.outcome === "confirmed";
  b.className = "banner " + (ok ? "ok" : "");
  b.innerHTML = (ok ? "✅ Table booked" : ev.outcome === "needs_human" ? "🙋 Needs you" : "❌ Couldn’t complete")
    + (ev.note ? `<small>${ev.note}</small>` : "");
  b.hidden = false;
  if (ok) toast("Added to your reservations ✨");
}

/* ---------- reservations ---------- */
async function loadReservations() {
  try { state.reservations = await api("api/reservations"); } catch (_) { state.reservations = []; }
  const wrap = $("#reservations"); wrap.innerHTML = "";
  const active = state.reservations.filter((r) => r.status !== "cancelled").reverse();
  if (!active.length) { wrap.appendChild(el("div", "empty", "No tables yet — ask the concierge or tap a place.")); paintProfile(); return; }
  active.forEach((r) => {
    const v = state.venues.find((x) => x.name === r.venue);
    const photo = PHOTO[(v && v.photo)] || PHOTO.slate;
    const label = { confirmed: "Confirmed", pending: "Booking…", needs_human: "Needs you", failed: "Failed" }[r.status] || r.status;
    const cls = r.status === "confirmed" ? "confirmed" : r.status === "pending" ? "pending" : "cancelled";
    const t = el("div", "trip");
    t.innerHTML = `<div class="thumb" style="background-image:${photo}"></div>
      <div><div class="t-name">${r.venue}</div><div class="t-meta">${prettyWhen(r)}</div></div>
      <div class="status ${cls}">${label}</div>`;
    wrap.appendChild(t);
  });
  paintProfile();
}
function prettyWhen(r) {
  const parts = [];
  if (r.party_size) parts.push(`Party of ${r.party_size}`);
  if (r.time) parts.push(to12(r.time));
  if (r.date) parts.push(dateLabel(r.date));
  return parts.join(" · ") || (r.notes || "");
}

function paintProfile() {
  $("#pemail").textContent = "guest@concierge.app";
  $("#pmode").textContent = state.mode || "—";
  $("#ptrips").textContent = String(state.reservations.filter((r) => r.status === "confirmed").length);
}

/* ---------- time/date helpers ---------- */
function to24(s) { const m = (s || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i); if (!m) return "19:00";
  let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return `${String(h).padStart(2, "0")}:${m[2]}`; }
function to12(t) { if (!t) return "7:00 PM"; const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function dateLabel(d) { const t = new Date(); t.setHours(0, 0, 0, 0); const dt = new Date(d + "T00:00:00");
  const diff = Math.round((dt - t) / 864e5); if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow";
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3000); }

boot();
