# TradeShield — Live Liability Control

A self-contained web app that tracks business expenses / liabilities and shows how
TradeShield is fighting your creditors on your behalf. Built to match the
TradeShield brand (`tradeshielduk.org`).

It has two parts:

| File | What it is |
|------|------------|
| `index.html` | Marketing landing page + the **enquiry form** (contact details, turnover, staff, HMRC liabilities, purchases). |
| `dashboard.html` | The working **liability / expense dashboard** — KPIs, liability register (add / edit / delete), funding position, upcoming payment profile, and a live "creditor actions" log. |

## Running it

No build step and no backend. Just open `index.html` in a browser, **or** serve the
folder so links/assets resolve cleanly:

```bash
cd web
python -m http.server 8000
# then visit http://localhost:8000
```

## How it behaves

- **Enquiry form** (`index.html`): validates all fields, then shows a confirmation
  with a summary of what was submitted. Submissions are stored in the browser
  (`localStorage` key `tradeshield.enquiries`). To wire it to a real backend, replace
  `persistEnquiry()` in `assets/form.js` with a `fetch()` POST.
- **Dashboard** (`dashboard.html`): liabilities and creditor actions are seeded from
  the example data shown in the TradeShield product screens, then persisted to
  `localStorage` (`tradeshield.liabilities.v1`, `tradeshield.actions.v1`). Add, edit
  and delete liabilities via **+ Add liability**; KPIs, the funding donut and the
  payment-profile chart all recompute live. **Export board report** downloads a CSV.

To reset to the seeded demo data, clear the site's local storage in your browser.

## Fields on the enquiry form

- **Contact details** — full name, company name, email, telephone (all required).
- **Annual turnover** — 7 bands from *Under £500,000* to *Over £25 million*.
- **Number of staff** — 7 bands from *1–5* to *Over 250*.
- **Annual HMRC liabilities** (VAT, PAYE, NIC, Corporation Tax) — 7 bands from
  *Under £100,000* to *Over £5 million*.
- **Annual purchases and supplier costs** — 7 bands from *Under £250,000* to
  *Over £10 million*.

All monetary figures are requested as **estimates only**, so the form stays quick to
complete.

## Files

```
web/
├── index.html            # landing + enquiry form
├── dashboard.html        # liability / expense dashboard
├── assets/
│   ├── styles.css        # shared design system (brand colours, components)
│   ├── dashboard.css     # dashboard-specific styles
│   ├── form.js           # enquiry form validation + capture
│   └── app.js            # dashboard logic (state, render, CRUD, chart, export)
└── README.md
```

> The interface is illustrative and uses example data.
