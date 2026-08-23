# Ledger — Expense Tracker

An easy-to-use platform to track all your spending, so you can see **exactly
where your money goes** and know your **incoming vs outgoing** at a glance.

It's a single self-contained web page — **no install, no account, no API keys,
no internet required**. Your data is stored privately in your own browser.

## How to use it

1. Open `index.html` in any web browser (double-click the file, or drag it into
   a browser tab).
2. Add a transaction:
   - Pick **Expense** or **Income**
   - Enter the amount, date, and a category (e.g. Groceries, Rent, Salary)
   - Optionally add a description
3. Watch the totals update instantly.

That's it — it "just works" and remembers everything the next time you open it.

## What you get

- **Incoming / Outgoing / Balance** cards at the top — your money in vs out.
- **"Where your money goes"** — a breakdown bar chart of your spending by
  category, showing what each category costs and its share of the total.
- **Transaction list** — filter by month or by income/expense, delete anything
  you added by mistake.
- **Multiple currencies** — £, $, €, ₹, ¥ (switch in the top-right).
- **Export / Import CSV** — back up your data, move it to another device, or
  open it in Excel / Google Sheets.

## Where is my data?

Everything lives in your browser's local storage on this device only — nothing
is ever uploaded anywhere. To keep a backup or move between devices, use the
**Export CSV** button, then **Import CSV** on the other device.

> Note: because data is per-browser, clearing your browser data will remove it.
> Export a CSV occasionally if the data matters to you.

## Files

```
expense-tracker/
└── index.html   # The entire app — HTML, styling, and logic in one file
```
