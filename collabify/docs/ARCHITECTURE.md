# Architecture

```
React SPA (Vite)  ──HTTPS/JSON──▶  Express API  ──▶  SQLite (WAL)  →  Postgres at scale
     │  WebCrypto E2EE                │  SSE (live events)
     │                                ├─▶ Payment provider (mock | Stripe Connect)
     └──── Stripe.js (when live) ─────┘  Email provider (verification codes)
```

- **client/**: React 18 + React Router. All message encryption and decryption happens here.
- **server/**: Express 5 API, zod validation, `node:sqlite`. Serves `client/dist` in production.

## Escrow lifecycle
```
awaiting_funding ──fund──▶ funded ──submit──▶ submitted ──release──▶ released
       │                     │                    │
     cancel               dispute ◀───────────────┘
                             │
                    admin resolve ──▶ released | refunded
```
- Accepting an application creates a contract at the agreed price and fixes the commission rate.
- Every money movement (deposit, payout, commission, refund, subscription, featured fee) is written to the
  append-only `ledger_entries` table inside the same transaction as the status change.
- Amounts are integer pence. The commission is rounded once; payout = amount − commission, so nothing is lost to rounding.
- **Stripe Connect** ("separate charges and transfers"): `fund` creates a PaymentIntent with
  `transfer_group=contract_<id>`; the `payment_intent.succeeded` webhook (signature-verified) marks it funded;
  `release` transfers the payout to the student's Express account; the commission stays on the platform balance.

## End-to-end encrypted messaging
1. On sign-up the browser generates an ECDH P-256 keypair.
2. The private key is encrypted with AES-256-GCM using a key derived from the user's password
   (PBKDF2-SHA256, 310,000 iterations, random salt) and uploaded as an opaque blob. The public key is published.
3. On login the browser unwraps the private key. It is kept only in that tab's `sessionStorage`.
4. Each conversation key = ECDH(my private, their public) → AES-256-GCM. Each message uses a random 96-bit IV.
5. The server stores `{ciphertext, iv}` and relays it over server-sent events. It cannot read messages.

Known trade-offs to address before launch: a password reset currently cannot recover old messages (add a recovery
key or re-wrap flow), and the server sees the password at login, so it could in principle unwrap keys. Moving to
an OPAQUE/SRP-style login removes that.

## Security
- Passwords are hashed with bcrypt. Sessions are httpOnly, SameSite=Lax, Secure in production, signed JWT cookies.
- CSRF defence: SameSite cookies plus a JSON-only rule for state-changing requests.
- Helmet with a strict Content Security Policy; rate limits (stricter on auth and verification).
- Verification codes are hashed, expire after 15 minutes and are limited to 5 attempts. An academic email can belong to only one account.
- Authorisation checks on every contract, conversation and application route (covered by tests).

## Scaling plan (the £7k infrastructure budget)
The API is stateless apart from two pieces, which are isolated so they can be swapped:

| Component | Now | At scale |
|---|---|---|
| Database | SQLite (WAL) via `server/src/db.js` | Managed Postgres (Neon, RDS or Supabase) with read replicas. The schema is portable SQL. |
| Live events | In-process pub/sub (`server/src/lib/events.js`) | Redis pub/sub, same `publish`/`subscribe` interface |
| Static assets | Served by Express | CDN (Cloudflare) in front of `client/dist` |
| Compute | One container | Auto-scaled containers behind a load balancer (Fly.io, Render, ECS or Cloud Run) |
| Email | Console in dev | Postmark, SES or Resend in `verificationRoutes({ sendEmail })` |

## Pre-launch checklist
- [ ] Set `PAYMENT_PROVIDER=stripe`, add Stripe.js checkout with `clientSecret` and Connect onboarding screens
- [ ] Wire a transactional email provider
- [ ] Migrate to Postgres and Redis
- [ ] Legal: ToS, privacy policy (GDPR), contractor agreement, cookie notice
- [ ] Penetration test and dependency audit
- [ ] Error monitoring (Sentry) and uptime checks
