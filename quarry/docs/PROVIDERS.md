# Data providers

Source of truth for limits and licences is `config/providers.yaml`; this file records
coverage notes and **verification status**. Nothing below has been verified against
vendor documentation yet. Each provider is checked when its adapter is built (Phase 1.1
for the first batch), and the date goes in `last_verified` in the YAML.

| Provider | Phase | Cost | Limits (unverified) | Latency | Licence | Verified |
|---|---|---|---|---|---|---|
| Finnhub | 1 | Free | 60/min, 50 WS symbols | Real-time (US) | Personal use | — |
| Alpaca Basic | 1 | Free | 200/min, 30 WS symbols | Real-time **IEX venue only**; SIP 15-min delayed | Personal | — |
| Twelve Data Basic | 1 | Free | 8/min, 800/day | EOD/delayed | Personal | — LSE coverage to verify |
| FMP Basic | 1 | Free | 250/day | EOD | Personal | — |
| EODHD free | 1 | Free | 20/day | EOD (incl. LSE) | Personal | — |
| OpenFIGI | 1 | Free | 25/min without key | Reference | Open | — |
| Official RSS | 1 | Free | Polite polling | Real-time headlines | Headline + link | — |
| FRED | 2 | Free | ~120/min (observed, soft) | Daily | Attribution required | — |
| Bank of England, ECB, ONS, BLS, US Treasury | 2 | Free | — | Daily/official | Public | — |
| CoinGecko Demo | 2 | Free | 100/min, 10k/month | Indicative | Attribution required | — |
| Binance / Coinbase public WS | 2 | Free | — | Real-time | Personal | — |
| OANDA v20 practice | 2 | Free | 4 prices/s/instrument | Indicative | Personal | — UK sub-account |
| SEC EDGAR | 3 | Free | 10 req/s + User-Agent | — | Public | — |
| Companies House | 3 | Free | 600 / 5 min | — | Public | — |
| Interactive Brokers | Paid, off | ~$10 US + £5 LSE L1 non-pro | — | Real-time | Personal | — Needs account |
| Alpaca Algo Trader Plus | Paid, off | $99/mo | 10,000/min | Real-time SIP + OPRA | Personal | — |
| EODHD All-In-One | Paid, off | $99.99/mo | 100k/day | Delayed/EOD global | Personal | — |

## Discrepancies log

| Date | Provider | Prompt said | Docs say | Action |
|---|---|---|---|---|
| 2026-10-18 | dockview (library, not data) | `dockview` package for React | v8 moved React to `dockview-react` | Switched package |
