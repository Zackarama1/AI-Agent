"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

const API_BASE = ((window.APP_CONFIG && window.APP_CONFIG.apiBase) || "").replace(/\/$/, "");
const api = (p, o) => fetch(API_BASE ? `${API_BASE}/${p}` : p, o).then((r) => (r.ok ? r.json() : Promise.reject(r)));
const urlOf = (p) => (API_BASE ? `${API_BASE}/${p}` : p);

const PHOTO = {
  pool:   "linear-gradient(135deg,#8fd3d9,#57a9c2 45%,#d3a86e)",
  palace: "linear-gradient(140deg,#a8e0e6,#49b0c1 58%,#dbcaa6)",
  hills:  "linear-gradient(160deg,#c1e4a6,#6cab77 52%,#8fb8d6)",
  river:  "linear-gradient(140deg,#9fc4e8,#5b7fac 58%,#26314f)",
  classic:"linear-gradient(150deg,#e6d9c4,#b6996f 58%,#7a6a58)",
  urban:  "linear-gradient(150deg,#c6cfd8,#828fa0 52%,#48525f)",
};
const TOOL_ICON = { navigate: "🧭", read_page: "👀", click: "👆", fill: "⌨️", select_option: "⌨️", screenshot: "📸", submit_payment: "💳" };

const state = { hotels: [], reservations: [], favs: new Set(JSON.parse(localStorage.getItem("favs") || "[]")), hasKey: false, mode: "" };

async function boot() {
  try { const h = await api("api/health"); state.hasKey = h.has_key; state.mode = h.has_key ? "Live AI agent" : "Dry run (demo)"; } catch (_) {}
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  $("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); renderHotels(); });
  $("#goFavs").addEventListener("click", () => switchView("trips"));
  const sub = $("#subscribe"); if (sub) sub.href = urlOf("api/reservations.ics");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  await loadHotels();
  await loadTrips();
  paintProfile();
}

function switchView(name) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + name));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "trips") loadTrips();
  if (name === "profile") paintProfile();
  window.scrollTo(0, 0);
}

/* ---------- hotels ---------- */
async function loadHotels() {
  try { state.hotels = await api("api/hotels"); } catch (_) { state.hotels = []; }
  renderHotels();
}
function renderHotels() {
  const q = $("#q").value.trim().toLowerCase();
  const shown = state.hotels.filter((h) =>
    !q || h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q));
  $("#count").textContent = `${shown.length} hotel${shown.length === 1 ? "" : "s"} found`;
  const list = $("#list"); list.innerHTML = "";
  if (!shown.length) { list.appendChild(el("div", "empty", "No hotels match that search.")); return; }
  shown.forEach((h, i) => {
    const card = el("div", "hotel");
    card.style.animationDelay = `${i * 45}ms`;
    card.innerHTML = `
      <div class="photo" style="background-image:${PHOTO[h.photo] || PHOTO.pool}">
        <button class="fav ${state.favs.has(h.id) ? "on" : ""}" aria-label="Save">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="${state.favs.has(h.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-8.5C.5 9 2 5.5 5.3 5.5c2 0 3.2 1.2 3.7 2.2.5-1 1.7-2.2 3.7-2.2 3.3 0 4.8 3.5 2.8 7C19 16.5 12 21 12 21z"/></svg>
        </button>
      </div>
      <div class="body">
        <div class="row1">
          <h3 class="name">${h.name}</h3>
          <div class="price">$${h.price}<small>/per night</small></div>
        </div>
        <div class="loc"><span class="pin"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 0 0-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg></span>${h.location} <span class="dot">·</span> ${h.distance} to city</div>
        <div class="rating">${stars(h.rating)}<span class="reviews">${h.reviews} Reviews</span></div>
      </div>`;
    card.querySelector(".fav").addEventListener("click", (e) => { e.stopPropagation(); toggleFav(h.id); });
    card.addEventListener("click", () => openHotel(h));
    list.appendChild(card);
  });
}
function stars(n) {
  let s = '<span class="stars">';
  for (let i = 1; i <= 5; i++) s += `<svg class="${i <= n ? "" : "off"}" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2l2.9 6.3 6.8.7-5.1 4.6 1.5 6.7L12 17.8 5.9 20.9l1.5-6.7L2.3 9.6l6.8-.7z"/></svg>`;
  return s + "</span>";
}
function toggleFav(id) {
  if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
  localStorage.setItem("favs", JSON.stringify([...state.favs]));
  renderHotels();
}

/* ---------- hotel detail + AI booking ---------- */
function openHotel(h) {
  const card = $("#sheetCard");
  card.innerHTML = `
    <div class="sheet-photo" style="background-image:${PHOTO[h.photo] || PHOTO.pool}">
      <button class="close" id="closeSheet" aria-label="Close">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="sheet-body">
      <div class="row1" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
        <h2>${h.name}</h2>
        <div class="sheet-price">$${h.price}<small>/night</small></div>
      </div>
      <div class="loc" style="display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-top:4px">
        ${h.location} · ${h.distance} to city</div>
      <div class="rating" style="margin-top:8px;display:flex;gap:8px;align-items:center">${stars(h.rating)}<span class="reviews">${h.reviews} Reviews</span></div>
      <div class="amenities">${(h.amenities || []).map((a) => `<span class="chip">${a}</span>`).join("")}</div>
      <p class="desc">${h.description || ""}</p>
      <div id="bookArea">
        <button class="cta" id="bookBtn">✨ Book with AI · 12–22 Dec</button>
        <button class="cta ghost" id="closeBtn">Close</button>
      </div>
    </div>`;
  $("#sheet").hidden = false;
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#closeBtn").addEventListener("click", closeSheet);
  $("#bookBtn").addEventListener("click", () => bookHotel(h));
}
function closeSheet() { $("#sheet").hidden = true; }

async function bookHotel(h) {
  const btn = $("#bookBtn");
  btn.disabled = true; btn.innerHTML = 'Starting<span class="spin"></span>';
  const body = {
    venue: h.name, party_size: 2, date: checkinISO(), time: "15:00",
    notes: "12 Dec – 22 Dec · 1 room, 2 adults", start_url: h.booking_url || "",
    source_prompt: `Book ${h.name} in ${h.location}, 12–22 Dec, 1 room 2 adults`,
  };
  let res, run;
  try { res = await api("api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch (_) { btn.disabled = false; btn.textContent = "✨ Book with AI · 12–22 Dec"; toast("Couldn't start booking."); return; }
  try { run = await api(`api/reservations/${res.id}/book`, { method: "POST" }); }
  catch (_) { btn.disabled = false; toast("Couldn't reach the agent."); return; }

  const area = $("#bookArea");
  area.innerHTML = `
    <div class="book-head"><h3>Booking ${h.name}</h3></div>
    <div class="banner" id="bk-banner" hidden></div>
    <ol class="timeline" id="bk-log"></ol>
    <button class="cta ghost" id="bk-done" hidden>Done</button>`;
  $("#bk-done").addEventListener("click", () => { closeSheet(); switchView("trips"); });
  streamRun(run.run_id, () => { $("#bk-done").hidden = false; loadTrips(); });
}

function streamRun(runId, onDone) {
  const src = new EventSource(urlOf(`api/runs/${runId}/stream`));
  src.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    const log = $("#bk-log"); if (!log) { src.close(); return; }
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
  const log = $("#bk-log"); if (!log) return;
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
  b.innerHTML = (ok ? "✅ Booked" : ev.outcome === "needs_human" ? "🙋 Needs you" : "❌ Couldn’t complete")
    + (ev.note ? `<small>${ev.note}</small>` : "");
  b.hidden = false;
  if (ok) toast("Added to your Trips ✨");
}

/* ---------- trips ---------- */
async function loadTrips() {
  try { state.reservations = await api("api/reservations"); } catch (_) { state.reservations = []; }
  const wrap = $("#trips"); wrap.innerHTML = "";
  const active = state.reservations.filter((r) => r.status !== "cancelled").reverse();
  if (!active.length) { wrap.appendChild(el("div", "empty", "No trips yet — book a hotel from Explore.")); return; }
  active.forEach((r) => {
    const h = state.hotels.find((x) => x.name === r.venue);
    const photo = PHOTO[(h && h.photo)] || PHOTO.classic;
    const label = { confirmed: "Confirmed", pending: "Booking…", needs_human: "Needs you", failed: "Failed" }[r.status] || r.status;
    const cls = r.status === "confirmed" ? "confirmed" : r.status === "pending" ? "pending" : "cancelled";
    const t = el("div", "trip");
    t.innerHTML = `<div class="thumb" style="background-image:${photo}"></div>
      <div><div class="t-name">${r.venue}</div><div class="t-meta">${r.notes || "12–22 Dec"}</div></div>
      <div class="status ${cls}">${label}</div>`;
    wrap.appendChild(t);
  });
  paintProfile();
}

function paintProfile() {
  $("#pemail").textContent = "guest@stayable.app";
  $("#pmode").textContent = state.mode || "—";
  $("#ptrips").textContent = String(state.reservations.filter((r) => r.status === "confirmed").length);
}

function checkinISO() {
  const y = new Date().getFullYear();
  return `${y}-12-12`;
}

let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3000); }

boot();
