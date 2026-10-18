# STAT — system status

Shows dependency health (database, Redis/Valkey, worker heartbeat), mode and base currency,
and for every provider: state (`connected`, `idle`, `degraded`, `error`, `unconfigured` =
no API key, `disabled` = off in config / paid), data latency class, requests used today vs
daily limit (amber at ≥80%), websocket symbol cap and cost tier. Attribution text on hover.
Source: `/api/status` and `/api/health`, refreshed every 10–15 s.
