# Collabify: Business Plan

## Purpose
Connect university students seeking remote work experience with entrepreneurs and startups that need
affordable, skilled talent.

## Core offering
- Student and entrepreneur accounts
- Job posting and matching
- Encrypted in-app messaging
- Escrow payment system
- Ratings and reviews
- Scalable infrastructure for high traffic

## Target users
- **Students:** gain experience, earn income, build their CVs.
- **Entrepreneurs:** access affordable, motivated, skilled talent globally.

## Revenue model
| Stream | Price (as built) | Config |
|---|---|---|
| Commission on completed projects | **15%** of project value (10% for Student Premium) | `PLATFORM_COMMISSION_RATE`, `PREMIUM_STUDENT_COMMISSION_RATE` |
| Entrepreneur subscriptions | Starter free (2 listings) · Growth £19/mo (10 listings + priority) · Scale £49/mo (unlimited + priority) | `server/src/config.js` → `PLANS` |
| Featured listings | £9.99 for 7 days | `FEATURED_LISTING_FEE_PENCE` |
| Premium student accounts | £4.99/mo: lower 10% fee, boosted in talent search, badge | `PLANS.student.premium` |

The commission is deducted from the project price: the entrepreneur pays the agreed price into escrow,
the student receives 85% and Collabify keeps 15%. Clients pay no extra fees, which keeps the headline
price simple and undercuts platforms that charge both sides.

## Competitive edge
- Exclusive to verified students (university email verification is enforced before applying)
- Academic verification
- Career-focused: completed work flows into the student's portfolio automatically
- Lower fees than Fiverr / Upwork
- University partnerships for supply

## Unit economics (illustrative)
| Assumption | Value |
|---|---|
| Average project value | £300 |
| Commission per project (15%) | £45 |
| Projects per month to cover ~£1,000/mo running costs | ~23 |
| Projects needed to recover the £59k launch budget from commission alone | ~1,310 |

Subscriptions and featured listings shorten that payback. For example, 100 Growth subscribers add
£1,900 a month.

## Go-to-market
1. **Supply first:** partner with 3–5 university careers services and student societies; verified students
   are the moat.
2. **Demand:** startup incubators, accelerators and founder communities. Offer first featured listings free.
3. **Flywheel:** every completed project produces a review and a portfolio item, which improves matching
   and trust for the next project.
