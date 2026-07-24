"use strict";

const $ = (id) => document.getElementById(id);
const els = {
  template: $("template"),
  instruction: $("instruction"),
  startUrl: $("startUrl"),
  dryRun: $("dryRun"),
  dryHint: $("dryHint"),
  run: $("run"),
  modePill: $("modePill"),
  timeline: $("timeline"),
  empty: $("empty"),
  stepCount: $("stepCount"),
  banner: $("resultBanner"),
};

let hasKey = false;
let source = null; // active EventSource

const TOOL_ICON = {
  navigate: "🧭",
  read_page: "👀",
  click: "👆",
  fill: "⌨️",
  screenshot: "📸",
  submit_payment: "💳",
};

async function boot() {
  try {
    const h = await fetch("api/health").then((r) => r.json());
    hasKey = !!h.has_key;
  } catch (_) { hasKey = false; }
  els.dryRun.checked = !hasKey; // no key -> default to dry run
  refreshModePill();

  try {
    const tasks = await fetch("api/tasks").then((r) => r.json());
    els.template.innerHTML = "";
    tasks.forEach((t, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = t.name;
      o._task = t;
      els.template.appendChild(o);
    });
    els.template.addEventListener("change", applyTemplate);
    applyTemplate();
  } catch (_) {
    els.template.innerHTML = '<option>Could not load templates</option>';
  }

  els.dryRun.addEventListener("change", refreshModePill);
  els.run.addEventListener("click", startRun);
}

function applyTemplate() {
  const opt = els.template.selectedOptions[0];
  if (!opt || !opt._task) return;
  els.instruction.value = opt._task.instruction || "";
  els.startUrl.value = opt._task.start_url || "";
}

function refreshModePill() {
  const dry = els.dryRun.checked || !hasKey;
  els.modePill.textContent = dry ? "dry run" : "live · Claude";
  els.modePill.className = "pill " + (dry ? "dry" : "real");
  els.dryHint.textContent = hasKey
    ? "scripted demo, skips the model"
    : "no API key on server — scripted demo only";
}

function resetTimeline() {
  els.timeline.innerHTML = "";
  els.empty.hidden = true;
  els.banner.hidden = true;
  els.banner.className = "banner";
  els.stepCount.textContent = "";
}

function addEvent({ icon, tool, detail, cls }) {
  const li = document.createElement("li");
  li.className = "event" + (cls ? " " + cls : "");
  li.innerHTML =
    `<div class="ic">${icon}</div>` +
    `<div class="body"><div class="tool"></div><div class="detail"></div></div>`;
  li.querySelector(".tool").textContent = tool;
  li.querySelector(".detail").textContent = detail || "";
  els.timeline.appendChild(li);
  li.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function renderEvent(ev) {
  switch (ev.type) {
    case "status":
      addEvent({ icon: "⚙️", tool: "Session", detail: ev.message });
      break;
    case "assistant":
      addEvent({ icon: "💭", tool: "Agent", detail: ev.text, cls: "assistant" });
      break;
    case "action": {
      const icon = TOOL_ICON[ev.tool] || "🔧";
      const input = ev.input && Object.keys(ev.input).length
        ? JSON.stringify(ev.input) : "";
      const detail = [input, ev.result].filter(Boolean).join("\n");
      addEvent({ icon, tool: `${ev.tool}  ·  step ${ev.step}`, detail });
      els.stepCount.textContent = `${ev.step} steps`;
      break;
    }
    case "result":
      showResult(ev);
      break;
    case "error":
      addEvent({ icon: "⛔", tool: "Error", detail: ev.message, cls: "error" });
      showBanner("bad", "Run failed", ev.message);
      break;
  }
}

function showResult(ev) {
  const map = {
    success: ["ok", "✅ Success"],
    needs_human: ["warn", "🙋 Needs a human"],
    failed: ["bad", "❌ Failed"],
  };
  const [cls, title] = map[ev.outcome] || ["", ev.outcome];
  showBanner(cls, `${title} · ${ev.steps} steps`, ev.note);
}

function showBanner(cls, title, sub) {
  els.banner.className = "banner " + cls;
  els.banner.innerHTML = "";
  els.banner.append(document.createTextNode(title));
  if (sub) {
    const s = document.createElement("small");
    s.textContent = sub;
    els.banner.appendChild(s);
  }
  els.banner.hidden = false;
}

function setRunning(on) {
  els.run.disabled = on;
  els.run.innerHTML = on ? 'Running<span class="spinner"></span>' : "Run agent";
}

async function startRun() {
  if (source) source.close();
  resetTimeline();
  setRunning(true);

  const body = {
    instruction: els.instruction.value.trim(),
    start_url: els.startUrl.value.trim(),
    mode: els.dryRun.checked ? "dry_run" : "auto",
  };
  if (!body.instruction || !body.start_url) {
    setRunning(false);
    showBanner("bad", "Missing input", "Fill in both the instruction and a start URL.");
    return;
  }

  let run;
  try {
    run = await fetch("api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  } catch (e) {
    setRunning(false);
    showBanner("bad", "Could not reach server", String(e));
    return;
  }

  source = new EventSource(`api/runs/${run.id}/stream`);
  source.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "end") {
      source.close();
      source = null;
      setRunning(false);
      return;
    }
    renderEvent(ev);
  };
  source.onerror = () => {
    // EventSource auto-retries; if the run already ended we've closed it above.
    if (source) { setRunning(false); }
  };
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {}));
}

boot();
