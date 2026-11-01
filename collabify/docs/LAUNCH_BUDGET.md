# Launch Budget: £59,000

The original estimate to launch Collabify as a secure, scalable platform with in-house payment processing,
with what this codebase already delivers against each line.

| Item | Budget | Status in this build | Remaining work to budget for |
|---|---:|---|---|
| Custom website development (marketplace features) | £25,000 | ✅ Built: accounts, verification, jobs, matching, applications, contracts, reviews, portfolio, plans, notifications, admin | Product polish from user feedback, file uploads for deliverables, search at scale |
| UI/UX design & branding | £4,000 | ✅ Responsive UI, light/dark mode, logo mark | Professional brand identity, usability testing |
| Encrypted in-app messaging | £3,000 | ✅ End-to-end encrypted (ECDH + AES-GCM), live delivery | Independent security review, key recovery and rotation UX, attachments |
| Secure escrow payments (Stripe Connect / Mangopay) | £5,000 | ✅ Escrow state machine, ledger, Stripe Connect provider, webhook verification | Stripe.js checkout UI, Connect onboarding screens, live testing, KYC review |
| Scalability: DB optimisation, CDN, load balancing, auto-scaling | £7,000 | 🟡 Indexed schema, stateless API, Docker image, health checks | Postgres migration, Redis pub/sub for live events, CDN, managed hosting (see ARCHITECTURE.md) |
| Legal & compliance (GDPR, ToS, contractor agreements) | £3,000 | ❌ Not started | Solicitor-drafted ToS, privacy policy, DPA, contractor agreement, cookie policy |
| Marketing & launch campaigns | £5,000 | 🟡 Landing page and pricing page | University partnerships, ads, launch events |
| Six months of maintenance, bug fixes, security updates | £6,000 | 🟡 Automated test suite and CI | Ongoing |
| Domain & hosting (year one) | £1,000 | ❌ | Domain, hosting, transactional email (Postmark/SES), monitoring |
| **Total** | **£59,000** | | |

Because the core marketplace is already built and tested, much of the £25k development line and parts of the
messaging and payments lines can be redirected to security review, legal and growth.
