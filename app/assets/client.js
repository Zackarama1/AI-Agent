/* ==========================================================================
   TradeShield — Client App (the business owner's own view)
   Single-business: status, liabilities, an AI assistant grounded in the real
   figures, and 24/7 support. Reuses window.TS_SEED (data.js).
   ========================================================================== */
(function () {
  "use strict";

  var STORE = "tradeshield.client.v1";
  var seed = JSON.parse(JSON.stringify(window.TS_SEED));
  // the client sees ONE business (their own)
  var biz = load();
  var client = { company: biz.name, director: "James Whitfield", initials: "JW", role: "Client Director", plan: "TradeShield Protect", email: "james@northgatefab.co.uk" };
  var ui = { loggedIn: sget("tsc.loggedIn") === "1" };
  var chat = []; // in-memory conversation

  function load(){ try { var r=localStorage.getItem(STORE); if(r) return JSON.parse(r); } catch(e){} var b=seed.companies[0]; save(b); return b; }
  function save(b){ try { localStorage.setItem(STORE, JSON.stringify(b||biz)); } catch(e){} }
  function sget(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function sset(k,v){ try { localStorage.setItem(k,v); } catch(e){} }

  var STAGES = seed.stages, DOMAINS = seed.domains, ATYPES = seed.actionTypes;
  function gbp(n){ return "£"+Math.round(n).toLocaleString("en-GB"); }
  function gbpK(n){ if(n>=1e6) return "£"+(n/1e6).toFixed(n>=1e7?1:2)+"m"; if(n>=1000) return "£"+Math.round(n/1000)+"k"; return "£"+Math.round(n); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function fmtDate(d){ return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"short"}); }
  function stageMeta(k){ return STAGES.find(function(s){return s.key===k;})||STAGES[0]; }
  function stageIndex(k){ return STAGES.findIndex(function(s){return s.key===k;}); }
  function domainMeta(k){ return DOMAINS.find(function(d){return d.key===k;})||{color:"#6b7ea6",name:k}; }
  function daysUntil(d){ return Math.round((new Date(d)-new Date("2026-08-16"))/86400000); }
  var STATUS_PILL = { funded:["ok","Funded"], part:["warn","Part funded"], due:["info","Due"], soon:["warn","Due soon"], approved:["teal","Approved"], overdue:["danger","Overdue"], reconciled:["ok","Reconciled"] };
  var CAT_COLOR = { "VAT":"#3b82f6","PAYE & NIC":"#8a7bff","Corporation Tax":"#ff6b5e","Staff wages":"#35d29a","Suppliers":"#f0b64a","Insurance":"#29c2d8","Trade finance":"#5c6cff","Professional fees":"#c79a3e","Other":"#6b7ea6" };
  function nowTime(){ return new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}); }

  /* ---- derived business facts (for KPIs + the assistant) ---- */
  function facts(){
    var overdue = biz.liabilities.filter(function(l){return l.status==="overdue";});
    var hmrc = biz.liabilities.filter(function(l){return l.domain==="HMRC";});
    var upcoming = biz.liabilities.filter(function(l){return (l.amount-l.funded)>0 && daysUntil(l.due)>=-30;}).sort(function(a,b){return new Date(a.due)-new Date(b.due);});
    var pending = biz.actions.filter(function(a){return a.type==="approval"||a.type==="decision"||a.escalated;});
    var domTotals = {}; DOMAINS.forEach(function(d){domTotals[d.key]=0;}); biz.liabilities.forEach(function(l){domTotals[l.domain]=(domTotals[l.domain]||0)+l.amount;});
    var health = Math.max(28, Math.min(96, biz.allocatedPct - (overdue.length?12:0) - Math.min(20, Math.round(biz.fundingGap/biz.totalLiabilities*30))));
    var statusKey = overdue.length ? (biz.fundingGap/biz.totalLiabilities>0.25?"risk":"attention") : (biz.fundingGap>0?"attention":"ontrack");
    return { overdue:overdue, hmrc:hmrc, upcoming:upcoming, pending:pending, domTotals:domTotals, health:health, statusKey:statusKey };
  }

  /* ---- icons ---- */
  function tsMark(cls){ return '<svg class="'+(cls||"tsmark")+'" viewBox="0 0 100 110" aria-hidden="true"><defs><linearGradient id="shg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#29c2d8"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><path d="M50 5 8 22v33c0 29 19 43 42 49 23-6 42-20 42-49V22z" fill="none" stroke="url(#shg)" stroke-width="5"/><path d="M35 54l11 11 22-24" fill="none" stroke="url(#shg)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function icon(n){ var p={
      home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
      list:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
      spark:'<path d="M12 3l1.8 4.8L18.6 9l-4.8 1.2L12 15l-1.8-4.8L5.4 9l4.8-1.2z"/><path d="M18 15l.9 2.4L21 18l-2.1.6L18 21l-.9-2.4L15 18l2.1-.6z"/>',
      life:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
      bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
      chevron:'<path d="M9 6l6 6-6 6"/>', send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
      chat:'<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
      mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="M20 6L9 17l-5-5"/>', shield:'<path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7z"/>',
      alert:'<path d="M12 2l10 18H2z"/><path d="M12 9v5M12 17h.01"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>', file:'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/>' };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(p[n]||"")+'</svg>'; }

  var root = document.getElementById("app");
  function toast(msg){ var t=document.getElementById("toast"); if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t);} t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(function(){t.classList.remove("show");},2400); }

  /* ================= ROUTER ================= */
  function router(){
    if(!ui.loggedIn){ renderLogin(); return; }
    var v = (location.hash.replace(/^#\/?/,"")||"home").split("/")[0];
    if(v==="liabilities") renderShell(renderLiabilities(),"liabilities");
    else if(v==="assistant") renderAssistant();
    else if(v==="support") renderShell(renderSupport(),"support");
    else if(v==="account") renderShell(renderAccount(),"account");
    else renderShell(renderHome(),"home");
    if(v!=="assistant") window.scrollTo(0,0);
  }
  function renderShell(inner, tab){ root.innerHTML = inner + tabbar(tab); bindTabs(); }
  function tabbar(active){
    var tabs=[["home","home","Home"],["liabilities","list","Liabilities"],["assistant","spark","Assistant"],["support","life","Support"],["account","user","Account"]];
    return '<nav class="tabbar">'+tabs.map(function(t){return '<button data-route="'+t[0]+'" class="'+(t[0]===active?"active":"")+'">'+icon(t[1])+'<span>'+t[2]+'</span></button>';}).join("")+'</nav>';
  }
  function bindTabs(){ root.querySelectorAll(".tabbar button").forEach(function(b){ b.onclick=function(){ location.hash="#/"+b.getAttribute("data-route"); }; }); }
  function topbar(title, sub){
    return '<header class="topbar"><div style="display:flex;align-items:center;gap:12px"><div>'+tsMark()+'</div><div><div class="tb-title">'+esc(title)+'</div>'+(sub?'<div class="tb-sub">'+esc(sub)+'</div>':'')+'</div></div>'
      + '<div class="tb-right"><button class="icon-btn" id="tb-help">'+icon("life")+'</button><div class="avatar">'+esc(client.initials)+'</div></div></header>';
  }
  function bindTop(){ var h=document.getElementById("tb-help"); if(h) h.onclick=function(){ location.hash="#/support"; }; }

  /* ================= LOGIN ================= */
  function renderLogin(){
    root.innerHTML = '<div class="login-screen"><div class="login-hero">'+tsMark("lh-mark")
      + '<h1><span class="t">TRADE</span> <span class="s">SHIELD</span></h1><p>Your business, protected. See exactly where you stand — any time.</p></div>'
      + '<div class="field"><label>Email</label><input id="lg-email" type="email" value="james@northgatefab.co.uk"></div>'
      + '<div class="field"><label>Password</label><input id="lg-pass" type="password" value="demo"></div>'
      + '<button class="btn btn-primary btn-block" id="lg-btn">Sign in to my business</button>'
      + '<div class="login-alt">Protected by TradeShield · <a href="#" id="lg-help">Need help?</a></div>'
      + '<div class="demo-note">Demo build · any credentials sign you in.</div></div>';
    document.getElementById("lg-btn").onclick=doLogin;
    document.getElementById("lg-help").onclick=function(e){e.preventDefault();doLogin();};
    document.getElementById("lg-pass").onkeydown=function(e){ if(e.key==="Enter") doLogin(); };
  }
  function doLogin(){ ui.loggedIn=true; sset("tsc.loggedIn","1"); location.hash="#/home"; router(); toast("Welcome back, "+client.director.split(" ")[0]); }

  /* ================= HOME ================= */
  function renderHome(){
    var f = facts();
    var s = topbar(client.company, "Your live position");
    var statusText = { risk:"Action needed", attention:"Needs attention", ontrack:"On track" }[f.statusKey];
    var ringCol = { risk:"#ff6b5e", attention:"#f0b64a", ontrack:"#35d29a" }[f.statusKey];
    var C = 2*Math.PI*25;
    var summaryBits = [];
    if(f.overdue.length) summaryBits.push('<span class="pill danger">'+f.overdue.length+' overdue</span>');
    if(biz.fundingGap>0) summaryBits.push('<span class="pill warn">'+gbpK(biz.fundingGap)+' to fund</span>');
    if(f.pending.length) summaryBits.push('<span class="pill teal">'+f.pending.length+' waiting on you</span>');
    if(!summaryBits.length) summaryBits.push('<span class="pill ok">All clear</span>');

    var out = '<div class="screen active">';
    out += '<div class="greet"><h1>Hi '+esc(client.director.split(" ")[0])+' 👋</h1><p>Here\'s how '+esc(client.company)+' is doing today.</p></div>';

    // status hero
    out += '<div class="status-hero '+f.statusKey+'"><div class="sh-top">'
      + '<div class="sh-ring"><svg viewBox="0 0 58 58"><circle class="rt" cx="29" cy="29" r="25"/><circle class="rv" cx="29" cy="29" r="25" stroke="'+ringCol+'" stroke-dasharray="'+C+'" stroke-dashoffset="'+(C*(1-f.health/100))+'" transform="rotate(-90 29 29)"/></svg><b>'+f.health+'</b></div>'
      + '<div><div class="sh-label">Business status</div><div class="sh-status">'+statusText+'</div></div></div>'
      + '<div class="sh-summary">'+statusSentence(f)+'</div>'
      + '<div class="sh-chips">'+summaryBits.join("")+'</div></div>';

    // KPIs
    out += '<div class="section-label">Your numbers</div>';
    out += '<div class="stat-grid">'
      + stat("Total recorded", gbp(biz.totalLiabilities), biz.liabilities.length+" liabilities", "accent")
      + stat("Due next 7 days", gbp(biz.next7), "coming up", "")
      + stat("Overdue", gbp(biz.overdue), biz.overdue>0?"needs action":"none", biz.overdue>0?"danger":"")
      + stat("Still to fund", gbp(biz.fundingGap), "projected gap", "gold")
      + '</div>';

    // funding
    out += '<div class="card" style="margin-top:14px"><div class="card-head"><div><h2>Funding position</h2><div class="sub">How much of your liabilities is covered</div></div></div>'
      + donut(biz.allocatedPct)
      + fundLine("#29c2d8","Funds allocated",gbp(biz.allocated))
      + fundLine("#d8b866","Paid or reserved",gbp(biz.paidReserved))
      + fundLine("#ff6b5e","Still to fund",gbp(biz.fundingGap))
      + '</div>';

    // needs your attention
    if(f.pending.length){
      out += '<div class="section-label">Needs your attention</div><div class="card" style="padding:6px 14px">'
        + f.pending.map(actionRow).join("") + '</div>';
    }

    // upcoming payments
    out += '<div class="section-label">Upcoming payments</div><div class="card" style="padding:6px 14px">'
      + f.upcoming.slice(0,4).map(liabRow).join("") + '</div>';

    // 24/7 support enquiry (at the bottom)
    out += '<div class="section-label">Here to help, 24/7</div>';
    out += '<div class="support-cta"><h3><span class="live-dot"></span>Talk to your TradeShield team</h3>'
      + '<p style="margin:6px 0 0;color:var(--ink-soft);font-size:.9rem">Question about a payment, a deadline or your position? Send us a message any time — day or night.</p>'
      + '<textarea id="home-support" placeholder="Type your question or request…"></textarea>'
      + '<div class="support-row"><button class="btn btn-primary" style="flex:1" id="home-support-send">Send to support</button>'
      + '<button class="btn btn-ghost" id="home-ai">'+icon("spark").replace('stroke-width="2"','stroke-width="2" style="width:16px;height:16px"')+' Ask the assistant</button></div></div>';

    out += '</div>';
    setTimeout(function(){
      bindTop();
      root.querySelectorAll("[data-liab]").forEach(function(b){ b.onclick=function(){ openLiabSheet(b.getAttribute("data-liab")); }; });
      root.querySelectorAll("[data-action]").forEach(function(b){ b.onclick=function(){ openActionSheet(b.getAttribute("data-action")); }; });
      var ss=document.getElementById("home-support-send"); if(ss) ss.onclick=function(){ var v=(document.getElementById("home-support").value||"").trim(); if(!v){ toast("Type a message first"); return; } document.getElementById("home-support").value=""; toast("Sent — an agent will reply shortly"); };
      var ai=document.getElementById("home-ai"); if(ai) ai.onclick=function(){ location.hash="#/assistant"; };
    },0);
    return s+out;
  }
  function statusSentence(f){
    var parts=[];
    if(f.overdue.length) parts.push(f.overdue.length+" liabilit"+(f.overdue.length===1?"y is":"ies are")+" overdue ("+gbp(f.overdue.reduce(function(a,l){return a+(l.amount-l.funded);},0))+")");
    if(biz.fundingGap>0) parts.push(gbp(biz.fundingGap)+" still needs funding before its due dates");
    if(f.pending.length) parts.push(f.pending.length+" item"+(f.pending.length===1?"":"s")+" waiting for your approval");
    if(!parts.length) return "Everything is recorded, funded and on track. Nothing needs your attention right now.";
    return "You're "+Math.round(biz.allocatedPct)+"% funded. "+parts.join("; ")+".";
  }
  function stat(label,val,delta,cls){ return '<div class="stat '+(cls||"")+'"><div class="s-label">'+label+'</div><div class="s-val">'+val+'</div>'+(delta?'<div class="s-delta muted">'+delta+'</div>':'')+'</div>'; }
  function fundLine(col,label,amt){ return '<div class="flex-between" style="font-size:.86rem;padding:5px 0"><span class="lr-meta" style="display:flex;align-items:center;gap:8px;color:var(--ink-soft)"><span class="risk-dot" style="background:'+col+'"></span>'+label+'</span><b>'+amt+'</b></div>'; }
  function donut(pct){ var C=2*Math.PI*44; return '<div class="donut-wrap"><svg class="donut" viewBox="0 0 100 100"><defs><linearGradient id="tsg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#29c2d8"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><circle class="trk" cx="50" cy="50" r="44"/><circle class="val" cx="50" cy="50" r="44" stroke-dasharray="'+C+'" stroke-dashoffset="'+(C*(1-pct/100))+'"/></svg><div class="donut-center"><b>'+pct+'%</b><span>Funded</span></div></div>'; }

  function liabRow(l){
    var p=STATUS_PILL[l.status]||["neutral",l.status];
    return '<button class="list-row" data-liab="'+l.id+'" style="border:none;background:none;padding:11px 0;border-bottom:1px solid var(--line);border-radius:0">'
      + '<span class="lr-logo" style="width:34px;height:34px;border-radius:9px;font-size:.7rem;background:'+(CAT_COLOR[l.category]||"#6b7ea6")+'">'+l.category[0]+'</span>'
      + '<span class="lr-main"><span class="lr-name" style="font-size:.9rem">'+esc(l.name)+'</span><span class="lr-meta">Due '+fmtDate(l.due)+' · '+stageMeta(l.stage).name+'</span></span>'
      + '<span class="lr-right"><span class="lr-fig" style="font-size:.9rem">'+gbp(l.amount)+'</span><div style="margin-top:4px"><span class="pill '+p[0]+'">'+p[1]+'</span></div></span></button>';
  }
  function actionRow(a){
    var at=ATYPES[a.type]||{label:a.type,color:"#6b7ea6"};
    var pr=a.priority==="high"?["danger","High"]:a.priority==="medium"?["warn","Med"]:["neutral","Low"];
    var due=a.escalated?"Escalated":(daysUntil(a.due)<0?"Overdue":daysUntil(a.due)===0?"Due today":"Due "+fmtDate(a.due));
    return '<button class="list-row" data-action="'+a.id+'" style="border:none;background:none;padding:11px 0;border-bottom:1px solid var(--line);border-radius:0">'
      + '<span class="lr-logo" style="width:34px;height:34px;border-radius:9px;background:'+at.color+'22;color:'+at.color+';border:1px solid '+at.color+'55">'+icon(a.type==="approval"?"check":a.type==="document"?"file":a.type==="decision"?"shield":"alert")+'</span>'
      + '<span class="lr-main"><span class="lr-name" style="font-size:.9rem">'+esc(a.title)+'</span><span class="lr-meta">'+at.label+' · '+esc(a.ref)+'</span></span>'
      + '<span class="lr-right"><span class="pill '+pr[0]+'">'+pr[1]+'</span><div class="lr-meta" style="margin-top:4px;color:'+(a.escalated||daysUntil(a.due)<0?"var(--danger)":"var(--ink-faint)")+'">'+due+'</div></span></button>';
  }

  /* ================= LIABILITIES ================= */
  function renderLiabilities(){
    var s = topbar("Liabilities", "Every obligation, its funding & status");
    var out='<div class="screen active">';
    out += '<div class="stat-grid" style="grid-template-columns:1fr 1fr">'
      + stat("Total recorded", gbp(biz.totalLiabilities), biz.liabilities.length+" records", "accent")
      + stat("Overdue", gbp(biz.overdue), biz.overdue>0?"action needed":"none", biz.overdue>0?"danger":"")
      + '</div>';
    out += '<div class="section-label">Your liability register</div><div class="card" style="padding:6px 14px">'
      + biz.liabilities.slice().sort(function(a,b){return new Date(a.due)-new Date(b.due);}).map(liabRow).join("") + '</div>';
    out += '<div class="muted" style="font-size:.76rem;margin-top:14px;padding:0 4px">Tap any liability to see its funding, evidence and full history.</div>';
    out += '</div>';
    setTimeout(function(){ bindTop(); root.querySelectorAll("[data-liab]").forEach(function(b){ b.onclick=function(){ openLiabSheet(b.getAttribute("data-liab")); }; }); },0);
    return s+out;
  }

  function openLiabSheet(lid){
    var l=biz.liabilities.find(function(x){return x.id===lid;}); if(!l) return;
    var idx=stageIndex(l.stage);
    var track='<div class="stage-track">'+STAGES.map(function(st,i){var cls=i<idx?"done":i===idx?"current":""; return '<div class="st-seg '+cls+'"></div>';}).join("")+'</div>';
    var labels='<div class="flex-between" style="font-size:.7rem;color:var(--ink-faint);margin-top:4px"><span>'+STAGES[0].name+'</span><span style="color:'+stageMeta(l.stage).color+';font-weight:700">'+stageMeta(l.stage).name+'</span><span>'+STAGES[STAGES.length-1].name+'</span></div>';
    var p=STATUS_PILL[l.status]||["neutral",l.status];
    var body='<div class="sheet-grip"></div><div class="flex-between"><div><h2 style="margin:0">'+esc(l.name)+'</h2><div class="muted" style="font-size:.82rem">'+esc(l.category)+' · '+esc(l.domain)+' · '+esc(l.period)+'</div></div><div class="right"><div style="font-size:1.4rem;font-weight:800">'+gbp(l.amount)+'</div><span class="pill '+p[0]+'">'+p[1]+'</span></div></div>'
      + '<div class="card" style="margin-top:14px;background:var(--panel-2)"><div class="flex-between" style="font-size:.84rem"><span class="muted">Due date</span><b>'+fmtDate(l.due)+'</b></div><div class="flex-between" style="font-size:.84rem;margin-top:6px"><span class="muted">Paid / reserved</span><b>'+gbp(l.funded)+' of '+gbp(l.amount)+'</b></div><div class="flex-between" style="font-size:.84rem;margin-top:6px"><span class="muted">Legal obligor</span><b>'+esc(l.obligor)+'</b></div></div>'
      + '<div class="section-label" style="margin-top:16px">Progress</div>'+track+labels;
    body += '<div class="section-label" style="margin-top:18px">Evidence</div>';
    body += (l.evidence||[]).length ? '<div class="row-list">'+l.evidence.map(function(e){return '<div class="list-row" style="cursor:default"><span class="lr-logo" style="width:38px;height:38px;border-radius:10px;background:var(--panel-2);color:var(--teal);font-size:.62rem">'+esc(e.type)+'</span><span class="lr-main"><span class="lr-name" style="font-size:.9rem">'+esc(e.label)+'</span><span class="lr-meta">Time-stamped &amp; linked</span></span></div>';}).join("")+'</div>' : '<div class="muted" style="font-size:.84rem">No evidence attached yet.</div>';
    body += '<div class="section-label" style="margin-top:18px">History</div>';
    body += (l.audit||[]).length ? '<ul class="timeline">'+l.audit.slice().reverse().map(function(e){return '<li><span class="tl-node teal"></span><div class="tl-title">'+esc(e.title)+'</div><div class="tl-meta">'+esc(e.t)+' · '+esc(e.who)+'</div><div class="tl-desc">'+esc(e.desc)+'</div></li>';}).join("")+'</ul>' : '<div class="muted" style="font-size:.84rem">No history recorded.</div>';
    body += '<button class="btn btn-ghost btn-block" style="margin-top:18px" id="liab-ask">'+icon("spark").replace('stroke-width="2"','stroke-width="2" style="width:15px;height:15px"')+' Ask the assistant about this</button>';
    openSheet(body);
    document.getElementById("liab-ask").onclick=function(){ closeSheet(); location.hash="#/assistant"; setTimeout(function(){ sendUser("Tell me about my "+l.name+" liability"); },250); };
  }

  function openActionSheet(aid){
    var a=biz.actions.find(function(x){return x.id===aid;}); if(!a) return;
    var at=ATYPES[a.type]||{label:a.type,color:"#6b7ea6"};
    var verb={approval:"Approve",document:"Upload evidence",decision:"Confirm",review:"Resolve"}[a.type]||"Complete";
    var body='<div class="sheet-grip"></div><span class="pill" style="background:'+at.color+'1f;color:'+at.color+';border-color:'+at.color+'55">'+at.label+'</span><h2 style="margin:10px 0 4px">'+esc(a.title)+'</h2><div class="muted" style="font-size:.86rem">'+esc(a.ref)+'</div>'
      + '<div class="flex-between" style="margin:16px 0"><div><div class="muted" style="font-size:.74rem">Due</div><b>'+(a.escalated?"Escalated":fmtDate(a.due))+'</b></div><div class="right"><div class="muted" style="font-size:.74rem">Priority</div><b style="text-transform:capitalize">'+esc(a.priority)+'</b></div></div>'
      + '<button class="btn btn-primary btn-block" id="act-do">'+verb+'</button>'
      + '<button class="btn btn-ghost btn-block" id="act-help" style="margin-top:10px">Ask a question first</button>';
    openSheet(body);
    document.getElementById("act-do").onclick=function(){
      var l=a.refId?biz.liabilities.find(function(x){return x.id===a.refId;}):null;
      if(l){ var i=stageIndex(l.stage); if(i<STAGES.length-1){ l.stage=STAGES[i+1].key; l.audit=l.audit||[]; l.audit.push({t:"2026-08-16 "+nowTime(),who:client.role,title:STAGES[i+1].name,desc:a.title+" completed by "+client.director+"."}); if(l.stage==="funded"){l.funded=l.amount;l.status="funded";} } }
      biz.actions=biz.actions.filter(function(x){return x.id!==a.id;}); save(); closeSheet(); toast(verb+"d — thank you"); router();
    };
    document.getElementById("act-help").onclick=function(){ closeSheet(); location.hash="#/assistant"; setTimeout(function(){ sendUser("What does '"+a.title+"' mean and what happens if I approve it?"); },250); };
  }

  /* ================= AI ASSISTANT ================= */
  function renderAssistant(){
    if(!chat.length){ chat.push({who:"bot", html:"Hi "+esc(client.director.split(" ")[0])+" 👋 I'm your TradeShield assistant. I can see <b>"+esc(client.company)+"</b>'s live position and answer questions about what's due, what's funded and what needs you. Ask me anything — or tap a suggestion below."}); }
    var head = '<div class="chat-head"><div class="ch-av">'+icon("spark")+'</div><div><div class="ch-name">TradeShield Assistant</div><div class="ch-status"><span class="live-dot" style="width:7px;height:7px;box-shadow:none"></span> Online · sees your live data</div></div></div>';
    var msgs = '<div class="chat-scroll" id="chat-scroll">'+chat.map(bubble).join("")+'</div>';
    var chips = ['What needs my approval?','What\'s overdue?','How much do I owe HMRC?','What\'s my funding gap?','When\'s my next payment?','How is my business doing?'];
    var chipRow = '<div class="chips-wrap"><div class="chips" id="chips">'+chips.map(function(c){return '<button class="chip" data-chip="'+esc(c)+'">'+esc(c)+'</button>';}).join("")+'</div></div>';
    var composer = '<div class="composer"><input id="chat-input" placeholder="Ask about your business…" autocomplete="off"><button class="send" id="chat-send">'+icon("send")+'</button></div>'
      + '<div class="disclaimer-mini">Assistant answers reflect recorded data. It does not give legal or financial advice.</div>';
    root.innerHTML = '<div class="assistant-screen">'+head+msgs+chipRow+composer+'</div>' + tabbar("assistant");
    bindTabs();
    var input=document.getElementById("chat-input"), sendBtn=document.getElementById("chat-send");
    sendBtn.onclick=function(){ var v=(input.value||"").trim(); if(v){ input.value=""; sendUser(v); } };
    input.onkeydown=function(e){ if(e.key==="Enter"){ var v=(input.value||"").trim(); if(v){ input.value=""; sendUser(v); } } };
    root.querySelectorAll("[data-chip]").forEach(function(b){ b.onclick=function(){ sendUser(b.getAttribute("data-chip")); }; });
    scrollChat();
    setTimeout(function(){ if(input) input.focus(); },50);
  }
  function bubble(m){
    if(m.who==="user") return '<div class="msg user">'+esc(m.text)+'</div>';
    return '<div class="msg bot">'+m.html+'</div>';
  }
  function scrollChat(){ var s=document.getElementById("chat-scroll"); if(s) s.scrollTop=s.scrollHeight; }
  function sendUser(text){
    if((location.hash||"").indexOf("assistant")<0){ location.hash="#/assistant"; setTimeout(function(){ sendUser(text); },260); return; }
    chat.push({who:"user", text:text});
    var scroll=document.getElementById("chat-scroll");
    if(scroll){ scroll.insertAdjacentHTML("beforeend", bubble({who:"user",text:text}));
      var typing=document.createElement("div"); typing.className="typing"; typing.id="typing"; typing.innerHTML="<span></span><span></span><span></span>"; scroll.appendChild(typing); scrollChat();
    }
    var ans = answer(text);
    setTimeout(function(){
      var t=document.getElementById("typing"); if(t) t.remove();
      chat.push({who:"bot", html:ans});
      var s2=document.getElementById("chat-scroll"); if(s2){ s2.insertAdjacentHTML("beforeend", bubble({who:"bot",html:ans})); scrollChat(); }
    }, 650 + Math.min(700, ans.length*3));
  }

  /* ---- the grounded responder ---- */
  function answer(q){
    var f=facts(); var t=q.toLowerCase();
    function listLi(rows){ return '<ul class="m-list">'+rows.map(function(r){return '<li><span>'+esc(r[0])+'</span><b>'+r[1]+'</b></li>';}).join("")+'</ul>'; }
    function has(){ for(var i=0;i<arguments.length;i++){ if(t.indexOf(arguments[i])>-1) return true; } return false; }

    if(has("hello","hi ","hey","good morning","good afternoon")) return "Hello! I'm here to help with anything about <b>"+esc(client.company)+"</b>. Try asking what needs your approval, what's overdue, or how your funding is looking.";
    if(has("thank")) return "You're welcome. Anything else you'd like to check?";

    if(has("approv","attention","waiting","need me","need my","sign off","sign-off","to do","what should i")){
      if(!f.pending.length) return "Nothing is waiting on you right now — you're all caught up. 🎉";
      return "You have <b>"+f.pending.length+"</b> item"+(f.pending.length===1?"":"s")+" waiting for your decision:" + listLi(f.pending.map(function(a){ return [a.title, a.escalated?"Escalated":"Due "+fmtDate(a.due)]; })) + "Open the <b>Home</b> tab and tap one to approve it in seconds.";
    }
    if(has("overdue","late","missed","behind")){
      if(!f.overdue.length) return "Good news — <b>nothing is overdue</b>. Everything recorded is within its due date.";
      var tot=f.overdue.reduce(function(a,l){return a+(l.amount-l.funded);},0);
      return "You have <b>"+f.overdue.length+"</b> overdue item"+(f.overdue.length===1?"":"s")+", totalling <b>"+gbp(tot)+"</b>:" + listLi(f.overdue.map(function(l){return [l.name, gbp(l.amount)];})) + "I'd prioritise these — tap one on the <b>Liabilities</b> tab to see what's needed.";
    }
    if(has("hmrc","vat","paye","nic","corporation","tax")){
      var hmrcTot=f.hmrc.reduce(function(a,l){return a+l.amount;},0);
      var specific = has("vat")?f.hmrc.filter(function(l){return l.category==="VAT";}):has("paye","nic")?f.hmrc.filter(function(l){return l.category==="PAYE & NIC";}):null;
      if(specific && specific.length){ var l=specific[0]; return "Your <b>"+esc(l.category)+"</b> is <b>"+gbp(l.amount)+"</b>, due "+fmtDate(l.due)+" — currently <b>"+ (STATUS_PILL[l.status]||["",l.status])[1] +"</b>"+(l.funded>0?" ("+gbp(l.funded)+" already reserved)":"")+"."; }
      return "Across HMRC (VAT, PAYE, NIC & Corporation Tax) you have <b>"+gbp(hmrcTot)+"</b> recorded:" + listLi(f.hmrc.map(function(l){return [l.category+" · due "+fmtDate(l.due), gbp(l.amount)];}));
    }
    if(has("funding","gap","shortfall","afford","cover","cash","fund")){
      return "Here's your funding position:" + listLi([["Currently funded", biz.allocatedPct+"%"],["Funds allocated", gbp(biz.allocated)],["Paid or reserved", gbp(biz.paidReserved)],["Still to fund", gbp(biz.fundingGap)]]) + (biz.fundingGap>0?"You've <b>"+gbp(biz.fundingGap)+"</b> left to fund before upcoming due dates. Want me to show which liabilities that covers?":"You're fully funded against recorded liabilities. 👍");
    }
    if(has("next payment","upcoming","what's due","whats due","when","due next","coming up","this week")){
      if(!f.upcoming.length) return "Nothing outstanding is coming up — everything's funded.";
      return "Your next payments (soonest first):" + listLi(f.upcoming.slice(0,4).map(function(l){return [l.name+" · "+fmtDate(l.due), gbp(l.amount-l.funded)];}));
    }
    if(has("wage","staff","payroll","people","salar")){
      var w=biz.liabilities.filter(function(l){return l.domain==="People";});
      if(!w.length) return "No staff/payroll liabilities are recorded this period.";
      return "Your people costs:" + listLi(w.map(function(l){return [l.name+" · "+ (STATUS_PILL[l.status]||["",l.status])[1], gbp(l.amount)];}));
    }
    if(has("supplier","supply","purchase","trade")){
      var sup=biz.liabilities.filter(function(l){return l.domain==="Supply";});
      return "Your supply & trade liabilities:" + listLi(sup.map(function(l){return [l.name+" · due "+fmtDate(l.due), gbp(l.amount)];}));
    }
    if(has("how is","how's","how am","doing","status","health","overall","summary","position","where do i stand","how are we")){
      return statusSentence(f) + listLi([["Total recorded", gbp(biz.totalLiabilities)],["Overdue", gbp(biz.overdue)],["Still to fund", gbp(biz.fundingGap)],["Waiting on you", f.pending.length+" item"+(f.pending.length===1?"":"s")]]);
    }
    if(has("evidence","audit","proof","document","receipt","record")){
      return "Every liability keeps its <b>evidence</b> (the HMRC notice, funding approval, bank reference and reconciliation note) and a full <b>audit history</b> — who did what, and when. Open any liability and scroll to <b>Evidence</b> and <b>History</b>.";
    }
    if(has("lifecycle","stage","reconcile","process","how does","step")){
      return "Each liability moves through five stages: <b>Recorded → Approved → Funded → Paid → Reconciled</b>. You can see exactly where each one is on its progress bar. Recording or approving something doesn't pay it — it just moves it forward in the process.";
    }
    if(has("help","support","human","agent","call","speak","phone","talk to someone","real person")){
      return "Of course — our team is available <b>24/7</b>. Head to the <b>Support</b> tab to start a live chat, request a callback, or send a message. Want me to take you there?";
    }
    if(has("what can you","what do you do","help me with","options")){
      return "I can tell you, from your live data: what's <b>overdue</b>, what needs your <b>approval</b>, how much you owe <b>HMRC</b>, your <b>funding gap</b>, your <b>next payments</b>, and how your business is <b>doing overall</b>. What would you like to see?";
    }
    // fallback
    return "I can answer that best from your live figures. Try one of these — <b>what needs my approval</b>, <b>what's overdue</b>, <b>how much do I owe HMRC</b>, <b>what's my funding gap</b>, or <b>when's my next payment</b>. For anything else, the <b>Support</b> tab connects you to a person 24/7.";
  }

  /* ================= SUPPORT (24/7) ================= */
  function renderSupport(){
    var s = topbar("Support", "We're here around the clock");
    var out='<div class="screen active">';
    out += '<div class="support-cta"><h3><span class="live-dot"></span>24/7 support</h3><p style="margin:6px 0 0;color:var(--ink-soft);font-size:.9rem">Real people, any time. Average reply under 5 minutes.</p></div>';

    out += '<div class="section-label">Get in touch</div>';
    out += '<div class="card"><button class="support-tile" id="sp-chat" style="border:none;background:none;padding:11px 0;border-bottom:1px solid var(--line);width:100%">'
      + '<span class="st-ic">'+icon("spark")+'</span><span class="st-main"><span class="st-name">Ask the AI assistant</span><span class="st-sub">Instant answers from your live data</span></span><span class="chev" style="color:var(--ink-faint)">'+icon("chevron")+'</span></button>'
      + '<div class="support-tile" style="padding:11px 0;border-bottom:1px solid var(--line)"><span class="st-ic">'+icon("chat")+'</span><span class="st-main"><span class="st-name">Live chat with an agent</span><span class="st-sub">Online now</span></span><span class="pill ok">Online</span></div>'
      + '<div class="support-tile" style="padding:11px 0;border-bottom:1px solid var(--line)"><span class="st-ic">'+icon("phone")+'</span><span class="st-main"><span class="st-name">Request a callback</span><span class="st-sub">We\'ll call you back within the hour</span></span></div>'
      + '<div class="support-tile" style="padding:11px 0"><span class="st-ic">'+icon("mail")+'</span><span class="st-main"><span class="st-name">Email your team</span><span class="st-sub">support@tradeshielduk.org</span></span></div></div>';

    // agent enquiry form
    out += '<div class="section-label">Send a message to an agent</div>';
    out += '<div class="card"><div class="field-lite"><label style="font-size:.82rem;font-weight:600;color:var(--ink-soft);display:block;margin-bottom:6px">Your name</label><input id="sp-name" value="'+esc(client.director)+'" style="width:100%;padding:12px;border-radius:11px;background:var(--panel-2);border:1px solid var(--line);color:var(--ink);font-family:inherit"></div>'
      + '<div style="margin-top:12px"><label style="font-size:.82rem;font-weight:600;color:var(--ink-soft);display:block;margin-bottom:6px">Topic</label><select id="sp-topic" style="width:100%;padding:12px;border-radius:11px;background:var(--panel-2);border:1px solid var(--line);color:var(--ink);font-family:inherit"><option>A payment or due date</option><option>My funding position</option><option>An approval or action</option><option>Evidence or a document</option><option>Something else</option></select></div>'
      + '<div style="margin-top:12px"><label style="font-size:.82rem;font-weight:600;color:var(--ink-soft);display:block;margin-bottom:6px">Message</label><textarea id="sp-msg" placeholder="How can we help?" style="width:100%;min-height:90px;padding:12px;border-radius:11px;background:var(--panel-2);border:1px solid var(--line);color:var(--ink);font-family:inherit;resize:vertical"></textarea></div>'
      + '<button class="btn btn-primary btn-block" style="margin-top:14px" id="sp-send">Send to a support agent</button>'
      + '<div class="muted" style="font-size:.74rem;text-align:center;margin-top:8px">A member of your TradeShield team will reply here and by email.</div></div>';

    // FAQ
    out += '<div class="section-label">Quick answers</div><div class="faq">'
      + faq("What does TradeShield actually do for my business?","We give you one live, controlled view of your operating liabilities — VAT, PAYE, NIC, wages, suppliers and more — so you always know what's due, what's funded and what needs a decision, before a deadline becomes a problem.")
      + faq("Does recording a liability here pay it?","No. Recording, approving or funding a liability in the app tracks and prepares it — it doesn't itself pay, settle or discharge the amount. Payment is a separate, confirmed step.")
      + faq("Who can see my information?","Access is role-based. You see your full position; other users only see what their role allows. Everything is time-stamped and exportable.")
      + faq("Can I get everything as a report?","Yes — Board report, liability export, funding report and evidence pack are all available for your records or your accountant.")
      + '</div>';
    out += '</div>';
    setTimeout(function(){
      bindTop();
      var c=document.getElementById("sp-chat"); if(c) c.onclick=function(){ location.hash="#/assistant"; };
      var sd=document.getElementById("sp-send"); if(sd) sd.onclick=function(){ var m=(document.getElementById("sp-msg").value||"").trim(); if(!m){ toast("Add a short message first"); return; } document.getElementById("sp-msg").value=""; toast("Message sent — an agent will reply shortly"); };
    },0);
    return s+out;
  }
  function faq(q,a){ return '<details><summary>'+esc(q)+'<span class="fq-ic">'+icon("plus")+'</span></summary><p>'+esc(a)+'</p></details>'; }

  /* ================= ACCOUNT ================= */
  function renderAccount(){
    var s=topbar("Account", client.company);
    var out='<div class="screen active">';
    out += '<div class="card" style="text-align:center"><div class="avatar" style="width:72px;height:72px;border-radius:22px;font-size:1.5rem;margin:6px auto 12px">'+esc(client.initials)+'</div><h2 style="margin:0">'+esc(client.director)+'</h2><div class="muted">'+esc(client.email)+'</div><span class="pill teal" style="margin-top:12px">'+esc(client.role)+'</span></div>';
    out += '<div class="section-label">Your business</div><div class="card">'
      + '<div class="flex-between" style="padding:6px 0"><span class="muted">Company</span><b>'+esc(client.company)+'</b></div>'
      + '<div class="flex-between" style="padding:6px 0"><span class="muted">Sector</span><b>'+esc(biz.sector)+'</b></div>'
      + '<div class="flex-between" style="padding:6px 0"><span class="muted">Protection plan</span><b>'+esc(client.plan)+'</b></div>'
      + '<div class="flex-between" style="padding:6px 0"><span class="muted">Accounting</span><b>'+(biz.accounting.status==="connected"?esc(biz.accounting.provider)+" · synced":"Not connected")+'</b></div></div>';
    out += '<div class="section-label">Good to know</div><div class="card">'
      + boundary("No automatic discharge","Recording or approving a liability here does not itself pay or settle it.")
      + boundary("Your judgement still matters","The app supports your decisions and duties — it doesn't replace professional advice.")
      + boundary("Your data is yours","Records and reports can be exported at any time.")
      + '</div>';
    out += '<button class="btn btn-ghost btn-block" style="margin-top:16px" id="acc-support">'+icon("life").replace('stroke-width="2"','stroke-width="2" style="width:16px;height:16px"')+' Contact support</button>';
    out += '<button class="btn btn-danger btn-block" style="margin-top:10px" id="logout">'+icon("logout").replace('stroke-width="2"','stroke-width="2" style="width:16px;height:16px"')+' Sign out</button>';
    out += '<div class="muted" style="text-align:center;font-size:.72rem;margin-top:14px">TradeShield · Live Liability Control · tradeshielduk.org</div></div>';
    setTimeout(function(){
      bindTop();
      var su=document.getElementById("acc-support"); if(su) su.onclick=function(){ location.hash="#/support"; };
      var lo=document.getElementById("logout"); if(lo) lo.onclick=function(){ ui.loggedIn=false; sset("tsc.loggedIn","0"); location.hash=""; renderLogin(); };
    },0);
    return s+out;
  }
  function boundary(title,desc){ return '<div style="display:flex;gap:11px;padding:10px 0;border-bottom:1px solid var(--line)"><span style="color:var(--teal);flex:none;margin-top:1px">'+icon("shield").replace('stroke-width="2"','stroke-width="2" style="width:18px;height:18px"')+'</span><div><div style="font-weight:600;color:#fff;font-size:.86rem">'+title+'</div><div class="muted" style="font-size:.78rem">'+desc+'</div></div></div>'; }

  /* ================= sheet ================= */
  function openSheet(html){ var b=document.getElementById("sheet"); if(!b){ b=document.createElement("div"); b.id="sheet"; b.className="sheet-backdrop"; b.innerHTML='<div class="sheet"></div>'; document.body.appendChild(b); b.onclick=function(e){ if(e.target===b) closeSheet(); }; } b.querySelector(".sheet").innerHTML=html; requestAnimationFrame(function(){ b.classList.add("show"); }); }
  function closeSheet(){ var b=document.getElementById("sheet"); if(b) b.classList.remove("show"); }

  /* ================= boot ================= */
  window.addEventListener("hashchange", router);
  router();
})();
