import { Router } from 'express';
import { z } from 'zod';
import { parse, notFound, forbidden, conflict, badRequest } from '../lib/http.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { notify } from '../lib/notify.js';
import { transaction } from '../db.js';
import { getPaymentProvider } from '../payments/index.js';

/**
 * Escrow lifecycle
 *
 *   awaiting_funding --fund--> funded --submit--> submitted --release--> released
 *          |                     |                   |
 *        cancel               dispute             dispute --admin resolve--> released | refunded
 *
 * Money is held by the payment provider from `fund` until `release` (student is paid the
 * payout, platform keeps the commission) or `refund` (entrepreneur gets everything back).
 */
export function contractRoutes(db) {
  const r = Router();

  const load = (id, user) => {
    const c = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
    if (!c) throw notFound('Contract not found');
    if (user.role !== 'admin' && c.student_id !== user.id && c.entrepreneur_id !== user.id) throw forbidden();
    return c;
  };

  const ledger = (contractId, userId, kind, amount, memo) =>
    db.prepare('INSERT INTO ledger_entries (contract_id, user_id, kind, amount_pence, memo) VALUES (?, ?, ?, ?, ?)').run(
      contractId, userId, kind, amount, memo,
    );

  const setStatus = (id, status, extra = {}) => {
    const sets = Object.keys(extra).map((k) => `, ${k} = ?`).join('');
    return db
      .prepare(`UPDATE contracts SET status = ?, updated_at = datetime('now')${sets} WHERE id = ? RETURNING *`)
      .get(status, ...Object.values(extra), id);
  };

  function shape(c, viewer) {
    const job = db.prepare('SELECT id, title FROM jobs WHERE id = ?').get(c.job_id);
    const person = (id) => {
      const u = db.prepare('SELECT id, name, avatar_color, role, public_key FROM users WHERE id = ?').get(id);
      return { id: u.id, name: u.name, avatarColor: u.avatar_color, role: u.role, publicKey: u.public_key };
    };
    const myReview = viewer && db.prepare('SELECT rating, comment FROM reviews WHERE contract_id = ? AND reviewer_id = ?').get(c.id, viewer.id);
    return {
      id: c.id,
      job,
      student: person(c.student_id),
      entrepreneur: person(c.entrepreneur_id),
      amountPence: c.amount_pence,
      commissionRate: c.commission_rate,
      commissionPence: c.commission_pence,
      payoutPence: c.payout_pence,
      status: c.status,
      provider: c.provider,
      submissionNote: c.submission_note,
      disputeReason: c.dispute_reason,
      myReview: myReview || null,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }

  r.get('/', requireAuth, (req, res) => {
    const rows = db
      .prepare('SELECT * FROM contracts WHERE student_id = ? OR entrepreneur_id = ? ORDER BY updated_at DESC, id DESC')
      .all(req.user.id, req.user.id);
    res.json({ contracts: rows.map((c) => shape(c, req.user)) });
  });

  r.get('/:id', requireAuth, (req, res) => {
    const c = load(req.params.id, req.user);
    const entries = db
      .prepare('SELECT kind, amount_pence AS amountPence, memo, created_at AS createdAt FROM ledger_entries WHERE contract_id = ? ORDER BY id')
      .all(c.id);
    res.json({ contract: shape(c, req.user), ledger: entries });
  });

  r.post('/:id/fund', requireRole('entrepreneur'), async (req, res) => {
    const c = load(req.params.id, req.user);
    if (c.entrepreneur_id !== req.user.id) throw forbidden();
    if (c.status !== 'awaiting_funding') throw conflict('This contract is not awaiting funding');
    const result = await getPaymentProvider().fund({ contract: c, entrepreneur: req.user });
    let updated;
    if (result.funded) {
      updated = transaction(db, () => markFunded(db, c, result.ref, ledger, setStatus));
    } else {
      updated = db.prepare('UPDATE contracts SET provider_ref = ? WHERE id = ? RETURNING *').get(result.ref, c.id);
    }
    res.json({ contract: shape(updated, req.user), clientSecret: result.clientSecret });
  });

  r.post('/:id/submit', requireRole('student'), (req, res) => {
    const c = load(req.params.id, req.user);
    if (c.student_id !== req.user.id) throw forbidden();
    if (c.status !== 'funded') throw conflict('Work can be submitted once escrow is funded');
    const { note } = parse(z.object({ note: z.string().trim().min(5).max(3000) }), req.body);
    const updated = setStatus(c.id, 'submitted', { submission_note: note });
    notify(db, c.entrepreneur_id, 'submitted', 'Work has been submitted for your review.', `/contracts/${c.id}`);
    res.json({ contract: shape(updated, req.user) });
  });

  r.post('/:id/release', requireRole('entrepreneur'), async (req, res) => {
    const c = load(req.params.id, req.user);
    if (c.entrepreneur_id !== req.user.id) throw forbidden();
    if (!['funded', 'submitted'].includes(c.status)) throw conflict('Funds can only be released from a funded contract');
    const updated = await releaseFunds(db, c, ledger, setStatus);
    res.json({ contract: shape(updated, req.user) });
  });

  r.post('/:id/dispute', requireAuth, (req, res) => {
    const c = load(req.params.id, req.user);
    if (!['funded', 'submitted'].includes(c.status)) throw conflict('Only funded contracts can be disputed');
    const { reason } = parse(z.object({ reason: z.string().trim().min(10).max(2000) }), req.body);
    const updated = setStatus(c.id, 'disputed', { dispute_reason: reason });
    const other = c.student_id === req.user.id ? c.entrepreneur_id : c.student_id;
    notify(db, other, 'disputed', 'A dispute has been opened on your contract. Our team will review it.', `/contracts/${c.id}`);
    res.json({ contract: shape(updated, req.user) });
  });

  r.post('/:id/cancel', requireRole('entrepreneur'), (req, res) => {
    const c = load(req.params.id, req.user);
    if (c.entrepreneur_id !== req.user.id) throw forbidden();
    if (c.status !== 'awaiting_funding') throw conflict('Funded contracts must be refunded via a dispute');
    const updated = transaction(db, () => {
      db.prepare("UPDATE jobs SET status = 'open' WHERE id = ?").run(c.job_id);
      db.prepare("UPDATE applications SET status = 'rejected' WHERE id = ?").run(c.application_id);
      return setStatus(c.id, 'cancelled');
    });
    notify(db, c.student_id, 'cancelled', 'A contract was cancelled before funding.', `/contracts/${c.id}`);
    res.json({ contract: shape(updated, req.user) });
  });

  // Platform admin settles disputes.
  r.post('/:id/resolve', requireRole('admin'), async (req, res) => {
    const c = load(req.params.id, req.user);
    if (c.status !== 'disputed') throw conflict('Contract is not in dispute');
    const { outcome } = parse(z.object({ outcome: z.enum(['release', 'refund']) }), req.body);
    let updated;
    if (outcome === 'release') {
      updated = await releaseFunds(db, c, ledger, setStatus);
    } else {
      const { ref } = await getPaymentProvider().refund({ contract: c });
      updated = transaction(db, () => {
        ledger(c.id, c.entrepreneur_id, 'escrow_refund', c.amount_pence, `Refund ${ref}`);
        db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(c.job_id);
        return setStatus(c.id, 'refunded');
      });
      notify(db, c.entrepreneur_id, 'refunded', 'Your escrow payment has been refunded.', `/contracts/${c.id}`);
      notify(db, c.student_id, 'refunded', 'The dispute was resolved with a refund to the client.', `/contracts/${c.id}`);
    }
    res.json({ contract: shape(updated, req.user) });
  });

  r.post('/:id/reviews', requireAuth, (req, res) => {
    const c = load(req.params.id, req.user);
    if (c.status !== 'released') throw badRequest('You can leave a review once the project is complete');
    const { rating, comment } = parse(
      z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1500).default('') }),
      req.body,
    );
    const reviewee = c.student_id === req.user.id ? c.entrepreneur_id : c.student_id;
    try {
      db.prepare('INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(
        c.id, req.user.id, reviewee, rating, comment,
      );
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) throw conflict('You have already reviewed this project');
      throw err;
    }
    notify(db, reviewee, 'review', `${req.user.name} left you a ${rating}-star review.`, `/users/${reviewee}`);
    res.status(201).json({ ok: true });
  });

  return r;
}

export function markFunded(db, c, ref, ledger, setStatus) {
  ledger(c.id, c.entrepreneur_id, 'escrow_deposit', c.amount_pence, `Escrow funded (${ref})`);
  const updated = setStatus(c.id, 'funded', { provider_ref: ref });
  notify(db, c.student_id, 'funded', 'Escrow is funded - you can start work.', `/contracts/${c.id}`);
  return updated;
}

async function releaseFunds(db, c, ledger, setStatus) {
  const student = db.prepare('SELECT * FROM users WHERE id = ?').get(c.student_id);
  const { ref } = await getPaymentProvider().release({ contract: c, student });
  const updated = transaction(db, () => {
    ledger(c.id, c.student_id, 'payout', c.payout_pence, `Payout to student (${ref})`);
    ledger(c.id, null, 'platform_commission', c.commission_pence, `${Math.round(c.commission_rate * 100)}% platform commission`);
    db.prepare("UPDATE jobs SET status = 'completed' WHERE id = ?").run(c.job_id);
    const job = db.prepare('SELECT title, description FROM jobs WHERE id = ?').get(c.job_id);
    // Career-focused: completed work is added to the student's portfolio automatically.
    db.prepare('INSERT INTO portfolio_items (user_id, title, description, contract_id) VALUES (?, ?, ?, ?)').run(
      c.student_id, job.title, `Completed via Collabify. ${job.description.slice(0, 280)}`, c.id,
    );
    return setStatus(c.id, 'released');
  });
  notify(db, c.student_id, 'released', `Payment released! £${(c.payout_pence / 100).toFixed(2)} is on its way.`, `/contracts/${c.id}`);
  notify(db, c.entrepreneur_id, 'released', 'Project complete. Leave a review for your student.', `/contracts/${c.id}`);
  return updated;
}
