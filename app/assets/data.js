/* ==========================================================================
   TradeShield — PTC Client App · demo data (aligned to the Client Guide)
   Model: an adviser/PTC operator oversees client companies. Each company has a
   register of recorded operating liabilities that move through the lifecycle
   Recorded → Approved → Funded → Paid → Reconciled, plus named actions.
   In production this comes from your backend + Xero/QuickBooks sync.
   ========================================================================== */
window.TS_SEED = {
  account: {
    firm: "Meridian Advisory",
    user: "Kevin Morris",
    initials: "KM",
    role: "Client Director",
    plan: "Professional",
    email: "kevin@meridianadvisory.co.uk"
  },

  /* liability lifecycle — the operational pipeline (Client Guide p.6) */
  stages: [
    { key: "recorded",   name: "Recorded",   color: "#56a8ff", desc: "Liability & evidence entered" },
    { key: "approved",   name: "Approved",   color: "#8a7bff", desc: "Amount & due date confirmed" },
    { key: "funded",     name: "Funded",     color: "#29c2d8", desc: "Client allocation received" },
    { key: "paid",       name: "Paid",       color: "#3b82f6", desc: "Payment reference attached" },
    { key: "reconciled", name: "Reconciled", color: "#35d29a", desc: "Record closed / carried forward" }
  ],

  /* the six control domains (Client Guide p.3) */
  domains: [
    { key: "HMRC",    name: "HMRC",    desc: "VAT, PAYE, NIC & Corporation Tax",     color: "#3b82f6" },
    { key: "People",  name: "People",  desc: "Staff wages, benefits & employment",   color: "#35d29a" },
    { key: "Supply",  name: "Supply",  desc: "Suppliers, trade creditors, purchases",color: "#f0b64a" },
    { key: "Risk",    name: "Risk",    desc: "Insurance, professional fees & cover",  color: "#8a7bff" }
  ],

  /* named action types (Client Guide p.7) */
  actionTypes: {
    approval: { label: "Approval", color: "#ff6b5e" },
    document: { label: "Document", color: "#f0b64a" },
    decision: { label: "Decision", color: "#29c2d8" },
    review:   { label: "Review",   color: "#8a7bff" }
  },

  /* the TradeShield team working on the client's behalf */
  team: [
    { name: "Sarah Ellis",  role: "Liability Specialist", initials: "SE", color: "#29c2d8" },
    { name: "David Osei",   role: "Funding Lead",         initials: "DO", color: "#3b82f6" },
    { name: "Priya Nair",   role: "Caseworker",           initials: "PN", color: "#8a7bff" },
    { name: "Tom Blake",    role: "Client Operations",    initials: "TB", color: "#35d29a" }
  ],

  companies: [
    {
      id: "c1", name: "Northgate Fabrication Ltd", sector: "Manufacturing",
      logoColor: "linear-gradient(135deg,#3b82f6,#1e40af)", risk: "high", obligor: "MTC",
      // headline figures mirror the Client Guide dashboard exactly
      totalLiabilities: 765240, next7: 54540, overdue: 20500, fundingGap: 250240,
      allocatedPct: 67, allocated: 515000, paidReserved: 220000,
      accounting: { provider: "Xero", status: "connected", lastSync: "2 min ago", entity: "Northgate Fabrication Ltd" },
      liabilities: [
        { id:"l1", name:"Trade finance facility", domain:"Supply", category:"Trade finance", obligor:"MTC", period:"Aug 2026",
          due:"2026-08-31", amount:400000, funded:0, stage:"recorded", status:"soon",
          evidence:[{type:"PDF",label:"Facility statement"}],
          audit:[{t:"2026-08-01 09:14",who:"Finance user",title:"Record created",desc:"£400,000 facility maturing 31 Aug."}] },
        { id:"l2", name:"PAYE & National Insurance", domain:"HMRC", category:"PAYE & NIC", obligor:"MTC", period:"Aug 2026",
          due:"2026-08-22", amount:100200, funded:40000, stage:"funded", status:"part",
          evidence:[{type:"PDF",label:"HMRC PAYE notice"},{type:"APP",label:"Funding approval"}],
          audit:[
            {t:"2026-08-02 10:02",who:"PTC operations",title:"Evidence uploaded",desc:"HMRC PAYE notice attached."},
            {t:"2026-08-05 11:27",who:"Client director",title:"Amount approved",desc:"£100,200 approved."},
            {t:"2026-08-06 14:45",who:"Finance user",title:"Part funding allocated",desc:"£40,000 allocated on account."} ] },
        { id:"l3", name:"VAT return Q2", domain:"HMRC", category:"VAT", obligor:"MTC", period:"Q2 2026",
          due:"2026-08-07", amount:54540, funded:0, stage:"approved", status:"due",
          evidence:[{type:"PDF",label:"HMRC VAT notice"}],
          audit:[
            {t:"2026-07-28 09:14",who:"Finance user",title:"Record created",desc:"VAT liability £54,540 from Xero sync."},
            {t:"2026-08-02 10:20",who:"PTC operations",title:"Evidence uploaded",desc:"HMRC VAT notice attached."},
            {t:"2026-08-04 11:05",who:"Client director",title:"Amount approved",desc:"Awaiting funding request approval."} ] },
        { id:"l4", name:"Staff wages — August", domain:"People", category:"Staff wages", obligor:"MTC", period:"Aug 2026",
          due:"2026-08-28", amount:170000, funded:170000, stage:"funded", status:"funded",
          evidence:[{type:"APP",label:"Payroll approval"}],
          audit:[
            {t:"2026-08-03 09:30",who:"Finance user",title:"Record created",desc:"August payroll recorded."},
            {t:"2026-08-08 15:10",who:"Finance user",title:"Funding allocated",desc:"£170,000 reserved for payroll."} ] },
        { id:"l5", name:"Professional fees", domain:"Risk", category:"Professional fees", obligor:"MTC", period:"Jul 2026",
          due:"2026-07-31", amount:20500, funded:0, stage:"recorded", status:"overdue",
          evidence:[],
          audit:[{t:"2026-08-06 08:50",who:"PTC operations",title:"Record created",desc:"£20,500 overdue — supporting invoice required."}] },
        { id:"l6", name:"Trade suppliers", domain:"Supply", category:"Suppliers", obligor:"MTC", period:"Aug 2026",
          due:"2026-08-31", amount:20000, funded:0, stage:"recorded", status:"soon",
          evidence:[],
          audit:[{t:"2026-08-04 12:00",who:"Finance user",title:"Record created",desc:"Supplier balance ageing — early flag."}] }
      ],
      actions: [
        { id:"a1", type:"approval", title:"Approve the VAT funding request", ref:"VAT return Q2", refId:"l3", due:"2026-08-07", priority:"high" },
        { id:"a2", type:"document", title:"Upload the supporting supplier invoice", ref:"Trade suppliers", refId:"l6", due:"2026-08-16", priority:"medium" },
        { id:"a3", type:"decision", title:"Confirm the proposed finance repayment", ref:"Trade finance facility", refId:"l1", due:"2026-08-24", priority:"high" },
        { id:"a4", type:"review",   title:"Resolve the overdue professional fee", ref:"Professional fees", refId:"l5", due:"2026-08-01", priority:"high", escalated:true }
      ],
      // what the TradeShield team is doing for this client — status updates
      teamUpdates: [
        { id:"u1", type:"arrangement", status:"done", by:0, date:"2026-08-14",
          title:"Time to Pay arrangement secured with HMRC", related:"VAT · £54,540",
          desc:"We negotiated a 12-month instalment plan on your VAT liability. No enforcement action will be taken while the arrangement is maintained.",
          next:"First instalment scheduled for 7 Sep — we'll remind you." },
        { id:"u2", type:"negotiation", status:"progress", by:1, date:"2026-08-12",
          title:"Restructuring your trade finance facility", related:"Trade finance · £400,000",
          desc:"We've put a proposal to Alliance Trade Finance to spread your £400,000 facility over 18 months and ease the maturity pressure.",
          next:"Awaiting their counter-signature by 24 Aug — we're chasing." },
        { id:"u3", type:"escalation", status:"progress", by:2, date:"2026-08-09",
          title:"Disputed professional fee — recovery paused", related:"Professional fees · £20,500",
          desc:"We've formally queried part of this fee and asked the creditor to hold recovery while it's reviewed, protecting you from further pressure.",
          next:"Chasing the supporting breakdown from the supplier." },
        { id:"u4", type:"payment", status:"done", by:0, date:"2026-08-06",
          title:"PAYE part-payment agreed with HMRC", related:"PAYE & NIC · £100,200",
          desc:"We arranged for £40,000 to be accepted on account and rescheduled the balance to line up with your payroll cycle.",
          next:"Balance tracked against 22 Aug." },
        { id:"u5", type:"review", status:"progress", by:3, date:"2026-08-05",
          title:"Protecting your supply line", related:"Trade suppliers · £20,000",
          desc:"We issued a holding statement to your components supplier to keep supply running while funding is arranged — avoiding a stop-supply.",
          next:"Monitoring the account weekly." },
        { id:"u6", type:"awaiting", status:"awaiting", by:0, date:"2026-08-07", actionId:"a1",
          title:"We need your approval to release VAT funding", related:"VAT · £54,540",
          desc:"Everything's in place to action your agreed VAT payment — we just need you to approve the funding release.",
          next:"Tap to approve — takes a few seconds." },
        { id:"u7", type:"filing", status:"done", by:3, date:"2026-08-11",
          title:"Weekly position review completed", related:"Whole business",
          desc:"We reconciled this week's activity, refreshed your funding plan and updated the status of every liability so your dashboard is current.",
          next:"Next review 18 Aug." },
        { id:"u8", type:"report", status:"scheduled", by:1, date:"2026-08-31",
          title:"Month-end board report", related:"Whole business",
          desc:"We'll prepare your board report covering position, exceptions and next actions, ready for your records or your accountant.",
          next:"Delivered by 31 Aug." }
      ]
    },
    {
      id: "c2", name: "Harbour Logistics Group", sector: "Transport & Storage",
      logoColor: "linear-gradient(135deg,#29c2d8,#1c93a6)", risk: "medium", obligor:"MTC",
      totalLiabilities: 412300, next7: 18000, overdue: 0, fundingGap: 78400,
      allocatedPct: 81, allocated: 333900, paidReserved: 234000,
      accounting: { provider: "QuickBooks", status: "connected", lastSync: "18 min ago", entity: "Harbour Logistics Group Ltd" },
      liabilities: [
        { id:"h_l1", name:"VAT return Q2", domain:"HMRC", category:"VAT", obligor:"MTC", period:"Q2 2026",
          due:"2026-08-07", amount:88300, funded:88300, stage:"paid", status:"funded",
          evidence:[{type:"PDF",label:"HMRC VAT notice"},{type:"REF",label:"Bank payment"}],
          audit:[{t:"2026-08-07 14:00",who:"PTC operations",title:"Payment recorded",desc:"VAT paid — reference attached."}] },
        { id:"h_l2", name:"Fleet finance", domain:"Supply", category:"Trade finance", obligor:"MTC", period:"Sep 2026",
          due:"2026-09-15", amount:210000, funded:150000, stage:"funded", status:"part",
          evidence:[{type:"APP",label:"Restructure approval"}],
          audit:[{t:"2026-08-10 11:00",who:"Client director",title:"Restructure approved",desc:"Revised schedule confirmed."}] },
        { id:"h_l3", name:"Staff wages", domain:"People", category:"Staff wages", obligor:"MTC", period:"Aug 2026",
          due:"2026-08-28", amount:96000, funded:96000, stage:"funded", status:"funded", evidence:[], audit:[] },
        { id:"h_l4", name:"Insurance renewal", domain:"Risk", category:"Insurance", obligor:"MTC", period:"Sep 2026",
          due:"2026-09-01", amount:18000, funded:0, stage:"approved", status:"soon", evidence:[{type:"PDF",label:"Renewal schedule"}], audit:[] }
      ],
      actions: [
        { id:"h_a1", type:"decision", title:"Confirm insurer instalment plan", ref:"Insurance renewal", refId:"h_l4", due:"2026-08-25", priority:"low" },
        { id:"h_a2", type:"review", title:"Review fleet finance schedule", ref:"Fleet finance", refId:"h_l2", due:"2026-08-30", priority:"medium" }
      ]
    },
    {
      id: "c3", name: "Bright Interiors Ltd", sector: "Construction & Fit-out",
      logoColor: "linear-gradient(135deg,#d8b866,#b8963f)", risk: "low", obligor:"MTC",
      totalLiabilities: 198500, next7: 0, overdue: 0, fundingGap: 0,
      allocatedPct: 100, allocated: 198500, paidReserved: 198500,
      accounting: { provider: null, status: "disconnected", lastSync: null, entity: null },
      liabilities: [
        { id:"b_l1", name:"VAT return Q2", domain:"HMRC", category:"VAT", obligor:"MTC", period:"Q2 2026",
          due:"2026-08-07", amount:31500, funded:31500, stage:"reconciled", status:"funded", evidence:[{type:"CLO",label:"Reconciliation note"}], audit:[] },
        { id:"b_l2", name:"PAYE & NIC", domain:"HMRC", category:"PAYE & NIC", obligor:"MTC", period:"Aug 2026",
          due:"2026-08-22", amount:42000, funded:42000, stage:"paid", status:"funded", evidence:[], audit:[] },
        { id:"b_l3", name:"Supplier — timber", domain:"Supply", category:"Suppliers", obligor:"MTC", period:"Aug 2026",
          due:"2026-08-30", amount:25000, funded:25000, stage:"funded", status:"funded", evidence:[], audit:[] }
      ],
      actions: []
    }
  ]
};
