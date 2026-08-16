/* ==========================================================================
   TradeShield — PTC Client App (vanilla SPA, PWA / Capacitor-ready)
   Aligned to the Client Guide: liability lifecycle, Action Centre, evidence &
   audit, role-based access and compliance boundaries.
   ========================================================================== */
(function () {
  "use strict";

  var STORE = "tradeshield.app.v2";
  var state = load();
  var ui = { companyId: state.companies[0].id, loggedIn: sget("ts.loggedIn") === "1" };

  function load(){ try { var r = localStorage.getItem(STORE); if (r) return JSON.parse(r); } catch(e){} var s = JSON.parse(JSON.stringify(window.TS_SEED)); save(s); return s; }
  function save(s){ try { localStorage.setItem(STORE, JSON.stringify(s || state)); } catch(e){} }
  function sget(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function sset(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

  var STAGES = state.stages, DOMAINS = state.domains, ATYPES = state.actionTypes;
  function company(id){ return state.companies.find(function(c){return c.id===id;}); }
  function gbp(n){ return "£" + Math.round(n).toLocaleString("en-GB"); }
  function gbpK(n){ if (n>=1e6) return "£"+(n/1e6).toFixed(n>=1e7?1:2)+"m"; if (n>=1000) return "£"+Math.round(n/1000)+"k"; return "£"+Math.round(n); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function initials(n){ return n.split(/\s+/).slice(0,2).map(function(w){return w[0];}).join("").toUpperCase(); }
  function fmtDate(d){ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); }
  function stageMeta(k){ return STAGES.find(function(s){return s.key===k;})||STAGES[0]; }
  function stageIndex(k){ return STAGES.findIndex(function(s){return s.key===k;}); }
  function domainMeta(k){ return DOMAINS.find(function(d){return d.key===k;})||{color:"#6b7ea6",name:k}; }
  var STATUS_PILL = { funded:["ok","Funded"], part:["warn","Part funded"], due:["info","Due"], soon:["warn","Due soon"], approved:["teal","Approved"], overdue:["danger","Overdue"], reconciled:["ok","Reconciled"] };
  var CAT_COLOR = { "VAT":"#3b82f6","PAYE & NIC":"#8a7bff","Corporation Tax":"#ff6b5e","Staff wages":"#35d29a","Suppliers":"#f0b64a","Insurance":"#29c2d8","Trade finance":"#5c6cff","Professional fees":"#c79a3e","Other":"#6b7ea6" };
  function todayISO(){ return "2026-08-16"; }
  function daysUntil(d){ return Math.round((new Date(d)-new Date(todayISO()))/86400000); }

  function portfolioTotals(){
    var t={ liabilities:0, next7:0, overdue:0, gap:0, actions:0, atRisk:0, reconciled:0, records:0 };
    state.companies.forEach(function(c){
      t.liabilities+=c.totalLiabilities; t.next7+=c.next7; t.overdue+=c.overdue; t.gap+=c.fundingGap;
      t.actions += c.actions.length; if (c.risk==="high") t.atRisk++;
      c.liabilities.forEach(function(l){ t.records++; if (l.stage==="reconciled") t.reconciled++; });
    });
    return t;
  }

  var svgDefs = '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="tsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#29c2d8"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs></svg>';
  function tsMark(cls){
    return '<svg class="'+(cls||"tsmark")+'" viewBox="0 0 100 110" aria-hidden="true">'
      + '<defs><linearGradient id="shg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#29c2d8"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs>'
      + '<path d="M50 5 8 22v33c0 29 19 43 42 49 23-6 42-20 42-49V22z" fill="none" stroke="url(#shg)" stroke-width="5"/>'
      + '<path d="M35 54l11 11 22-24" fill="none" stroke="url(#shg)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function icon(name){
    var p={ home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
      actions:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      chart:'<path d="M4 20V6M4 20h16"/><path d="M8 16l3-4 3 2 4-6"/>',
      plug:'<path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v6"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
      bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
      chevron:'<path d="M9 6l6 6-6 6"/>', chevL:'<path d="M15 18l-6-6 6-6"/>',
      search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
      sync:'<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
      shield:'<path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7z"/>',
      arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
      logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
      check:'<path d="M20 6L9 17l-5-5"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      file:'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/>',
      lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      alert:'<path d="M12 2l10 18H2z"/><path d="M12 9v5M12 17h.01"/>' };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(p[name]||"")+'</svg>';
  }

  var root = document.getElementById("app");
  function toast(msg){ var t=document.getElementById("toast"); if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t);} t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(function(){t.classList.remove("show");},2200); }

  /* ======================= ROUTER ======================= */
  function router(){
    if (!ui.loggedIn){ renderLogin(); return; }
    var h = location.hash.replace(/^#\/?/, "") || "portfolio";
    var parts = h.split("/"), view = parts[0];
    if (view==="company" && parts[1]){ ui.companyId=parts[1]; renderShell(renderCompany(parts[1]), "portfolio"); }
    else if (view==="actions"){ renderShell(renderActions(), "actions"); }
    else if (view==="insights"){ renderShell(renderInsights(), "insights"); }
    else if (view==="integrations"){ renderShell(renderIntegrations(), "integrations"); }
    else if (view==="account"){ renderShell(renderAccount(), "account"); }
    else { renderShell(renderPortfolio(), "portfolio"); }
    window.scrollTo(0,0);
  }
  function renderShell(inner, tab){ root.innerHTML = svgDefs + inner + tabbar(tab); bindTabs(); }
  function tabbar(active){
    var tabs=[["portfolio","home","Portfolio"],["actions","actions","Actions"],["insights","chart","Insights"],["integrations","plug","Connect"],["account","user","Account"]];
    return '<nav class="tabbar">'+tabs.map(function(t){ return '<button data-route="'+t[0]+'" class="'+(t[0]===active?"active":"")+'">'+icon(t[1])+'<span>'+t[2]+'</span></button>'; }).join("")+'</nav>';
  }
  function bindTabs(){ root.querySelectorAll(".tabbar button").forEach(function(b){ b.onclick=function(){ location.hash="#/"+b.getAttribute("data-route"); }; }); }
  function topbar(title, sub, opts){
    opts=opts||{};
    var left = opts.back ? '<button class="back-btn" id="tb-back">'+icon("chevL")+' Back</button>' : '<div>'+tsMark()+'</div>';
    var badge = totalOpenActions();
    var bell = '<button class="icon-btn" id="tb-bell" style="position:relative">'+icon("bell")+(badge?'<span style="position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--danger);color:#fff;font-size:.6rem;font-weight:700;display:grid;place-items:center">'+badge+'</span>':'')+'</button>';
    return '<header class="topbar"><div style="display:flex;align-items:center;gap:12px">'+left
      + '<div><div class="tb-title">'+esc(title)+'</div>'+(sub?'<div class="tb-sub">'+esc(sub)+'</div>':'')+'</div></div>'
      + '<div class="tb-right">'+bell+'<div class="avatar">'+esc(state.account.initials)+'</div></div></header>';
  }
  function totalOpenActions(){ return state.companies.reduce(function(a,c){return a+c.actions.length;},0); }
  function bindTop(){
    var b=document.getElementById("tb-back"); if(b) b.onclick=function(){ history.length>1?history.back():(location.hash="#/portfolio"); };
    var bell=document.getElementById("tb-bell"); if(bell) bell.onclick=function(){ location.hash="#/actions"; };
  }

  /* ======================= LOGIN ======================= */
  function renderLogin(){
    root.innerHTML = svgDefs + '<div class="login-screen">'
      + '<div class="login-hero">'+tsMark("lh-mark")
      + '<h1><span class="t">TRADE</span> <span class="s">SHIELD</span></h1>'
      + '<p>Live Liability Control. Every liability — visible and controlled.</p></div>'
      + '<div class="field"><label>Work email</label><input id="lg-email" type="email" value="kevin@meridianadvisory.co.uk"></div>'
      + '<div class="field"><label>Password</label><input id="lg-pass" type="password" value="demo"></div>'
      + '<button class="btn btn-primary btn-block" id="lg-btn">Sign in</button>'
      + '<div class="login-alt">Authorised users only · <a href="#" id="lg-alt">Request access</a></div>'
      + '<div class="demo-note">Demo build · any credentials sign you in. Live auth, roles &amp; billing connect to your backend.</div></div>';
    document.getElementById("lg-btn").onclick = doLogin;
    document.getElementById("lg-alt").onclick = function(e){ e.preventDefault(); doLogin(); };
    document.getElementById("lg-pass").onkeydown = function(e){ if(e.key==="Enter") doLogin(); };
  }
  function doLogin(){ ui.loggedIn=true; sset("ts.loggedIn","1"); location.hash="#/portfolio"; router(); toast("Welcome back, "+state.account.user.split(" ")[0]); }

  /* ======================= PORTFOLIO ======================= */
  function renderPortfolio(){
    var t = portfolioTotals();
    var s = topbar("Portfolio", state.account.firm+" · "+state.companies.length+" clients");
    var out = '<div class="screen active">';
    out += '<div class="section-label">Portfolio position</div>';
    out += '<div class="stat-grid">'
      + stat("Total recorded", gbpK(t.liabilities), "all clients", "accent", icon("shield"))
      + stat("Due next 7 days", gbpK(t.next7), "funding priority", "")
      + stat("Overdue", gbpK(t.overdue), t.overdue>0?"needs action":"all current", t.overdue>0?"danger":"")
      + stat("Funding gap", gbpK(t.gap), "projected", "gold")
      + '</div>';
    out += '<div class="section-label" style="display:flex;justify-content:space-between;align-items:center">Clients <a href="#/actions" id="pf-act" style="font-size:.72rem">'+t.actions+' open actions</a></div>';
    out += '<div class="search">'+icon("search")+'<input id="pf-search" placeholder="Search clients…"></div>';
    out += '<div class="row-list" id="pf-list">'+state.companies.map(companyRow).join("")+'</div>';
    out += '</div>';
    setTimeout(function(){
      bindTop();
      var pa=document.getElementById("pf-act"); if(pa) pa.onclick=function(e){e.preventDefault();location.hash="#/actions";};
      var inp=document.getElementById("pf-search");
      if(inp) inp.oninput=function(){ var q=inp.value.toLowerCase();
        document.getElementById("pf-list").innerHTML = state.companies.filter(function(c){return (c.name+" "+c.sector).toLowerCase().indexOf(q)>-1;}).map(companyRow).join("")||'<div class="empty">No clients match.</div>';
        bindCompanyRows(); };
      bindCompanyRows();
    },0);
    return s+out;
  }
  function companyRow(c){
    var acts = c.actions.length;
    return '<button class="list-row" data-company="'+c.id+'">'
      + '<span class="lr-logo" style="background:'+c.logoColor+'">'+initials(c.name)+'</span>'
      + '<span class="lr-main"><span class="lr-name">'+esc(c.name)+'</span>'
      + '<span class="lr-meta"><span class="risk-dot risk-'+c.risk+'"></span> '+esc(c.sector)+' · '+acts+' action'+(acts===1?"":"s")+'</span></span>'
      + '<span class="lr-right"><span class="lr-fig">'+gbpK(c.totalLiabilities)+'</span>'
      + '<div class="lr-meta">'+(c.overdue>0?'<span style="color:var(--danger)">'+gbpK(c.overdue)+' overdue</span>':'<span style="color:var(--ok)">on track</span>')+'</div></span>'
      + '<span class="chev">'+icon("chevron")+'</span></button>';
  }
  function bindCompanyRows(){ root.querySelectorAll("[data-company]").forEach(function(b){ b.onclick=function(){ location.hash="#/company/"+b.getAttribute("data-company"); }; }); }
  function stat(label,val,delta,cls,ic){ return '<div class="stat '+(cls||"")+'"><div class="s-label">'+(ic?'<span style="width:14px;height:14px;color:var(--teal)">'+ic+'</span>':'')+label+'</div><div class="s-val">'+val+'</div>'+(delta?'<div class="s-delta muted">'+delta+'</div>':'')+'</div>'; }

  /* ======================= COMPANY (Financial position) ======================= */
  function renderCompany(id){
    var c = company(id); if(!c) return '<div class="empty">Client not found.</div>';
    var s = topbar(c.name, c.sector, {back:true});
    var out = '<div class="screen active">';
    out += '<div class="stat-grid">'
      + stat("Total recorded", gbp(c.totalLiabilities), c.liabilities.length+" records", "accent")
      + stat("Due next 7 days", gbp(c.next7), "priority", "")
      + stat("Overdue", gbp(c.overdue), c.overdue>0?"action needed":"none", c.overdue>0?"danger":"")
      + stat("Funding gap", gbp(c.fundingGap), "projected", "gold")
      + '</div>';

    out += '<div class="grid-2" style="margin-top:14px">';
    out += '<div class="card"><div class="card-head"><div><h2>Funding position</h2><div class="sub">Allocation vs recorded liabilities</div></div></div>'
      + donut(c.allocatedPct)
      + fundLine("#29c2d8","Funds allocated",gbp(c.allocated))
      + fundLine("#d8b866","Paid or reserved",gbp(c.paidReserved))
      + fundLine("#ff6b5e","Projected shortfall",gbp(c.fundingGap))
      + '</div>';
    out += '<div class="card"><div class="card-head"><div><h2>Accounting feed</h2><div class="sub">Source of liability data</div></div></div>'+accountingBlock(c)+'</div>';
    out += '</div>';

    // actions need attention
    if (c.actions.length){
      out += '<div class="section-label" style="display:flex;justify-content:space-between;align-items:center">Actions need attention <a href="#/actions" id="co-act" style="font-size:.72rem">View all '+icon("arrow").replace('stroke-width="2"','stroke-width="2" style="width:11px;height:11px;display:inline;vertical-align:-1px"')+'</a></div>';
      out += '<div class="card" style="padding:8px 14px">'+c.actions.slice(0,3).map(function(a){return actionRow(a,c);}).join("")+'</div>';
    }

    // liability register
    out += '<div class="section-label">Liability register</div><div class="card" style="padding:6px 14px">';
    out += c.liabilities.slice().sort(function(a,b){return new Date(a.due)-new Date(b.due);}).map(function(l){ return liabRow(l, c.id); }).join("");
    out += '</div>';

    // reports
    out += '<div class="section-label">Client outputs</div><div class="card"><div class="grid-2">'
      + reportBtn("Board report") + reportBtn("Liability export") + reportBtn("Funding report") + reportBtn("Evidence pack")
      + '</div></div>';
    out += '</div>';

    setTimeout(function(){
      bindTop();
      var ca=document.getElementById("co-act"); if(ca) ca.onclick=function(e){e.preventDefault();location.hash="#/actions";};
      root.querySelectorAll("[data-liab]").forEach(function(b){ b.onclick=function(){ openLiabSheet(c.id, b.getAttribute("data-liab")); }; });
      root.querySelectorAll("[data-action]").forEach(function(b){ b.onclick=function(){ openActionSheet(c.id, b.getAttribute("data-action")); }; });
      root.querySelectorAll("[data-report]").forEach(function(b){ b.onclick=function(){ exportReport(c, b.getAttribute("data-report")); }; });
      var cb=root.querySelector("[data-connect]"); if(cb) cb.onclick=function(){ openConnectSheet(c.id); };
    },0);
    return s+out;
  }
  function fundLine(col,label,amt){ return '<div class="flex-between" style="font-size:.86rem;padding:5px 0"><span class="lr-meta" style="display:flex;align-items:center;gap:8px;color:var(--ink-soft)"><span class="risk-dot" style="background:'+col+'"></span>'+label+'</span><b>'+amt+'</b></div>'; }
  function reportBtn(name){ return '<button class="btn btn-ghost btn-sm" data-report="'+esc(name)+'" style="justify-content:flex-start;gap:9px">'+icon("doc").replace('stroke-width="2"','stroke-width="2" style="width:15px;height:15px"')+esc(name)+'</button>'; }

  function accountingBlock(c){
    var a=c.accounting;
    if(a.status==="connected"){
      var col=a.provider==="Xero"?"linear-gradient(135deg,#13b5ea,#0a7bb5)":"linear-gradient(135deg,#2ca01c,#1a6b12)";
      return '<div class="integration"><div class="int-logo" style="background:'+col+'">'+(a.provider==="Xero"?"xero":"qb")+'</div>'
        + '<div class="int-main"><div class="int-name">'+a.provider+'</div><div class="int-status"><span class="risk-dot risk-low"></span> Connected · synced '+esc(a.lastSync)+'</div></div>'
        + '<button class="icon-btn" data-sync>'+icon("sync")+'</button></div><div class="muted" style="font-size:.78rem;margin-top:10px">Entity: '+esc(a.entity)+'</div>';
    }
    return '<div class="integration"><div class="int-logo" style="background:var(--panel-2)">?</div><div class="int-main"><div class="int-name">Not connected</div><div class="int-status">Add Xero or QuickBooks to auto-sync</div></div></div>'
      + '<button class="btn btn-primary btn-block btn-sm" style="margin-top:12px" data-connect>Connect accounting</button>';
  }

  function liabRow(l, cid){
    var p = STATUS_PILL[l.status]||["neutral",l.status];
    var dm = domainMeta(l.domain);
    return '<button class="list-row" data-liab="'+l.id+'" style="border:none;background:none;padding:11px 0;border-bottom:1px solid var(--line);border-radius:0">'
      + '<span class="lr-logo" style="width:34px;height:34px;border-radius:9px;font-size:.7rem;background:'+(CAT_COLOR[l.category]||dm.color)+'">'+l.category[0]+'</span>'
      + '<span class="lr-main"><span class="lr-name" style="font-size:.9rem">'+esc(l.name)+'</span>'
      + '<span class="lr-meta">Due '+fmtDate(l.due)+' · '+esc(l.obligor)+' · '+stageMeta(l.stage).name+'</span></span>'
      + '<span class="lr-right"><span class="lr-fig" style="font-size:.9rem">'+gbp(l.amount)+'</span><div style="margin-top:4px"><span class="pill '+p[0]+'">'+p[1]+'</span></div></span></button>';
  }

  function donut(pct){
    var C=2*Math.PI*44;
    return '<div class="donut-wrap"><svg class="donut" viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="44"/><circle class="val" cx="50" cy="50" r="44" stroke-dasharray="'+C+'" stroke-dashoffset="'+(C*(1-pct/100))+'"/></svg><div class="donut-center"><b>'+pct+'%</b><span>Allocated</span></div></div>';
  }

  /* ======================= ACTION CENTRE ======================= */
  function renderActions(){
    var s = topbar("Action Centre", "What needs attention");
    var out = '<div class="screen active">';
    // gather all actions with company ref
    var all=[]; state.companies.forEach(function(c){ c.actions.forEach(function(a){ all.push({a:a, c:c}); }); });
    var prio = {high:0,medium:1,low:2};
    all.sort(function(x,y){ return (prio[x.a.priority]-prio[y.a.priority]) || (new Date(x.a.due)-new Date(y.a.due)); });

    // summary by type
    var counts={approval:0,document:0,decision:0,review:0}; all.forEach(function(x){counts[x.a.type]=(counts[x.a.type]||0)+1;});
    out += '<div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">'
      + Object.keys(ATYPES).map(function(k){ return '<div class="stat" style="border-color:'+ATYPES[k].color+'44"><div class="s-label" style="color:'+ATYPES[k].color+'">'+ATYPES[k].label+'</div><div class="s-val" style="font-size:1.3rem">'+(counts[k]||0)+'</div></div>'; }).join("")
      + '</div>';

    out += '<div class="section-label">Prioritised</div>';
    if(!all.length) out += '<div class="empty">No open actions. Everything is under control.</div>';
    else { out += '<div class="card" style="padding:6px 14px">' + all.map(function(x){ return actionRow(x.a, x.c); }).join("") + '</div>'; }

    out += '<div class="muted" style="font-size:.76rem;margin-top:16px;padding:0 4px">Each action carries a deadline, priority, evidence requirement and completion history, and routes to the correct authorised person.</div>';
    out += '</div>';
    setTimeout(function(){
      bindTop();
      root.querySelectorAll("[data-action]").forEach(function(b){ b.onclick=function(){ openActionSheet(b.getAttribute("data-cid"), b.getAttribute("data-action")); }; });
    },0);
    return s+out;
  }
  function actionRow(a, c){
    var at = ATYPES[a.type]||{label:a.type,color:"#6b7ea6"};
    var pr = a.priority==="high"?["danger","High"]:a.priority==="medium"?["warn","Med"]:["neutral","Low"];
    var dueTxt = a.escalated ? "Escalated" : (daysUntil(a.due)<0?"Overdue":daysUntil(a.due)===0?"Due today":"Due "+fmtDate(a.due));
    return '<button class="list-row" data-action="'+a.id+'" data-cid="'+c.id+'" style="border:none;background:none;padding:11px 0;border-bottom:1px solid var(--line);border-radius:0">'
      + '<span class="lr-logo" style="width:34px;height:34px;border-radius:9px;background:'+at.color+'22;color:'+at.color+';border:1px solid '+at.color+'55">'+icon(a.type==="approval"?"check":a.type==="document"?"file":a.type==="decision"?"shield":"alert")+'</span>'
      + '<span class="lr-main"><span class="lr-name" style="font-size:.9rem">'+esc(a.title)+'</span>'
      + '<span class="lr-meta">'+esc(c.name.split(" ")[0])+' · '+esc(a.ref)+'</span></span>'
      + '<span class="lr-right"><span class="pill '+pr[0]+'">'+pr[1]+'</span><div class="lr-meta" style="margin-top:4px;color:'+(a.escalated||daysUntil(a.due)<0?"var(--danger)":"var(--ink-faint)")+'">'+dueTxt+'</div></span></button>';
  }

  function openActionSheet(cid, aid){
    var c=company(cid); var a=c.actions.find(function(x){return x.id===aid;}); if(!a) return;
    var at=ATYPES[a.type]||{label:a.type,color:"#6b7ea6"};
    var verb = {approval:"Approve",document:"Upload evidence",decision:"Confirm decision",review:"Resolve"}[a.type]||"Complete";
    var body='<div class="sheet-grip"></div>'
      + '<span class="pill" style="background:'+at.color+'1f;color:'+at.color+';border-color:'+at.color+'55">'+at.label+'</span>'
      + '<h2 style="margin:10px 0 4px">'+esc(a.title)+'</h2>'
      + '<div class="muted" style="font-size:.86rem">'+esc(c.name)+' · '+esc(a.ref)+'</div>'
      + '<div class="flex-between" style="margin:16px 0"><div><div class="muted" style="font-size:.74rem">Due</div><b>'+(a.escalated?"Escalated":fmtDate(a.due))+'</b></div>'
      + '<div class="right"><div class="muted" style="font-size:.74rem">Priority</div><b style="text-transform:capitalize">'+esc(a.priority)+'</b></div></div>'
      + '<button class="btn btn-primary btn-block" id="act-do">'+verb+'</button>'
      + '<button class="btn btn-ghost btn-block" id="act-open" style="margin-top:10px">Open linked liability</button>';
    openSheet(body);
    document.getElementById("act-do").onclick=function(){
      // resolve action; if linked, advance liability one stage
      var lref = a.refId ? c.liabilities.find(function(l){return l.id===a.refId;}) : null;
      if(lref){ var i=stageIndex(lref.stage); if(i<STAGES.length-1){ lref.stage=STAGES[i+1].key; lref.audit=lref.audit||[]; lref.audit.push({t:todayISO()+" "+nowTime(),who:state.account.role,title:STAGES[i+1].name,desc:a.title+" completed."}); if(lref.stage==="funded"){lref.funded=lref.amount;lref.status="funded";} if(lref.stage==="reconciled")lref.status="reconciled"; } }
      c.actions = c.actions.filter(function(x){return x.id!==a.id;});
      save(); closeSheet(); toast("Action completed"); router();
    };
    document.getElementById("act-open").onclick=function(){ closeSheet(); if(a.refId) openLiabSheet(cid, a.refId); };
  }
  function nowTime(){ return new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}); }

  /* ======================= LIABILITY RECORD SHEET ======================= */
  function openLiabSheet(cid, lid){
    var c=company(cid); var l=c.liabilities.find(function(x){return x.id===lid;}); if(!l) return;
    var idx=stageIndex(l.stage);
    var track='<div class="stage-track">'+STAGES.map(function(st,i){ var cls=i<idx?"done":i===idx?"current":""; return '<div class="st-seg '+cls+'" title="'+st.name+'"></div>'; }).join("")+'</div>';
    var stagesLabels = '<div class="flex-between" style="font-size:.7rem;color:var(--ink-faint);margin-top:4px"><span>'+STAGES[0].name+'</span><span style="color:'+stageMeta(l.stage).color+';font-weight:700">'+stageMeta(l.stage).name+'</span><span>'+STAGES[STAGES.length-1].name+'</span></div>';
    var p=STATUS_PILL[l.status]||["neutral",l.status];

    var body='<div class="sheet-grip"></div>'
      + '<div class="flex-between"><div><h2 style="margin:0">'+esc(l.name)+'</h2><div class="muted" style="font-size:.82rem">'+esc(l.category)+' · '+esc(l.domain)+' · '+esc(l.period)+'</div></div>'
      + '<div class="right"><div style="font-size:1.4rem;font-weight:800">'+gbp(l.amount)+'</div><span class="pill '+p[0]+'">'+p[1]+'</span></div></div>'
      + '<div class="card" style="margin-top:14px;background:var(--panel-2)"><div class="flex-between" style="font-size:.84rem"><span class="muted">Legal obligor</span><b>'+esc(l.obligor)+'</b></div>'
      + '<div class="flex-between" style="font-size:.84rem;margin-top:6px"><span class="muted">Due date</span><b>'+fmtDate(l.due)+'</b></div>'
      + '<div class="flex-between" style="font-size:.84rem;margin-top:6px"><span class="muted">Paid / reserved</span><b>'+gbp(l.funded)+' of '+gbp(l.amount)+'</b></div></div>'
      + '<div class="section-label" style="margin-top:16px">Lifecycle</div>'+track+stagesLabels;

    if(l.stage!=="reconciled"){
      body += '<button class="btn btn-primary btn-block" style="margin-top:14px" id="liab-adv">Advance to '+esc(STAGES[Math.min(idx+1,STAGES.length-1)].name)+'</button>';
    } else { body += '<div style="margin-top:14px"><span class="pill ok">'+icon("check").replace('stroke-width="2"','stroke-width="2" style="width:13px;height:13px"')+' Reconciled — record closed</span></div>'; }

    // evidence
    body += '<div class="section-label" style="margin-top:18px">Evidence</div>';
    if((l.evidence||[]).length){
      body += '<div class="row-list">'+l.evidence.map(function(e){ return '<div class="list-row" style="cursor:default"><span class="lr-logo" style="width:38px;height:38px;border-radius:10px;background:var(--panel-2);color:var(--teal);font-size:.62rem">'+esc(e.type)+'</span><span class="lr-main"><span class="lr-name" style="font-size:.9rem">'+esc(e.label)+'</span><span class="lr-meta">Time-stamped &amp; linked</span></span></div>'; }).join("")+'</div>';
    } else { body += '<div class="muted" style="font-size:.84rem;padding:4px 2px">No evidence attached yet.</div>'; }

    // audit history
    body += '<div class="section-label" style="margin-top:18px">Audit history</div>';
    if((l.audit||[]).length){
      body += '<ul class="timeline">'+l.audit.slice().reverse().map(function(e){ return '<li><span class="tl-node teal"></span><div class="tl-title">'+esc(e.title)+'</div><div class="tl-meta">'+esc(e.t)+' · '+esc(e.who)+'</div><div class="tl-desc">'+esc(e.desc)+'</div></li>'; }).join("")+'</ul>';
    } else { body += '<div class="muted" style="font-size:.84rem;padding:4px 2px">No history recorded.</div>'; }

    openSheet(body);
    var adv=document.getElementById("liab-adv");
    if(adv) adv.onclick=function(){
      var ni=Math.min(idx+1,STAGES.length-1); l.stage=STAGES[ni].key; l.audit=l.audit||[];
      l.audit.push({t:todayISO()+" "+nowTime(),who:state.account.role,title:STAGES[ni].name,desc:"Advanced to "+STAGES[ni].name+"."});
      if(l.stage==="funded"){ l.funded=l.amount; l.status="funded"; }
      if(l.stage==="reconciled") l.status="reconciled";
      save(); closeSheet(); toast("Moved to "+STAGES[ni].name); router();
    };
  }

  /* ======================= CONNECT ======================= */
  function openConnectSheet(cid){
    var body='<div class="sheet-grip"></div><h2>Connect accounting</h2><p class="muted">Sync liabilities automatically. TradeShield reads bills, tax and payroll data — never moves your money.</p>'
      + connectOption("Xero","linear-gradient(135deg,#13b5ea,#0a7bb5)","xero")
      + connectOption("QuickBooks","linear-gradient(135deg,#2ca01c,#1a6b12)","qb")
      + '<div class="demo-note" style="margin-top:16px">Demo connect simulates the OAuth handshake &amp; first sync. Live mode uses your Xero/QuickBooks developer app via your backend.</div>';
    openSheet(body);
    document.querySelectorAll("[data-provider]").forEach(function(b){ b.onclick=function(){ simulateConnect(cid, b.getAttribute("data-provider")); }; });
  }
  function connectOption(name,col,tag){ return '<button class="card" data-provider="'+name+'" style="width:100%;text-align:left;display:flex;align-items:center;gap:14px;margin-top:12px"><span class="int-logo" style="background:'+col+'">'+tag+'</span><span style="flex:1"><span class="int-name" style="display:block">'+name+'</span><span class="muted" style="font-size:.8rem">Connect via secure OAuth</span></span><span class="pill teal">Connect</span></button>'; }
  function simulateConnect(cid,provider){ var c=company(cid); closeSheet(); toast("Redirecting to "+provider+"…"); setTimeout(function(){ c.accounting={provider:provider,status:"connected",lastSync:"just now",entity:c.name}; save(); toast(provider+" connected — liabilities synced"); router(); },1100); }

  /* ======================= INSIGHTS ======================= */
  function renderInsights(){
    var t=portfolioTotals();
    var s=topbar("Insights","Portfolio analytics");
    var out='<div class="screen active">';
    out += '<div class="stat-grid">'
      + stat("Reconciled", t.reconciled+"/"+t.records, "records closed", "accent")
      + stat("Open actions", t.actions+"", "across clients", "")
      + stat("Clients at risk", t.atRisk+"", "high-risk", t.atRisk?"danger":"")
      + stat("Avg allocation", Math.round(state.companies.reduce(function(a,c){return a+c.allocatedPct;},0)/state.companies.length)+"%", "funding", "gold")
      + '</div>';

    // lifecycle distribution
    var life={}; STAGES.forEach(function(s){life[s.key]=0;});
    state.companies.forEach(function(c){ c.liabilities.forEach(function(l){ life[l.stage]=(life[l.stage]||0)+1; }); });
    var lmax=Math.max.apply(null,STAGES.map(function(s){return life[s.key];}))||1;
    out += '<div class="section-label">Liability lifecycle (all clients)</div><div class="card">'
      + STAGES.map(function(s){ return '<div style="margin-bottom:12px"><div class="flex-between" style="font-size:.82rem;margin-bottom:5px"><span><span class="risk-dot" style="background:'+s.color+'"></span> '+s.name+'</span><b>'+life[s.key]+'</b></div><div class="meter"><span style="width:'+(life[s.key]/lmax*100)+'%;background:'+s.color+'"></span></div></div>'; }).join("")+'</div>';

    // by domain
    var dom={}; DOMAINS.forEach(function(d){dom[d.key]=0;});
    state.companies.forEach(function(c){ c.liabilities.forEach(function(l){ dom[l.domain]=(dom[l.domain]||0)+l.amount; }); });
    var dmax=Math.max.apply(null,DOMAINS.map(function(d){return dom[d.key];}))||1;
    out += '<div class="section-label">Liabilities by domain</div><div class="card">'
      + DOMAINS.map(function(d){ return '<div style="margin-bottom:12px"><div class="flex-between" style="font-size:.82rem;margin-bottom:5px"><span><span class="risk-dot" style="background:'+d.color+'"></span> '+d.name+' <span class="muted" style="font-size:.72rem">'+d.desc+'</span></span><b>'+gbpK(dom[d.key])+'</b></div><div class="meter"><span style="width:'+(dom[d.key]/dmax*100)+'%;background:'+d.color+'"></span></div></div>'; }).join("")+'</div>';

    out += '<div class="section-label">Funding trend</div><div class="card">'+trendChart()+'</div>';
    out += '</div>';
    setTimeout(bindTop,0);
    return s+out;
  }
  function trendChart(){
    var pts=[42,55,61,72,79,90], labels=["Mar","Apr","May","Jun","Jul","Aug"];
    var W=560,H=190,pad={l:14,r:14,t:16,b:28},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b,max=100,step=iw/(pts.length-1);
    function x(i){return pad.l+i*step;} function y(v){return pad.t+ih-(v/max)*ih;}
    var line="",area="M"+x(0)+" "+(pad.t+ih),dots="",labs="";
    pts.forEach(function(p,i){ line+=(i?"L":"M")+x(i)+" "+y(p)+" "; area+=" L"+x(i)+" "+y(p); dots+='<circle cx="'+x(i)+'" cy="'+y(p)+'" r="3.5" fill="#050b1c" stroke="#29c2d8" stroke-width="2.5"/>'; labs+='<text x="'+x(i)+'" y="'+(H-9)+'" text-anchor="middle" font-size="10" fill="#6b7ea6">'+labels[i]+'</text>'; });
    area+=" L"+x(pts.length-1)+" "+(pad.t+ih)+" Z";
    return '<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#29c2d8" stop-opacity=".28"/><stop offset="1" stop-color="#29c2d8" stop-opacity="0"/></linearGradient></defs><path d="'+area+'" fill="url(#ar)"/><path d="'+line+'" fill="none" stroke="url(#tsg)" stroke-width="2.5" stroke-linejoin="round"/>'+dots+labs+'<text x="'+pad.l+'" y="12" font-size="10" fill="#6b7ea6">% allocated</text></svg>';
  }

  /* ======================= INTEGRATIONS ======================= */
  function renderIntegrations(){
    var s=topbar("Connect","Accounting integrations");
    var connected=state.companies.filter(function(c){return c.accounting.status==="connected";});
    var out='<div class="screen active">';
    out += '<div class="card"><div class="card-head"><div><h2>Accounting software</h2><div class="sub">Auto-sync liabilities from your ledgers</div></div></div><div class="grid-2">'
      + providerCard("Xero","linear-gradient(135deg,#13b5ea,#0a7bb5)","xero",state.companies.filter(function(c){return c.accounting.provider==="Xero";}).length)
      + providerCard("QuickBooks","linear-gradient(135deg,#2ca01c,#1a6b12)","qb",state.companies.filter(function(c){return c.accounting.provider==="QuickBooks";}).length)
      + '</div></div>';
    out += '<div class="section-label">Connected clients</div><div class="card">';
    if(!connected.length) out+='<div class="empty">No clients connected yet.</div>';
    else out += connected.map(function(c){ var col=c.accounting.provider==="Xero"?"#13b5ea":"#2ca01c";
      return '<div class="flex-between" style="padding:11px 0;border-bottom:1px solid var(--line)"><div style="display:flex;align-items:center;gap:11px"><span class="lr-logo" style="width:38px;height:38px;background:'+c.logoColor+'">'+initials(c.name)+'</span><div><div style="font-weight:600;color:#fff;font-size:.9rem">'+esc(c.name)+'</div><div class="muted" style="font-size:.76rem"><span style="color:'+col+'">'+c.accounting.provider+'</span> · synced '+esc(c.accounting.lastSync)+'</div></div></div><button class="btn btn-ghost btn-sm" data-resync="'+c.id+'">Sync</button></div>'; }).join("")+'</div>';
    out += '<div class="section-label">Sync activity</div><div class="card"><div class="sync-log">'
      + syncRow("2 min ago","Northgate Fabrication — 6 liabilities updated from Xero")
      + syncRow("18 min ago","Harbour Logistics — VAT marked paid (QuickBooks)")
      + syncRow("1 hr ago","Northgate Fabrication — new bill: Professional fees £20,500")
      + syncRow("3 hrs ago","Portfolio sync completed · 2 of 3 clients connected")+'</div></div>';
    out += '<div class="demo-note" style="margin-top:16px">Live integrations require a Xero/QuickBooks developer app and a backend to hold OAuth tokens securely. The sync engine &amp; data mapping are built — connect your credentials to go live.</div></div>';
    setTimeout(function(){ bindTop(); root.querySelectorAll("[data-resync]").forEach(function(b){ b.onclick=function(){ var c=company(b.getAttribute("data-resync")); c.accounting.lastSync="just now"; save(); toast("Synced "+c.name); renderShell(renderIntegrations(),"integrations"); }; }); },0);
    return s+out;
  }
  function providerCard(name,col,tag,count){ return '<div class="card" style="background:var(--panel-2)"><div class="integration" style="flex-direction:column;align-items:flex-start;gap:10px"><span class="int-logo" style="background:'+col+'">'+tag+'</span><div><div class="int-name">'+name+'</div><div class="muted" style="font-size:.78rem">'+count+' client'+(count===1?"":"s")+' connected</div></div><span class="pill '+(count?"ok":"neutral")+'">'+(count?"Active":"Available")+'</span></div></div>'; }
  function syncRow(time,txt){ return '<div class="sl-row"><span class="sl-time">'+time+'</span><span>'+esc(txt)+'</span></div>'; }

  /* ======================= ACCOUNT ======================= */
  function renderAccount(){
    var a=state.account;
    var s=topbar("Account",a.firm);
    var out='<div class="screen active">';
    out += '<div class="card" style="text-align:center"><div class="avatar" style="width:72px;height:72px;border-radius:22px;font-size:1.5rem;margin:6px auto 12px">'+esc(a.initials)+'</div><h2 style="margin:0">'+esc(a.user)+'</h2><div class="muted">'+esc(a.email)+'</div><span class="pill teal" style="margin-top:12px">'+esc(a.role)+'</span></div>';

    // roles / access
    out += '<div class="section-label">Roles &amp; access</div><div class="card">'
      + roleRow("Client Director","Full position, approvals, exceptions, board reports", a.role==="Client Director")
      + roleRow("Finance User","Create/update records, upload evidence, reconcile", a.role==="Finance User")
      + roleRow("PTC Operations","Manage in-scope liabilities, actions, payments", a.role==="PTC Operations")
      + roleRow("Adviser / Accountant","Optional read-only or selected-record access", a.role==="Adviser / Accountant")
      + '</div>';

    out += '<div class="section-label">Subscription</div><div class="card">'
      + '<div class="flex-between" style="padding:6px 0"><span class="muted">Plan</span><b>'+esc(a.plan)+' · £149/mo</b></div>'
      + '<div class="flex-between" style="padding:6px 0"><span class="muted">Clients</span><b>'+state.companies.length+' of 25</b></div>'
      + '<div class="flex-between" style="padding:6px 0"><span class="muted">Renews</span><b>1 Sep 2026</b></div>'
      + '<button class="btn btn-gold btn-block" style="margin-top:12px">Manage billing</button>'
      + '<div class="muted" style="font-size:.74rem;text-align:center;margin-top:8px">Billing connects to Stripe in production.</div></div>';

    out += '<div class="section-label">Notifications</div><div class="card">'
      + prefRow("Push alerts","Upcoming dues, funding gaps &amp; overdue items")
      + prefRow("Weekly digest","Portfolio summary every Monday")
      + prefRow("Auto-create actions","Raise an action when an exception is detected")
      + '</div>';

    // compliance boundaries (Client Guide p.13)
    out += '<div class="section-label">Important information</div><div class="card">'
      + boundary("No automatic discharge","Recording, allocating or approving a liability does not itself pay, settle or extinguish it.")
      + boundary("Officer duties remain","The app does not remove statutory duties owed by company officers or replace professional advice.")
      + boundary("Scope is contractual","Which liabilities are managed is set by the signed agreement and onboarding scope.")
      + boundary("Exceptions need action","Disputed, unverified or overdue items require evidence and a responsible decision.")
      + '</div>';

    out += '<button class="btn btn-danger btn-block" style="margin-top:18px" id="logout">'+icon("logout").replace('stroke-width="2"','stroke-width="2" style="width:16px;height:16px"')+' Sign out</button>';
    out += '<div class="muted" style="text-align:center;font-size:.72rem;margin-top:14px">TradeShield PTC Client App · v1.0 demo · tradeshielduk.org</div></div>';
    setTimeout(function(){ bindTop();
      var lo=document.getElementById("logout"); if(lo) lo.onclick=function(){ ui.loggedIn=false; sset("ts.loggedIn","0"); location.hash=""; renderLogin(); };
      root.querySelectorAll("[data-toggle]").forEach(function(t){ t.onclick=function(){ t.classList.toggle("on"); t.style.background=t.classList.contains("on")?"var(--teal)":"var(--line-2)"; t.querySelector("span").style.right=t.classList.contains("on")?"3px":"auto"; t.querySelector("span").style.left=t.classList.contains("on")?"auto":"3px"; }; });
    },0);
    return s+out;
  }
  function roleRow(name,sub,active){ return '<div class="flex-between" style="padding:11px 0;border-bottom:1px solid var(--line)"><div style="display:flex;align-items:center;gap:11px"><span class="lr-logo" style="width:34px;height:34px;border-radius:9px;background:var(--panel-2);color:var(--teal);font-size:.7rem">'+initials(name)+'</span><div><div style="font-weight:600;color:#fff;font-size:.88rem">'+name+'</div><div class="muted" style="font-size:.74rem">'+sub+'</div></div></div>'+(active?'<span class="pill teal">You</span>':'<span class="muted">'+icon("lock").replace('stroke-width="2"','stroke-width="2" style="width:15px;height:15px"')+'</span>')+'</div>'; }
  function boundary(title,desc){ return '<div style="display:flex;gap:11px;padding:10px 0;border-bottom:1px solid var(--line)"><span style="color:var(--warn);flex:none;margin-top:1px">'+icon("alert").replace('stroke-width="2"','stroke-width="2" style="width:18px;height:18px"')+'</span><div><div style="font-weight:600;color:#fff;font-size:.86rem">'+title+'</div><div class="muted" style="font-size:.78rem">'+desc+'</div></div></div>'; }
  function prefRow(title,sub){ return '<div class="flex-between" style="padding:11px 0;border-bottom:1px solid var(--line)"><div><div style="font-weight:600;color:#fff;font-size:.9rem">'+title+'</div><div class="muted" style="font-size:.76rem">'+sub+'</div></div><span class="tgl on" data-toggle style="width:44px;height:26px;border-radius:999px;background:var(--teal);position:relative;flex:none;transition:.2s;display:inline-block"><span style="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s"></span></span></div>'; }

  /* ======================= reports ======================= */
  function exportReport(c, name){
    var lines=[]; lines.push("TRADESHIELD — "+name.toUpperCase()); lines.push(c.name+" · generated "+new Date().toLocaleString("en-GB")); lines.push("");
    lines.push("Total recorded,"+c.totalLiabilities); lines.push("Due next 7 days,"+c.next7); lines.push("Overdue,"+c.overdue); lines.push("Funding gap,"+c.fundingGap); lines.push("Allocated %,"+c.allocatedPct); lines.push("");
    lines.push("Liability,Category,Domain,Due,Amount,Funded,Stage,Status");
    c.liabilities.forEach(function(l){ lines.push([l.name,l.category,l.domain,l.due,l.amount,l.funded,stageMeta(l.stage).name,(STATUS_PILL[l.status]||["",l.status])[1]].map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(",")); });
    var blob=new Blob([lines.join("\n")],{type:"text/csv"}); var url=URL.createObjectURL(blob); var a=document.createElement("a"); a.href=url; a.download="tradeshield-"+name.toLowerCase().replace(/\s+/g,"-")+".csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},1000);
    toast(name+" exported");
  }

  /* ======================= sheet plumbing ======================= */
  function openSheet(html){ var b=document.getElementById("sheet"); if(!b){ b=document.createElement("div"); b.id="sheet"; b.className="sheet-backdrop"; b.innerHTML='<div class="sheet"></div>'; document.body.appendChild(b); b.onclick=function(e){ if(e.target===b) closeSheet(); }; } b.querySelector(".sheet").innerHTML=html; requestAnimationFrame(function(){ b.classList.add("show"); }); }
  function closeSheet(){ var b=document.getElementById("sheet"); if(b) b.classList.remove("show"); }

  /* ======================= boot ======================= */
  window.addEventListener("hashchange", router);
  router();
  window.TSApp = { router: router };
})();
