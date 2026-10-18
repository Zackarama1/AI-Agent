# Open questions

| # | Question | Safest default taken | Owner |
|---|---|---|---|
| 1 | Should QUARRY move to its own GitHub repo? | Lives in `quarry/` in this repo; can move with history later | Zack |
| 2 | Where will the server run (VPS or home machine)? | Docs cover both; Tailscale for iPad access | Zack |
| 3 | Which free API keys are available? | All providers start "unconfigured" | Zack |
| 4 | First 20 watchlist tickers | Phase 1 seeds a sample mixed US/LSE list | Zack |
| 5 | IBKR account for real-time UK prices? | None yet; UK shown delayed/EOD with badges | Zack |
| 6 | Contact email for the SEC User-Agent | Placeholder; required before Phase 3 | Zack |
| 7 | Does Twelve Data Basic include LSE? | Verify first thing in Phase 1; fall back to EODHD EOD | Claude |
| 8 | Pin the TimescaleDB image to an exact version | `latest-pg16` until Phase 1 adds hypertables | Claude |
| 9 | Project licence (currently none = all rights reserved) | Proprietary/private | Zack |
| 10 | Market holiday calendars for open/closed badges | Weekday hours only in Phase 0 | Claude (P1) |
