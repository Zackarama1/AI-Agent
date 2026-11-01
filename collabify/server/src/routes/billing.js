import { Router } from 'express';
import { z } from 'zod';
import { config, PLANS, FEATURED_LISTING_FEE_PENCE, FEATURED_LISTING_DAYS } from '../config.js';
import { parse, badRequest } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { publicUser } from '../lib/users.js';
import { transaction } from '../db.js';

const serialisePlans = (plans) =>
  Object.values(plans).map((p) => ({
    ...p,
    activeListingLimit: p.activeListingLimit === Infinity ? null : p.activeListingLimit,
  }));

export function billingRoutes(db) {
  const r = Router();

  r.get('/plans', (_req, res) => {
    res.json({
      entrepreneur: serialisePlans(PLANS.entrepreneur),
      student: serialisePlans(PLANS.student),
      commissionRate: config.commissionRate,
      premiumStudentCommissionRate: config.premiumStudentCommissionRate,
      featuredListing: { feePence: FEATURED_LISTING_FEE_PENCE, days: FEATURED_LISTING_DAYS },
    });
  });

  // Subscription checkout. With the mock provider this activates immediately and records the
  // charge in the ledger; with Stripe this would create a Checkout Session for a recurring Price.
  r.post('/subscribe', requireAuth, (req, res) => {
    const { plan } = parse(z.object({ plan: z.string() }), req.body);
    const catalogue = PLANS[req.user.role];
    if (!catalogue?.[plan]) throw badRequest('Unknown plan for your account type');
    const chosen = catalogue[plan];
    const user = transaction(db, () => {
      const renews = chosen.pricePence > 0 ? "datetime('now', '+30 days')" : 'NULL';
      const u = db.prepare(`UPDATE users SET plan = ?, plan_renews_at = ${renews} WHERE id = ? RETURNING *`).get(plan, req.user.id);
      if (chosen.pricePence > 0) {
        db.prepare("INSERT INTO ledger_entries (user_id, kind, amount_pence, memo) VALUES (?, 'subscription', ?, ?)").run(
          req.user.id, chosen.pricePence, `${chosen.name} subscription (monthly)`,
        );
      }
      if (req.user.role === 'entrepreneur') {
        db.prepare("UPDATE jobs SET priority = ? WHERE owner_id = ? AND status = 'open'").run(chosen.priorityPosting ? 1 : 0, req.user.id);
      }
      return u;
    });
    res.json({ user: publicUser(db, user, { withPrivate: true }) });
  });

  // Wallet summary for the dashboard.
  r.get('/summary', requireAuth, (req, res) => {
    const me = req.user.id;
    if (req.user.role === 'student') {
      const s = db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN status = 'released' THEN payout_pence END), 0) AS earned,
             COALESCE(SUM(CASE WHEN status IN ('funded', 'submitted', 'disputed') THEN payout_pence END), 0) AS inEscrow,
             COUNT(CASE WHEN status = 'released' THEN 1 END) AS completed,
             COUNT(CASE WHEN status IN ('awaiting_funding', 'funded', 'submitted', 'disputed') THEN 1 END) AS active
           FROM contracts WHERE student_id = ?`,
        )
        .get(me);
      return res.json({ summary: s });
    }
    const s = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'released' THEN amount_pence END), 0) AS spent,
           COALESCE(SUM(CASE WHEN status IN ('funded', 'submitted', 'disputed') THEN amount_pence END), 0) AS inEscrow,
           COUNT(CASE WHEN status = 'released' THEN 1 END) AS completed,
           COUNT(CASE WHEN status IN ('awaiting_funding', 'funded', 'submitted', 'disputed') THEN 1 END) AS active
         FROM contracts WHERE entrepreneur_id = ?`,
      )
      .get(me);
    res.json({ summary: s });
  });

  return r;
}
