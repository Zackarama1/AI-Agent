"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

const API_BASE = ((window.APP_CONFIG && window.APP_CONFIG.apiBase) || "").replace(/\/$/, "");
const urlOf = (p) => (API_BASE ? `${API_BASE}/${p}` : p);
function api(p, opts = {}) {
  const h = Object.assign({}, opts.headers);
  if (state.token) h["Authorization"] = "Bearer " + state.token;
  return fetch(urlOf(p), Object.assign({}, opts, { headers: h }))
    .then((r) => (r.ok ? r.json() : r.json().catch(() => ({})).then((b) => Promise.reject(Object.assign(r, { body: b })))));
}

const PHOTO = {
  ember: "linear-gradient(140deg,#f0b168,#d9743f 55%,#7c2f2a)", sage: "linear-gradient(150deg,#bcd8a6,#6fa96f 52%,#3c6b58)",
  citrus: "linear-gradient(140deg,#f6d488,#e79b3f 55%,#b5532e)", wine: "linear-gradient(150deg,#c98a9b,#8f3f5c 55%,#3a1f36)",
  slate: "linear-gradient(150deg,#b8c2cc,#6f8091 52%,#39434f)", cream: "linear-gradient(150deg,#efe2c6,#d8b986 55%,#a97f52)",
};
const AV_COLORS = ["#3fcabb", "#ff7a66", "#6c5ce7", "#f6b73c", "#4a90d9", "#e26aa0"];
const EVT_COLORS = ["", "coral", "plum"];

const state = { token: localStorage.getItem("token") || "", user: null, venues: [], reservations: [],
  saved: new Set(JSON.parse(localStorage.getItem("saved") || "[]")), mode: "",
  calMonth: firstOfMonth(new Date()), calSel: ymd(new Date()),
  book: { date: ymd(new Date()), party: 2 },
  filters: { cuisines: new Set(), price: new Set(), minRating: 0, sort: "rating" } };

/* ================= AUTH ================= */
let authMode = "in";
function showAuth() { $("#auth").hidden = false; $("#app").hidden = true; }
function showApp() { $("#auth").hidden = true; $("#app").hidden = false; }

async function boot() {
  wireAuth();
  if (state.token) {
    try { state.user = await api("api/auth/me"); startApp(); return; }
    catch (_) { state.token = ""; localStorage.removeItem("token"); }
  }
  showAuth();
}
function wireAuth() {
  $("#segIn").addEventListener("click", () => setAuthMode("in"));
  $("#segUp").addEventListener("click", () => setAuthMode("up"));
  $("#authForm").addEventListener("submit", submitAuth);
}
function setAuthMode(m) {
  authMode = m;
  $("#segIn").classList.toggle("on", m === "in");
  $("#segUp").classList.toggle("on", m === "up");
  $("#nameField").hidden = m === "in";
  $("#au-submit").textContent = m === "in" ? "Sign in" : "Create account";
  $("#au-pass").autocomplete = m === "in" ? "current-password" : "new-password";
  $("#au-error").textContent = "";
}
async function submitAuth(e) {
  e.preventDefault();
  const email = $("#au-email").value.trim(), pass = $("#au-pass").value, name = $("#au-name").value.trim();
  const err = $("#au-error"); err.textContent = "";
  const btn = $("#au-submit"); btn.disabled = true; const label = btn.textContent; btn.textContent = "…";
  try {
    const path = authMode === "in" ? "api/auth/login" : "api/auth/signup";
    const body = authMode === "in" ? { email, password: pass } : { email, password: pass, name };
    const res = await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    state.token = res.token; state.user = res.user; localStorage.setItem("token", res.token);
    startApp();
  } catch (r) {
    err.textContent = (r && r.body && r.body.detail) || "Something went wrong. Try again.";
    btn.disabled = false; btn.textContent = label;
  }
}
function logout() { state.token = ""; state.user = null; localStorage.removeItem("token"); showAuth(); }

/* ================= APP ================= */
async function startApp() {
  showApp();
  try { const h = await api("api/health"); state.mode = h.has_key ? (h.hosted_browser ? "Live agent · hosted" : "Live agent") : "Dry run (demo)"; } catch (_) {}
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  $("#askForm").addEventListener("submit", (e) => { e.preventDefault(); askConcierge($("#ask").value); });
  $("#mic").addEventListener("click", toggleVoice);
  $("#logout").addEventListener("click", logout);
  $("#dateBtn").addEventListener("click", openDatePicker);
  $("#partyBtn").addEventListener("click", openPartyPicker);
  $("#filterBtn").addEventListener("click", openFilters);
  $("#calPrev").addEventListener("click", () => moveMonth(-1));
  $("#calNext").addEventListener("click", () => moveMonth(1));
  renderControls();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  await loadVenues();
  await loadReservations();
  paintProfile();
}
function switchView(name) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + name));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "calendar") renderCalendar();
  if (name === "community") loadCommunity();
  if (name === "profile") paintProfile();
  $("#app").scrollTop = 0; window.scrollTo(0, 0);
}

/* ---------- venues / discover ---------- */
async function loadVenues() {
  try { state.venues = await api("api/venues"); } catch (_) { state.venues = []; }
  renderVenues();
}
function renderControls() {
  $("#dateVal").textContent = dateLabel(state.book.date);
  $("#partyVal").textContent = `${state.book.party} ${state.book.party === 1 ? "guest" : "guests"}`;
  const f = state.filters;
  const n = f.cuisines.size + f.price.size + (f.minRating ? 1 : 0) + (f.sort !== "rating" ? 1 : 0);
  const btn = $("#filterBtn");
  btn.innerHTML = `Filters${n ? ` <span class="badge">${n}</span>` : ""}` +
    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`;
}
function filteredVenues() {
  const f = state.filters;
  let vs = state.venues.filter((v) =>
    (!f.cuisines.size || f.cuisines.has(v.cuisine)) &&
    (!f.price.size || f.price.has(v.price_level)) &&
    v.rating >= f.minRating);
  const km = (v) => parseFloat(v.distance) || 99;
  if (f.sort === "rating") vs.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  else if (f.sort === "price") vs.sort((a, b) => a.price_level.length - b.price_level.length);
  else if (f.sort === "distance") vs.sort((a, b) => km(a) - km(b));
  return vs;
}
function renderVenues() {
  const list = $("#list"); list.innerHTML = "";
  const venues = filteredVenues();
  $("#count").textContent = `${venues.length} place${venues.length === 1 ? "" : "s"} with tables`;
  if (!venues.length) { list.appendChild(el("div", "empty", "No places match your filters.")); return; }
  venues.forEach((v, i) => {
    const card = el("div", "hotel"); card.style.animationDelay = `${i * 45}ms`;
    const slots = v.slots.slice(0, 3).map((s) => `<button class="slot-chip" data-slot="${s}">${s}</button>`).join("")
      + `<button class="slot-chip more" data-open="1">More…</button>`;
    card.innerHTML = `
      <div class="photo" style="background-image:${PHOTO[v.photo] || PHOTO.ember}">
        <button class="fav ${state.saved.has(v.id) ? "on" : ""}" aria-label="Save">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="${state.saved.has(v.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-8.5C.5 9 2 5.5 5.3 5.5c2 0 3.2 1.2 3.7 2.2.5-1 1.7-2.2 3.7-2.2 3.3 0 4.8 3.5 2.8 7C19 16.5 12 21 12 21z"/></svg>
        </button>
      </div>
      <div class="body">
        <div class="row1"><h3 class="name">${v.name}</h3><div class="price-level">${v.price_level}</div></div>
        <div class="loc"><span class="pin"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 0 0-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg></span>${v.cuisine} <span class="dot">·</span> ${v.neighborhood}</div>
        <div class="rating">${stars(v.rating)}<span class="reviews">${v.reviews} Reviews</span></div>
        <div class="slots-row">${slots}</div>
      </div>`;
    card.querySelector(".fav").addEventListener("click", (e) => { e.stopPropagation(); toggleSaved(v.id); });
    card.addEventListener("click", () => openVenue(v));
    card.querySelectorAll(".slot-chip").forEach((chip) => chip.addEventListener("click", (e) => {
      e.stopPropagation(); if (chip.dataset.open) return openVenue(v); quickBook(v, chip.dataset.slot);
    }));
    list.appendChild(card);
  });
}
function stars(n) { let s = '<span class="stars">';
  for (let i = 1; i <= 5; i++) s += `<svg class="${i <= n ? "" : "off"}" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2l2.9 6.3 6.8.7-5.1 4.6 1.5 6.7L12 17.8 5.9 20.9l1.5-6.7L2.3 9.6l6.8-.7z"/></svg>`;
  return s + "</span>"; }
function toggleSaved(id) { state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
  localStorage.setItem("saved", JSON.stringify([...state.saved])); renderVenues(); }

/* ---------- venue detail + recs ---------- */
async function openVenue(v) {
  const slots = v.slots.map((s) => `<button class="slot-chip" data-slot="${s}">${s}</button>`).join("");
  $("#sheetCard").innerHTML = `
    <div class="sheet-photo" style="background-image:${PHOTO[v.photo] || PHOTO.ember}">
      <button class="close" id="closeSheet"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="sheet-body">
      <div class="row1" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><h2>${v.name}</h2><div class="price-level" style="font-size:16px">${v.price_level}</div></div>
      <div class="loc" style="display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-top:4px">${v.cuisine} · ${v.neighborhood} · ${v.distance}</div>
      <div class="rating" style="margin-top:8px;display:flex;gap:8px;align-items:center">${stars(v.rating)}<span class="reviews">${v.reviews} Reviews</span></div>
      <div class="amenities">${(v.amenities || []).map((a) => `<span class="chip">${a}</span>`).join("")}</div>
      <p class="desc">${v.description || ""}</p>
      <div style="font-size:13px;color:var(--muted);font-weight:600;margin:16px 2px 8px">Available ${dateLabel(state.book.date)} · party of ${state.book.party}</div>
      <div class="slots-row" id="detailSlots">${slots}</div>
      <div style="font-size:13px;color:var(--muted);font-weight:700;margin:20px 2px 10px">Recommendations</div>
      <div class="recs-in-detail" id="venueRecs"><div class="muted" style="margin:0 2px">Loading…</div></div>
      <div class="add-rec"><input id="recInput" placeholder="Recommend this place…" maxlength="180"><button id="recSend">Post</button></div>
      <button class="cta ghost" id="callVenue" style="margin-top:16px">📞 Have the AI call instead</button>
      <button class="cta ghost" id="closeBtn" style="margin-top:10px">Close</button>
    </div>`;
  $("#sheet").hidden = false;
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#closeBtn").addEventListener("click", closeSheet);
  $$("#detailSlots .slot-chip").forEach((chip) => chip.addEventListener("click", () => quickBook(v, chip.dataset.slot)));
  $("#callVenue").addEventListener("click", () => callNow(
    { venue: v.name, party_size: state.book.party, time: to24(v.slots[0]), date: state.book.date,
      notes: `Party of ${state.book.party}`, start_url: v.booking_url || "" }, v.name, v.photo));
  $("#recSend").addEventListener("click", () => postRec(v));
  loadVenueRecs(v.id);
}
async function loadVenueRecs(vid) {
  let recs = [];
  try { recs = await api(`api/venues/${vid}/recommendations`); } catch (_) {}
  const wrap = $("#venueRecs"); if (!wrap) return;
  wrap.innerHTML = recs.length ? "" : `<div class="muted" style="margin:0 2px">Be the first to recommend it.</div>`;
  recs.forEach((r) => wrap.appendChild(recCard(r, false)));
}
async function postRec(v) {
  const inp = $("#recInput"); const text = inp.value.trim(); if (!text) return;
  inp.value = "";
  try { await api(`api/venues/${v.id}/recommendations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, rating: 5 }) });
    loadVenueRecs(v.id); toast("Thanks for the recommendation!"); } catch (_) { toast("Couldn't post that."); }
}
function closeSheet() { $("#sheet").hidden = true; }
function quickBook(v, slot) {
  const p = state.book.party, d = state.book.date;
  bookNow({ venue: v.name, party_size: p, time: to24(slot), date: d, notes: `Party of ${p}`,
    start_url: v.booking_url || "", source_prompt: `Book ${v.name} for ${p} at ${slot}` }, v.name, v.photo, slot);
}

/* ---------- date / party / filter pickers ---------- */
function openDatePicker() {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const wknd = new Date(t); wknd.setDate(t.getDate() + ((6 - t.getDay() + 7) % 7 || 6));
  const presets = [["Today", ymd(t)], ["Tomorrow", ymd(new Date(t.getTime() + 864e5))], ["This weekend", ymd(wknd)]];
  openSheetBody(`
    <div class="picker-title">When are you dining?</div>
    <div class="chip-row" id="dateChips">${presets.map(([l, v]) => `<button class="opt ${state.book.date === v ? "on" : ""}" data-d="${v}">${l}</button>`).join("")}</div>
    <div class="pick-label">Or pick a date</div>
    <input class="date-input" id="dateInput" type="date" value="${state.book.date}" min="${ymd(t)}">
    <button class="apply" id="dateApply">Done</button>`);
  $$("#dateChips .opt").forEach((o) => o.addEventListener("click", () => { $("#dateInput").value = o.dataset.d;
    $$("#dateChips .opt").forEach((x) => x.classList.toggle("on", x === o)); }));
  $("#dateApply").addEventListener("click", () => { state.book.date = $("#dateInput").value || state.book.date; closeSheet(); renderControls(); });
}
function openPartyPicker() {
  openSheetBody(`
    <div class="picker-title">How many guests?</div>
    <div class="stepper"><button id="pMinus" aria-label="Fewer">−</button><div class="n" id="pN">${state.book.party}</div><button id="pPlus" aria-label="More">+</button></div>
    <div class="pick-label" style="margin-top:20px">Popular</div>
    <div class="chip-row" id="pChips">${[2, 4, 6, 8].map((n) => `<button class="opt" data-n="${n}">${n} guests</button>`).join("")}</div>
    <button class="apply" id="pApply">Done</button>`);
  let n = state.book.party;
  const set = (x) => { n = Math.max(1, Math.min(20, x)); $("#pN").textContent = n; };
  $("#pMinus").addEventListener("click", () => set(n - 1));
  $("#pPlus").addEventListener("click", () => set(n + 1));
  $$("#pChips .opt").forEach((o) => o.addEventListener("click", () => set(+o.dataset.n)));
  $("#pApply").addEventListener("click", () => { state.book.party = n; closeSheet(); renderControls(); });
}
function openFilters() {
  const f = state.filters;
  const cuisines = [...new Set(state.venues.map((v) => v.cuisine))];
  const prices = ["$$", "$$$"];
  const sorts = [["rating", "Top rated"], ["price", "Price"], ["distance", "Distance"]];
  openSheetBody(`
    <div class="picker-title">Filters</div>
    <div class="pick-label">Cuisine</div>
    <div class="chip-row" id="fCuis">${cuisines.map((c) => `<button class="opt ${f.cuisines.has(c) ? "on" : ""}" data-c="${c}">${c}</button>`).join("")}</div>
    <div class="pick-label">Price</div>
    <div class="chip-row" id="fPrice">${prices.map((p) => `<button class="opt ${f.price.has(p) ? "on" : ""}" data-p="${p}">${p}</button>`).join("")}</div>
    <div class="pick-label">Minimum rating</div>
    <div class="chip-row" id="fRating">${[0, 3, 4, 5].map((r) => `<button class="opt ${f.minRating === r ? "on" : ""}" data-r="${r}">${r === 0 ? "Any" : r + "★+"}</button>`).join("")}</div>
    <div class="pick-label">Sort by</div>
    <div class="chip-row" id="fSort">${sorts.map(([v, l]) => `<button class="opt ${f.sort === v ? "on" : ""}" data-s="${v}">${l}</button>`).join("")}</div>
    <button class="apply" id="fApply">Show results</button>
    <button class="apply ghost" id="fClear">Clear all</button>`);
  const toggle = (set, val, e) => { set.has(val) ? set.delete(val) : set.add(val); e.currentTarget.classList.toggle("on"); };
  $$("#fCuis .opt").forEach((o) => o.addEventListener("click", (e) => toggle(f.cuisines, o.dataset.c, e)));
  $$("#fPrice .opt").forEach((o) => o.addEventListener("click", (e) => toggle(f.price, o.dataset.p, e)));
  $$("#fRating .opt").forEach((o) => o.addEventListener("click", () => { f.minRating = +o.dataset.r; $$("#fRating .opt").forEach((x) => x.classList.toggle("on", x === o)); }));
  $$("#fSort .opt").forEach((o) => o.addEventListener("click", () => { f.sort = o.dataset.s; $$("#fSort .opt").forEach((x) => x.classList.toggle("on", x === o)); }));
  $("#fApply").addEventListener("click", () => { closeSheet(); renderControls(); renderVenues(); });
  $("#fClear").addEventListener("click", () => { f.cuisines.clear(); f.price.clear(); f.minRating = 0; f.sort = "rating"; closeSheet(); renderControls(); renderVenues(); });
}

/* ---------- AI ask ---------- */
async function askConcierge(text) {
  text = (text || "").trim(); if (!text) return;
  openSheetBody(`<div class="book-head"><h3>Reading your request</h3><span class="spin" style="border-top-color:var(--teal)"></span></div>`);
  let it;
  try { it = await api("api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }) }); }
  catch (_) { closeSheet(); toast("Couldn't reach the concierge."); return; }
  const a = (it.assumptions || []).length ? `<div class="ask-hint" style="color:var(--teal-2);text-align:left">💡 ${it.assumptions.join(" ")}</div>` : "";
  openSheetBody(`
    <div class="book-head"><h3>Confirm your table</h3><button class="close" id="closeSheet" style="position:static;box-shadow:none;background:var(--card)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="amenities" style="margin:6px 0 12px">
      <span class="chip"><b style="color:var(--muted);font-weight:600">Venue:</b> ${it.venue || "a nearby spot"}</span>
      <span class="chip"><b style="color:var(--muted);font-weight:600">Party:</b> ${it.party_size}</span>
      <span class="chip"><b style="color:var(--muted);font-weight:600">Date:</b> ${dateLabel(it.date)}</span>
      <span class="chip"><b style="color:var(--muted);font-weight:600">Time:</b> ${to12(it.time)}</span>
    </div>${a}
    <button class="cta" id="confirmBook">✨ Book with AI</button>
    <button class="cta ghost" id="callInstead">📞 Have the AI call the venue</button>
    <button class="cta ghost" id="closeBtn" style="margin-top:10px">Cancel</button>`);
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#closeBtn").addEventListener("click", closeSheet);
  const known = state.venues.find((v) => it.venue && v.name.toLowerCase().includes(it.venue.toLowerCase()));
  const payload = {
    venue: it.venue || "the venue", party_size: it.party_size, time: it.time, date: it.date,
    notes: it.notes || `Party of ${it.party_size}`, start_url: "", source_prompt: it.source_prompt || text,
  };
  const photo = (known && known.photo) || "slate";
  $("#confirmBook").addEventListener("click", () => bookNow(payload, it.venue || "your table", photo, to12(it.time)));
  $("#callInstead").addEventListener("click", () => callNow(payload, it.venue || "the venue", photo));
}

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

/* ---------- animated booking ---------- */
function openSheetBody(inner) { $("#sheetCard").innerHTML = `<div class="sheet-body" style="padding-top:22px">${inner}</div>`; $("#sheet").hidden = false; }

async function bookNow(payload, venueName, photo, whenLabel) {
  openSheetBody(`
    <div class="book-anim" id="bkAnim">
      <div class="ring-wrap">
        <svg width="132" height="132" viewBox="0 0 132 132">
          <defs><linearGradient id="bookgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fcabb"/><stop offset="1" stop-color="#6c5ce7"/></linearGradient></defs>
          <circle class="ring-bg" cx="66" cy="66" r="58"/><circle class="ring-fg" id="ringFg" cx="66" cy="66" r="58"/>
        </svg>
        <div class="ring-emoji" id="ringEmoji">🧭</div>
        <div class="ring-check"><svg width="72" height="72" viewBox="0 0 72 72"><path d="M21 38 l10 10 l20 -24"/></svg></div>
        <div class="confetti" id="confetti"></div>
      </div>
      <div class="phase" id="phase">Reaching ${venueName}…</div>
      <div class="phase-sub" id="phaseSub">Connecting to the reservation system</div>
      <div class="book-summary" id="bkSummary"></div>
      <button class="details-toggle" id="detailsToggle">View agent details</button>
      <div class="details-log" id="detailsLog" hidden><ol class="timeline" id="bk-log"></ol></div>
    </div>
    <button class="cta ghost" id="bk-done" hidden>View in calendar</button>`);
  $("#detailsToggle").addEventListener("click", () => {
    const d = $("#detailsLog"); d.hidden = !d.hidden; $("#detailsToggle").textContent = d.hidden ? "View agent details" : "Hide agent details";
  });
  setProgress(0.08);

  let res, run;
  try { res = await api("api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
  catch (_) { setPhaseFail("Couldn't start the booking."); return; }
  try { run = await api(`api/reservations/${res.id}/book`, { method: "POST" }); }
  catch (_) { setPhaseFail("Couldn't reach the agent."); return; }

  $("#bk-done").addEventListener("click", () => { closeSheet(); switchView("calendar"); });
  const summary = { venue: venueName, party: payload.party_size, when: whenLabel, date: payload.date };
  streamRun(run.run_id, summary);
}

const RING_C = 364;
function setProgress(f) { const r = $("#ringFg"); if (r) r.style.strokeDashoffset = String(RING_C * (1 - Math.min(f, 1))); }
function setPhase(emoji, title, sub) {
  const e = $("#ringEmoji"), p = $("#phase"), s = $("#phaseSub");
  if (e) e.textContent = emoji; if (p) p.textContent = title; if (s) s.textContent = sub || "";
}
function setPhaseFail(msg) { setPhase("⚠️", "Couldn’t complete", msg); const b = $("#bk-done"); if (b) { b.hidden = false; b.textContent = "Close"; b.onclick = closeSheet; } }
let _seenRead = 0, _phaseIdx = 0;
function advancePhase(ev, venueName, whenLabel) {
  // Map raw agent events to a few friendly phases with a filling ring.
  if (ev.type === "action" && ev.tool === "navigate") { _phaseIdx = 1; setPhase("🧭", `Reaching ${venueName}`, "Opening the reservation page"); setProgress(0.2); }
  else if (ev.type === "action" && ev.tool === "read_page") { _seenRead++;
    if (_seenRead >= 2 && _phaseIdx < 3) { _phaseIdx = 3; setPhase("📅", "Checking availability", "Finding open tables near your time"); setProgress(0.62); } }
  else if (ev.type === "action" && (ev.tool === "select_option" || ev.tool === "fill")) {
    if (_phaseIdx < 2) { _phaseIdx = 2; setPhase("⌨️", `Requesting your table`, whenLabel ? `Party of 2 · ${whenLabel}` : "Filling in the details"); setProgress(0.42); } }
  else if (ev.type === "action" && ev.tool === "click" && /confirm|reserve|book/i.test(ev.result || "")) {
    _phaseIdx = 4; setPhase("🔒", "Locking it in", "Confirming your reservation"); setProgress(0.88); }
}
function streamRun(runId, summary) {
  _seenRead = 0; _phaseIdx = 0;
  const src = new EventSource(urlOf(`api/runs/${runId}/stream`));
  src.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "action" || ev.type === "assistant" || ev.type === "status") rawLog(ev);
    advancePhase(ev, summary.venue, summary.when);
    if (ev.type === "result") finishBooking(ev, summary);
    else if (ev.type === "error") { rawLog(ev); setPhaseFail(ev.message || "The agent hit a problem."); }
    else if (ev.type === "end") { src.close(); loadReservations(); }
  };
  src.onerror = () => { src.close(); };
}
function rawLog(ev) {
  const log = $("#bk-log"); if (!log) return;
  const map = { navigate: "🧭", read_page: "👀", click: "👆", fill: "⌨️", select_option: "⌨️", screenshot: "📸", submit_payment: "💳" };
  const ic = ev.type === "assistant" ? "💭" : ev.type === "status" ? "⚙️" : (map[ev.tool] || "🔧");
  const tl = ev.type === "assistant" ? "Agent" : ev.type === "status" ? "Session" : `${ev.tool} · step ${ev.step}`;
  const dt = ev.text || ev.message || [ev.input && Object.keys(ev.input).length ? JSON.stringify(ev.input) : "", ev.result].filter(Boolean).join("\n");
  const li = el("li", "event" + (ev.type === "assistant" ? " assistant" : "")); li.appendChild(el("div", "ic", ic));
  const b = el("div"); b.appendChild(el("div", "tl", tl)); if (dt) { const d = el("div", "dt"); d.textContent = dt; b.appendChild(d); }
  li.appendChild(b); log.appendChild(li);
}
function finishBooking(ev, summary) {
  const ok = ev.outcome === "success" || ev.outcome === "confirmed";
  if (!ok) { setPhaseFail(ev.note || "The table wasn’t available."); loadReservations(); return; }
  setProgress(1);
  const anim = $("#bkAnim"); if (anim) anim.classList.add("done");
  setPhase("✅", "Table booked", "");
  $("#phase").textContent = "You’re booked!";
  $("#phaseSub").textContent = ev.note || "";
  const sum = $("#bkSummary");
  if (sum) sum.innerHTML = `<div class="bs-name">${summary.venue}</div><div class="bs-meta">Party of ${summary.party} · ${summary.when || ""} · ${dateLabel(summary.date)}</div>`;
  const done = $("#bk-done"); if (done) done.hidden = false;
  confetti();
  toast("Added to your calendar ✨");
  loadReservations();
}
function confetti() {
  const box = $("#confetti"); if (!box || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const colors = ["#3fcabb", "#ff7a66", "#6c5ce7", "#f6b73c"];
  for (let i = 0; i < 28; i++) {
    const bit = el("i"); bit.style.left = Math.random() * 100 + "%";
    bit.style.background = colors[i % colors.length];
    box.appendChild(bit);
    bit.animate([{ transform: `translateY(-10px) rotate(0deg)`, opacity: 1 },
      { transform: `translateY(160px) rotate(${(Math.random() * 720 - 360) | 0}deg)`, opacity: 0 }],
      { duration: 900 + Math.random() * 700, delay: Math.random() * 250, easing: "cubic-bezier(.2,.6,.3,1)" })
      .onfinish = () => bit.remove();
  }
}

/* ---------- phone-agent (AI calls the venue) ---------- */
async function callNow(payload, venueName, photo) {
  payload = { ...payload, method: "phone" };
  openSheetBody(`
    <div class="book-anim" id="bkAnim">
      <div class="ring-wrap">
        <svg width="132" height="132" viewBox="0 0 132 132">
          <defs><linearGradient id="bookgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fcabb"/><stop offset="1" stop-color="#6c5ce7"/></linearGradient></defs>
          <circle class="ring-bg" cx="66" cy="66" r="58"/><circle class="ring-fg" id="ringFg" cx="66" cy="66" r="58"/>
        </svg>
        <div class="ring-emoji" id="ringEmoji">📞</div>
        <div class="ring-check"><svg width="72" height="72" viewBox="0 0 72 72"><path d="M21 38 l10 10 l20 -24"/></svg></div>
        <div class="confetti" id="confetti"></div>
      </div>
      <div class="phase" id="phase">Calling ${venueName}…</div>
      <div class="phase-sub" id="phaseSub">Connecting…</div>
      <div class="transcript" id="transcript"></div>
      <div class="book-summary" id="bkSummary"></div>
    </div>
    <button class="cta ghost" id="bk-done" hidden>View in calendar</button>`);
  setProgress(0.08);
  let res, run;
  try { res = await api("api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
  catch (_) { setPhaseFail("Couldn't start the call."); return; }
  try { run = await api(`api/reservations/${res.id}/call`, { method: "POST" }); }
  catch (_) { setPhaseFail("Couldn't place the call."); return; }
  $("#bk-done").addEventListener("click", () => { closeSheet(); switchView("calendar"); });
  streamCall(run.run_id, { venue: venueName, party: payload.party_size, when: to12(payload.time), date: payload.date });
}
function streamCall(runId, summary) {
  const src = new EventSource(urlOf(`api/runs/${runId}/stream`));
  src.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "phase") { setPhase(ev.emoji, ev.title, ev.sub); setProgress(ev.progress); }
    else if (ev.type === "transcript") addBubble(ev.speaker, ev.text);
    else if (ev.type === "result") finishBooking(ev, summary);
    else if (ev.type === "error") setPhaseFail(ev.message || "The call didn’t go through.");
    else if (ev.type === "end") { src.close(); loadReservations(); }
  };
  src.onerror = () => { src.close(); };
}
function addBubble(speaker, text) {
  const t = $("#transcript"); if (!t) return;
  const b = el("div", "bubble " + (speaker === "ai" ? "ai" : "host")); b.textContent = text;
  t.appendChild(b); b.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ---------- reservations + apple calendar ---------- */
async function loadReservations() {
  try { state.reservations = await api("api/reservations"); } catch (_) { state.reservations = []; }
  if (!$("#view-calendar").hidden) renderCalendar();
  paintProfile();
}
function moveMonth(d) { const m = new Date(state.calMonth); m.setMonth(m.getMonth() + d); state.calMonth = m; renderCalendar(); }
function renderCalendar() {
  const base = state.calMonth, y = base.getFullYear(), mo = base.getMonth();
  $("#calMonth").innerHTML = `${base.toLocaleDateString(undefined, { month: "long" })} <span>${y}</span>`;
  const first = new Date(y, mo, 1); const start = new Date(first); start.setDate(1 - first.getDay());
  const byDay = {}; state.reservations.filter((r) => r.status !== "cancelled").forEach((r) => { (byDay[r.date] = byDay[r.date] || []).push(r); });
  const days = $("#calDays"); days.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const key = ymd(d);
    const cell = el("div", "cal-cell" + (d.getMonth() !== mo ? " out" : "") + (key === ymd(new Date()) ? " today" : "") + (key === state.calSel ? " sel" : ""));
    const evs = byDay[key] || [];
    const dots = evs.slice(0, 3).map((_, j) => `<i class="${EVT_COLORS[j] ? "c" + (j + 1) : ""}"></i>`).join("");
    cell.innerHTML = `<div class="n">${d.getDate()}</div><div class="cal-dots">${dots}</div>`;
    cell.addEventListener("click", () => { state.calSel = key; renderCalendar(); });
    days.appendChild(cell);
  }
  renderAgenda(byDay[state.calSel] || []);
}
function renderAgenda(list) {
  const selDate = new Date(state.calSel + "T00:00:00");
  $("#agendaTitle").textContent = sameDay(selDate, new Date()) ? "Today" : selDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const wrap = $("#agenda"); wrap.innerHTML = "";
  if (!list.length) { wrap.appendChild(el("div", "empty", "No reservations this day.")); return; }
  list.sort((a, b) => (a.time || "").localeCompare(b.time || "")).forEach((r, i) => {
    const evt = el("div", "evt" + (EVT_COLORS[i % 3] ? " " + EVT_COLORS[i % 3] : ""));
    const status = { confirmed: "Confirmed", pending: "Booking…", needs_human: "Needs you", failed: "Failed" }[r.status] || r.status;
    evt.innerHTML = `<div class="bar"></div>
      <div class="et">${to12(r.time).replace(" ", "")}<small>${r.party_size} ppl</small></div>
      <div><div class="en">${r.venue}</div><div class="em">${status}${r.notes ? " · " + r.notes : ""}</div></div>`;
    wrap.appendChild(evt);
  });
}

/* ---------- community ---------- */
async function loadCommunity() {
  let recs = [];
  try { recs = await api("api/community"); } catch (_) {}
  const wrap = $("#community"); wrap.innerHTML = "";
  if (!recs.length) { wrap.appendChild(el("div", "empty", "No recommendations yet.")); return; }
  recs.forEach((r) => wrap.appendChild(recCard(r, true)));
}
function recCard(r, showWhere) {
  const card = el("div", "rec");
  const color = AV_COLORS[hash(r.author) % AV_COLORS.length];
  const where = showWhere ? `${r.venue}${r.cuisine ? " · " + r.cuisine : ""}` : "";
  card.innerHTML = `
    <div class="rec-top">
      <div class="rec-av" style="background:${color}">${(r.author || "?")[0].toUpperCase()}</div>
      <div><div class="rec-who">${r.author}</div>${where ? `<div class="rec-where">${where}</div>` : ""}</div>
      <div class="rec-stars">${"★".repeat(r.rating || 5)}</div>
    </div>
    <div class="rec-text">${escapeHtml(r.text)}</div>
    <div class="rec-actions">
      <button class="rec-btn like"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-8.5C.5 9 2 5.5 5.3 5.5c2 0 3.2 1.2 3.7 2.2.5-1 1.7-2.2 3.7-2.2 3.3 0 4.8 3.5 2.8 7C19 16.5 12 21 12 21z"/></svg><span>${r.likes || 0}</span></button>
      <button class="rec-btn share"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>Share</button>
    </div>`;
  card.querySelector(".like").addEventListener("click", async (e) => {
    const btn = e.currentTarget; btn.classList.add("liked", "pop");
    const span = btn.querySelector("span"); span.textContent = (parseInt(span.textContent) || 0) + 1;
    try { await api(`api/recommendations/${r.id}/like`, { method: "POST" }); } catch (_) {}
    setTimeout(() => btn.classList.remove("pop"), 320);
  });
  card.querySelector(".share").addEventListener("click", () => {
    const txt = `${r.author} recommends ${r.venue || "this spot"}: “${r.text}”`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else { navigator.clipboard && navigator.clipboard.writeText(txt); toast("Copied to share ✨"); }
  });
  return card;
}

/* ---------- profile ---------- */
function paintProfile() {
  const u = state.user || {};
  $("#pavatar").textContent = (u.name || "G")[0].toUpperCase();
  $("#pname").textContent = u.name || "Guest";
  $("#pemail").textContent = u.email || "—";
  $("#pmode").textContent = state.mode || "—";
  $("#ptrips").textContent = String(state.reservations.filter((r) => r.status === "confirmed").length);
}

/* ---------- helpers ---------- */
function to24(s) { const m = (s || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i); if (!m) return "19:00";
  let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return `${String(h).padStart(2, "0")}:${m[2]}`; }
function to12(t) { if (!t) return "7:00 PM"; const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`; }
function todayISO() { return ymd(new Date()); }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function sameDay(a, b) { return ymd(a) === ymd(b); }
function dateLabel(d) { if (!d) return "Today"; const t = new Date(); t.setHours(0, 0, 0, 0); const dt = new Date(d + "T00:00:00");
  const diff = Math.round((dt - t) / 864e5); if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday";
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function hash(s) { let h = 0; for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3000); }

boot();
