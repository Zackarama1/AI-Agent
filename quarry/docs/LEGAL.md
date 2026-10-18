# Legal and licensing notes

Not legal advice. This file records what QUARRY does to stay inside its licences.

## Name and brand
- "QUARRY" is a placeholder original name. **Run UK IPO and USPTO trademark searches
  before any public or commercial use.**
- Own visual identity: near-black ground, own amber (#F5A524), JetBrains Mono and
  IBM Plex Sans Condensed (both SIL OFL, self-hosted). No third-party logos or trade dress.
  The word "Bloomberg" must not appear in code, UI, assets or package names.

## Mode
`MODE=personal` (default). Almost every free/cheap data tier is licensed for personal,
non-commercial use only. Showing data to clients, investors or RIA prospects needs new
licences, professional-user exchange fees and a compliance review. `professional` mode
(Phase 8) will block personal-only providers and enable an audit log.

## Enforcement in code
- Every record carries `LicenceFlags` (personal_only, display_allowed,
  redistribution_allowed, attribution_text). `LicenceFlags.exportable` backs the export guard.
- Server binds to 127.0.0.1; remote access is private (Tailscale), never public.
- Attribution texts are kept in `config/providers.yaml` and shown on STAT; they must also
  appear next to the data in later phases (FRED, CoinGecko).

## Third-party software
All dependencies are MIT, BSD, Apache-2.0, ISC or the PostgreSQL licence, except:
- `hypothesis` (MPL-2.0): test-only, never distributed.
- TimescaleDB (Timescale License for some features): see ADR-0003.
- TradingView Lightweight Charts (Apache-2.0 with an attribution NOTICE): add the notice
  when charts arrive in Phase 1.
- AG Grid: Community edition only (MIT) when added in Phase 1.

## UK RNS
LSE RNS redistribution needs a licence. The RNS provider stays disabled (`rns_licensed:
false`) until a licensed source is approved; until then only headlines and links from
compliant sources are shown.
