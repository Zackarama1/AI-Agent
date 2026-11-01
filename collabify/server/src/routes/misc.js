import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { subscribe } from '../lib/events.js';

export function notificationRoutes(db) {
  const r = Router();
  r.use(requireAuth);
  r.get('/', (req, res) => {
    const rows = db
      .prepare('SELECT id, kind, text, link, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50')
      .all(req.user.id);
    res.json({ notifications: rows, unread: rows.filter((n) => !n.readAt).length });
  });
  r.post('/read', (req, res) => {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(req.user.id);
    res.json({ ok: true });
  });
  return r;
}

/** Server-sent events: live messages and notifications. */
export function streamRoute() {
  return [
    requireAuth,
    (req, res) => {
      res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
      res.flushHeaders();
      res.write('event: ready\ndata: {}\n\n');
      const unsubscribe = subscribe(req.user.id, res);
      const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => {
        clearInterval(keepAlive);
        unsubscribe();
      });
    },
  ];
}

export function statsRoutes(db) {
  const r = Router();
  r.get('/public', (_req, res) => {
    const one = (sql) => db.prepare(sql).get().n;
    res.json({
      verifiedStudents: one("SELECT COUNT(*) AS n FROM users WHERE role = 'student' AND academic_verified_at IS NOT NULL"),
      entrepreneurs: one("SELECT COUNT(*) AS n FROM users WHERE role = 'entrepreneur'"),
      openJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'"),
      completedProjects: one("SELECT COUNT(*) AS n FROM contracts WHERE status = 'released'"),
      paidToStudentsPence: one("SELECT COALESCE(SUM(amount_pence), 0) AS n FROM ledger_entries WHERE kind = 'payout'"),
    });
  });
  // Platform revenue dashboard for admins (commission + subscriptions + featured listings).
  r.get('/admin', requireRole('admin'), (_req, res) => {
    const revenue = db
      .prepare(
        `SELECT kind, COUNT(*) AS count, SUM(amount_pence) AS totalPence FROM ledger_entries
         WHERE kind IN ('platform_commission', 'subscription', 'featured_listing_fee') GROUP BY kind`,
      )
      .all();
    const disputes = db
      .prepare(
        `SELECT c.id, c.amount_pence AS amountPence, c.dispute_reason AS reason, j.title AS jobTitle FROM contracts c
         JOIN jobs j ON j.id = c.job_id WHERE c.status = 'disputed' ORDER BY c.updated_at`,
      )
      .all();
    const escrowHeld = db
      .prepare("SELECT COALESCE(SUM(amount_pence), 0) AS n FROM contracts WHERE status IN ('funded', 'submitted', 'disputed')")
      .get().n;
    res.json({ revenue, disputes, escrowHeldPence: escrowHeld });
  });
  return r;
}
