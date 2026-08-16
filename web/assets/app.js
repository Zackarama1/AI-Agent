/* ==========================================================================
   TradeShield — Live Liability Dashboard
   A self-contained liability / expense tracker. State persists in the browser
   (localStorage) so the app is fully usable with no backend.
   ========================================================================== */
(function () {
  "use strict";

  var STORE_KEY = "tradeshield.liabilities.v1";
  var ACT_KEY   = "tradeshield.actions.v1";
  var TODAY = new Date("2026-08-16"); // fixed "today" so demo data stays coherent

  /* ---------- category colours ---------- */
  var CAT = {
    "VAT":              { c: "#3a6ea5", i: "V" },
    "PAYE & NIC":       { c: "#7a5cc0", i: "P" },
    "Corporation Tax":  { c: "#c0503f", i: "C" },
    "Staff wages":      { c: "#2e9e6b", i: "W" },
    "Suppliers":        { c: "#c98a2b", i: "S" },
    "Insurance":        { c: "#3a9cb5", i: "I" },
    "Trade finance":    { c: "#101f3d", i: "F" },
    "Professional fees":{ c: "#8a6d3b", i: "R" },
    "Other":            { c: "#6b7385", i: "O" }
  };

  /* ---------- seed data (mirrors the product mock) ---------- */
  var SEED = [
    { name: "Trade finance facility",   category: "Trade finance",    due: "2026-08-31", amount: 400000, paid: 0,      obligor: "MTC", status: "auto" },
    { name: "PAYE & National Insurance",category: "PAYE & NIC",       due: "2026-08-22", amount: 100200, paid: 40000,  obligor: "MTC", status: "auto" },
    { name: "VAT return Q2",            category: "VAT",              due: "2026-08-07", amount: 54540,  paid: 0,      obligor: "MTC", status: "due" },
    { name: "Staff wages — August",     category: "Staff wages",      due: "2026-08-28", amount: 170000, paid: 170000, obligor: "MTC", status: "auto" },
    { name: "Professional fees",        category: "Professional fees",due: "2026-07-31", amount: 20500,  paid: 0,      obligor: "MTC", status: "auto" },
    { name: "Supplier — components",    category: "Suppliers",        due: "2026-09-04", amount: 20000,  paid: 0,      obligor: "MTC", status: "auto" }
  ];

  var SEED_ACTIONS = [
    { type: "win",  title: "Time-to-pay agreed with HMRC", meta: "VAT · 14 Aug 2026", desc: "12-month instalment arrangement secured on the £54,540 VAT liability — no enforcement." },
    { type: "neg",  title: "Repayment proposal issued to trade financier", meta: "Trade finance · 12 Aug 2026", desc: "Draft schedule sent to spread the £400,000 facility; awaiting counter-signature by 24 Aug." },
    { type: "esc",  title: "Professional fees escalated", meta: "Professional fees · 9 Aug 2026", desc: "£20,500 flagged overdue; supporting invoice requested and dispute logged with the creditor." },
    { type: "neg",  title: "PAYE part-payment accepted", meta: "PAYE & NIC · 6 Aug 2026", desc: "£40,000 accepted on account; balance rescheduled to align with payroll cycle." },
    { type: "alert",title: "Creditor pressure detected", meta: "Suppliers · 4 Aug 2026", desc: "Early warning raised on components supplier — holding statement issued to prevent stop-supply." }
  ];

  /* ---------- state ---------- */
  var liabilities = load(STORE_KEY, SEED);
  var actions     = load(ACT_KEY, SEED_ACTIONS);
  var searchTerm  = "";

  function load(key, seed) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    save(key, seed);
    return JSON.parse(JSON.stringify(seed));
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function persist() { save(STORE_KEY, liabilities); }

  /* ---------- helpers ---------- */
  function gbp(n) {
    return "£" + Math.round(n).toLocaleString("en-GB");
  }
  function daysUntil(dateStr) {
    var d = new Date(dateStr);
    return Math.round((d - TODAY) / 86400000);
  }
  function fmtDue(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  function statusOf(l) {
    if (l.status && l.status !== "auto") return l.status;
    var du = daysUntil(l.due);
    var outstanding = l.amount - l.paid;
    if (outstanding <= 0) return "funded";
    if (du < 0) return "overdue";
    if (l.paid > 0) return "part";
    if (du <= 3) return "due";
    if (du <= 10) return "soon";
    return "due";
  }
  var STATUS_LABEL = { funded: "Funded", part: "Part paid", due: "Due", soon: "Due soon", overdue: "Overdue" };

  /* ---------- KPI computation ---------- */
  function computeKpis() {
    var total = 0, due7 = 0, overdue = 0, allocated = 0, paidReserved = 0;
    liabilities.forEach(function (l) {
      total += l.amount;
      paidReserved += Math.min(l.paid, l.amount);
      var du = daysUntil(l.due);
      var outstanding = Math.max(l.amount - l.paid, 0);
      if (du >= 0 && du <= 7) due7 += outstanding;
      if (du < 0 && outstanding > 0) overdue += outstanding;
    });
    allocated = paidReserved; // reserved funds count as allocated
    var gap = Math.max(total - paidReserved, 0);
    var pctAllocated = total > 0 ? Math.round((paidReserved / total) * 100) : 0;
    return {
      total: total, due7: due7, overdue: overdue, gap: gap,
      allocated: allocated, paidReserved: paidReserved, pctAllocated: pctAllocated
    };
  }

  /* ---------- render: KPIs ---------- */
  function renderKpis(k) {
    var el = document.getElementById("kpis");
    el.innerHTML = "";
    var cards = [
      { cls: "k-total", label: "Total recorded liabilities", val: gbp(k.total), sub: "Across " + activeCategories() + " active categories", ic: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { cls: "k-due",   label: "Due in the next 7 days",     val: gbp(k.due7),  sub: "Outstanding within a week", ic: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>' },
      { cls: "k-over",  label: "Overdue",                    val: gbp(k.overdue), sub: overdueCount() + " item(s) require action", ic: '<path d="M12 2l10 18H2z"/><path d="M12 9v5M12 17h.01"/>' },
      { cls: "k-gap",   label: "Projected funding gap",      val: gbp(k.gap),   sub: "After current allocations and receipts", ic: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>' }
    ];
    cards.forEach(function (c) {
      var d = document.createElement("div");
      d.className = "kpi " + c.cls;
      d.innerHTML =
        '<div class="kpi-top"><span class="kpi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + c.ic + '</svg></span>' + c.label + '</div>' +
        '<b>' + c.val + '</b><small>' + c.sub + '</small>';
      el.appendChild(d);
    });
  }
  function activeCategories() {
    var s = {};
    liabilities.forEach(function (l) { s[l.category] = 1; });
    return Object.keys(s).length;
  }
  function overdueCount() {
    return liabilities.filter(function (l) { return statusOf(l) === "overdue"; }).length;
  }

  /* ---------- render: register table ---------- */
  function renderRegister() {
    var body = document.getElementById("reg-body");
    body.innerHTML = "";
    var rows = liabilities.filter(function (l) {
      if (!searchTerm) return true;
      return (l.name + " " + l.category + " " + l.obligor).toLowerCase().indexOf(searchTerm) > -1;
    });
    // sort by due date
    rows.sort(function (a, b) { return new Date(a.due) - new Date(b.due); });

    if (rows.length === 0) {
      body.innerHTML = '<tr class="empty-row"><td colspan="7">No liabilities match your search.</td></tr>';
      return;
    }
    rows.forEach(function (l) {
      var st = statusOf(l);
      var cat = CAT[l.category] || CAT.Other;
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td><span class="liab-name"><span class="cat-badge" style="background:' + cat.c + '">' + cat.i + '</span>' + esc(l.name) + '</span></td>' +
        '<td>' + fmtDue(l.due) + '</td>' +
        '<td class="num">' + gbp(l.amount) + '</td>' +
        '<td class="num">' + gbp(l.paid) + '</td>' +
        '<td>' + esc(l.obligor || "—") + '</td>' +
        '<td><span class="pill ' + st + '">' + (STATUS_LABEL[st] || st) + '</span></td>' +
        '<td><button class="row-edit" data-id="' + l.id + '" aria-label="Edit"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button></td>';
      body.appendChild(tr);
    });
    body.querySelectorAll(".row-edit").forEach(function (b) {
      b.addEventListener("click", function () { openModal(b.getAttribute("data-id")); });
    });
  }

  /* ---------- render: funding donut ---------- */
  function renderFunding(k) {
    var C = 2 * Math.PI * 50;
    var val = document.getElementById("donut-val");
    val.setAttribute("stroke-dasharray", C);
    val.setAttribute("stroke-dashoffset", C * (1 - k.pctAllocated / 100));
    document.getElementById("donut-pct").textContent = k.pctAllocated + "%";

    var legend = document.getElementById("fund-legend");
    legend.innerHTML =
      row("#101f3d", "Funds allocated", gbp(k.allocated)) +
      row("#c79a3e", "Paid or reserved", gbp(k.paidReserved)) +
      row("#c0503f", "Projected shortfall", gbp(k.gap));
    function row(color, label, amt) {
      return '<li><span class="lg-key"><span class="swatch" style="background:' + color + '"></span>' + label + '</span><b>' + amt + '</b></li>';
    }
  }

  /* ---------- render: payment profile chart ---------- */
  function renderChart() {
    // aggregate outstanding by due date, next ~8 dated points
    var map = {};
    liabilities.forEach(function (l) {
      var out = Math.max(l.amount - l.paid, 0);
      if (out <= 0) return;
      map[l.due] = (map[l.due] || 0) + out;
    });
    var pts = Object.keys(map).sort().map(function (d) { return { date: d, val: map[d] }; });

    var wrap = document.getElementById("chart-wrap");
    if (pts.length === 0) { wrap.innerHTML = '<p class="panel-sub">No upcoming payments recorded.</p>'; return; }

    var W = 560, H = 210, pad = { l: 20, r: 20, t: 20, b: 34 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var max = Math.max.apply(null, pts.map(function (p) { return p.val; }));
    var stepX = pts.length > 1 ? iw / (pts.length - 1) : 0;
    function x(i) { return pad.l + i * stepX; }
    function y(v) { return pad.t + ih - (v / max) * ih; }

    var line = "", area = "M" + x(0) + " " + (pad.t + ih);
    pts.forEach(function (p, i) {
      line += (i === 0 ? "M" : "L") + x(i) + " " + y(p.val) + " ";
      area += " L" + x(i) + " " + y(p.val);
    });
    area += " L" + x(pts.length - 1) + " " + (pad.t + ih) + " Z";

    var dots = "", labels = "";
    pts.forEach(function (p, i) {
      dots += '<circle cx="' + x(i) + '" cy="' + y(p.val) + '" r="4" fill="#fff" stroke="#3a6ea5" stroke-width="2.5"/>';
      labels += '<text x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10" fill="#6b7385">' + fmtDue(p.date) + '</text>';
    });

    wrap.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Upcoming payment profile">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a6ea5" stop-opacity="0.22"/><stop offset="1" stop-color="#3a6ea5" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#g)"/>' +
      '<path d="' + line + '" fill="none" stroke="#3a6ea5" stroke-width="2.5" stroke-linejoin="round"/>' +
      dots + labels + '</svg>';
  }

  /* ---------- render: creditor actions timeline ---------- */
  function renderTimeline() {
    var tl = document.getElementById("timeline");
    var icons = {
      win:  '<path d="M20 6L9 17l-5-5"/>',
      neg:  '<path d="M8 12h8M12 8v8"/><circle cx="12" cy="12" r="9"/>',
      esc:  '<path d="M12 2l10 18H2z"/><path d="M12 9v5M12 17h.01"/>',
      alert:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'
    };
    var clsMap = { win: "tl-win", neg: "tl-neg", esc: "tl-esc", alert: "tl-alert" };
    tl.innerHTML = "";
    actions.forEach(function (a) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="tl-ic ' + (clsMap[a.type] || "tl-neg") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + (icons[a.type] || icons.neg) + '</svg></span>' +
        '<span class="tl-body"><span class="tl-title">' + esc(a.title) + '</span>' +
        '<span class="tl-meta">' + esc(a.meta) + '</span>' +
        '<span class="tl-desc">' + esc(a.desc) + '</span></span>';
      tl.appendChild(li);
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- full render ---------- */
  function renderAll() {
    ensureIds();
    var k = computeKpis();
    renderKpis(k);
    renderRegister();
    renderFunding(k);
    renderChart();
    renderTimeline();
    document.getElementById("updated-line").textContent =
      "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  function ensureIds() {
    liabilities.forEach(function (l) {
      if (!l.id) l.id = "L" + Math.random().toString(36).slice(2, 9);
    });
  }

  /* ---------- modal (add / edit) ---------- */
  var modal = document.getElementById("modal");
  function openModal(id) {
    var editing = !!id;
    document.getElementById("modal-title").textContent = editing ? "Edit liability" : "Add liability";
    document.getElementById("modal-delete").hidden = !editing;
    var l = editing ? liabilities.find(function (x) { return x.id === id; }) : null;
    document.getElementById("f-id").value      = editing ? id : "";
    document.getElementById("f-name").value    = l ? l.name : "";
    document.getElementById("f-category").value= l ? l.category : "VAT";
    document.getElementById("f-due").value     = l ? l.due : new Date(TODAY).toISOString().slice(0, 10);
    document.getElementById("f-amount").value  = l ? l.amount : "";
    document.getElementById("f-paid").value    = l ? l.paid : 0;
    document.getElementById("f-obligor").value = l ? l.obligor : "MTC";
    document.getElementById("f-status").value  = l ? (l.status || "auto") : "auto";
    modal.hidden = false;
    document.getElementById("f-name").focus();
  }
  function closeModal() { modal.hidden = true; }

  document.getElementById("add-btn").addEventListener("click", function () { openModal(null); });
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  document.getElementById("liab-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = document.getElementById("f-id").value;
    var rec = {
      name:     document.getElementById("f-name").value.trim() || "Untitled liability",
      category: document.getElementById("f-category").value,
      due:      document.getElementById("f-due").value,
      amount:   parseFloat(document.getElementById("f-amount").value) || 0,
      paid:     parseFloat(document.getElementById("f-paid").value) || 0,
      obligor:  document.getElementById("f-obligor").value.trim() || "—",
      status:   document.getElementById("f-status").value
    };
    if (id) {
      var l = liabilities.find(function (x) { return x.id === id; });
      Object.assign(l, rec);
    } else {
      rec.id = "L" + Math.random().toString(36).slice(2, 9);
      liabilities.push(rec);
    }
    persist();
    closeModal();
    renderAll();
  });

  document.getElementById("modal-delete").addEventListener("click", function () {
    var id = document.getElementById("f-id").value;
    if (!id) return;
    if (!confirm("Remove this liability from the register?")) return;
    liabilities = liabilities.filter(function (x) { return x.id !== id; });
    persist();
    closeModal();
    renderAll();
  });

  /* ---------- search ---------- */
  document.getElementById("search").addEventListener("input", function (e) {
    searchTerm = e.target.value.trim().toLowerCase();
    renderRegister();
  });

  /* ---------- export board report ---------- */
  document.getElementById("export-btn").addEventListener("click", function () {
    var k = computeKpis();
    var lines = [];
    lines.push("TRADESHIELD — BOARD REPORT");
    lines.push("Generated " + new Date().toLocaleString("en-GB"));
    lines.push("");
    lines.push("Total recorded liabilities: " + gbp(k.total));
    lines.push("Due in next 7 days:         " + gbp(k.due7));
    lines.push("Overdue:                    " + gbp(k.overdue));
    lines.push("Projected funding gap:      " + gbp(k.gap));
    lines.push("Currently allocated:        " + k.pctAllocated + "%");
    lines.push("");
    lines.push("LIABILITY REGISTER");
    lines.push("Name,Category,Due,Amount,Paid/Reserved,Obligor,Status");
    liabilities.slice().sort(function (a, b) { return new Date(a.due) - new Date(b.due); })
      .forEach(function (l) {
        lines.push([l.name, l.category, l.due, l.amount, l.paid, l.obligor, STATUS_LABEL[statusOf(l)] || statusOf(l)]
          .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(","));
      });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "tradeshield-board-report.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  /* ---------- sidebar scroll nav ---------- */
  document.querySelectorAll(".sb-nav a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var href = a.getAttribute("href");
      if (href && href.indexOf("#") === 0 && href.length > 1) {
        e.preventDefault();
        var t = document.querySelector(href);
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
        document.querySelectorAll(".sb-nav a").forEach(function (x) { x.classList.remove("active"); });
        a.classList.add("active");
      }
    });
  });

  /* ---------- go ---------- */
  renderAll();
})();
