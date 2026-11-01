import { Router } from 'express';
import { z } from 'zod';
import { config, PLANS, FEATURED_LISTING_FEE_PENCE, FEATURED_LISTING_DAYS } from '../config.js';
import { parse, notFound, forbidden, conflict, badRequest } from '../lib/http.js';
import { requireAuth, requireRole, requireVerifiedStudent } from '../lib/auth.js';
import { publicUser, setSkills } from '../lib/users.js';
import { matchScore } from '../lib/matching.js';
import { splitPayment } from '../lib/money.js';
import { notify } from '../lib/notify.js';
import { transaction } from '../db.js';
import { getPaymentProvider } from '../payments/index.js';

export const CATEGORIES = [
  'Software Development', 'Design', 'Marketing', 'Writing & Content', 'Data & Analytics',
  'Research', 'Social Media', 'Video & Animation', 'Business & Finance', 'Other',
];

const jobSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(30, 'should be at least 30 characters').max(5000),
  category: z.enum(CATEGORIES),
  budgetPence: z.number().int().min(1000, 'minimum budget is £10').max(5_000_000),
  duration: z.string().trim().max(60).default(''),
  skills: z.array(z.string().trim().min(1).max(40)).min(1, 'add at least one skill').max(15),
});

const applicationSchema = z.object({
  coverLetter: z.string().trim().min(30, 'should be at least 30 characters').max(3000),
  proposedPence: z.number().int().min(1000).max(5_000_000),
});

export function jobRoutes(db) {
  const r = Router();
  const jobSkills = (id) => db.prepare('SELECT skill FROM job_skills WHERE job_id = ? ORDER BY skill').all(id).map((x) => x.skill);
  const studentSignals = db.prepare(
    `SELECT (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE reviewee_id = :id) AS avgRating,
            (SELECT COUNT(*) FROM contracts WHERE student_id = :id AND status = 'released') AS completedCount`,
  );

  function scoreFor(job, student) {
    const studentSkills = db.prepare('SELECT skill FROM skills WHERE user_id = ?').all(student.id).map((x) => x.skill);
    const s = studentSignals.get({ id: student.id });
    return matchScore({
      jobSkills: job.skills ?? jobSkills(job.id),
      studentSkills,
      verified: Boolean(student.academic_verified_at),
      avgRating: s.avgRating,
      completedCount: s.completedCount,
    });
  }

  function shapeJob(row) {
    const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(row.owner_id);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      budgetPence: row.budget_pence,
      duration: row.duration,
      status: row.status,
      featured: Boolean(row.featured_until && new Date(row.featured_until.replace(' ', 'T') + 'Z') > new Date()),
      featuredUntil: row.featured_until,
      priority: Boolean(row.priority),
      skills: jobSkills(row.id),
      applicationCount: db.prepare("SELECT COUNT(*) AS n FROM applications WHERE job_id = ? AND status != 'withdrawn'").get(row.id).n,
      owner: owner && { id: owner.id, name: owner.name, company: owner.company, avatarColor: owner.avatar_color },
      createdAt: row.created_at,
    };
  }

  r.get('/meta', (_req, res) => {
    res.json({ categories: CATEGORIES, commissionRate: config.commissionRate });
  });

  r.get('/', (req, res) => {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '');
    const skill = String(req.query.skill || '').trim();
    const minBudget = Number(req.query.minBudget || 0) * 100;
    const sort = req.query.sort === 'budget' ? 'j.budget_pence DESC' : 'j.created_at DESC';
    const rows = db
      .prepare(
        `SELECT j.* FROM jobs j
         WHERE j.status = 'open'
           AND (? = '' OR j.title LIKE ? OR j.description LIKE ?)
           AND (? = '' OR j.category = ?)
           AND (? = '' OR EXISTS (SELECT 1 FROM job_skills s WHERE s.job_id = j.id AND s.skill = ?))
           AND j.budget_pence >= ?
         ORDER BY (j.featured_until IS NOT NULL AND j.featured_until > datetime('now')) DESC,
                  j.priority DESC, ${sort}, j.id DESC
         LIMIT 100`,
      )
      .all(q, `%${q}%`, `%${q}%`, category, category, skill, skill, minBudget);
    const jobs = rows.map(shapeJob);
    if (req.user?.role === 'student') for (const j of jobs) j.matchScore = scoreFor(j, req.user);
    res.json({ jobs });
  });

  r.get('/recommended', requireRole('student'), (req, res) => {
    const rows = db.prepare("SELECT * FROM jobs WHERE status = 'open' ORDER BY id DESC LIMIT 300").all();
    const applied = new Set(db.prepare('SELECT job_id FROM applications WHERE student_id = ?').all(req.user.id).map((a) => a.job_id));
    const jobs = rows
      .filter((j) => !applied.has(j.id))
      .map((row) => {
        const j = shapeJob(row);
        j.matchScore = scoreFor(j, req.user);
        return j;
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 12);
    res.json({ jobs });
  });

  r.get('/mine', requireRole('entrepreneur'), (req, res) => {
    const rows = db.prepare('SELECT * FROM jobs WHERE owner_id = ? ORDER BY id DESC').all(req.user.id);
    res.json({ jobs: rows.map(shapeJob) });
  });

  r.post('/', requireRole('entrepreneur'), (req, res) => {
    const body = parse(jobSchema, req.body);
    const plan = PLANS.entrepreneur[req.user.plan] || PLANS.entrepreneur.free;
    const active = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE owner_id = ? AND status IN ('open', 'in_progress')").get(req.user.id).n;
    if (active >= plan.activeListingLimit) {
      throw forbidden(`Your ${plan.name} plan allows ${plan.activeListingLimit} active listings. Upgrade for more.`);
    }
    const job = transaction(db, () => {
      const row = db
        .prepare(
          `INSERT INTO jobs (owner_id, title, description, category, budget_pence, duration, priority)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        )
        .get(req.user.id, body.title, body.description, body.category, body.budgetPence, body.duration, plan.priorityPosting ? 1 : 0);
      setSkills(db, 'job_skills', 'job_id', row.id, body.skills);
      return row;
    });
    res.status(201).json({ job: shapeJob(job) });
  });

  r.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Job not found');
    const job = shapeJob(row);
    const out = { job };

    if (req.user?.id === row.owner_id) {
      out.applications = db
        .prepare("SELECT * FROM applications WHERE job_id = ? AND status != 'withdrawn' ORDER BY id")
        .all(row.id)
        .map((a) => {
          const student = db.prepare('SELECT * FROM users WHERE id = ?').get(a.student_id);
          return {
            id: a.id,
            coverLetter: a.cover_letter,
            proposedPence: a.proposed_pence,
            status: a.status,
            createdAt: a.created_at,
            student: publicUser(db, student),
            matchScore: scoreFor(job, student),
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore);
    }
    if (req.user?.role === 'student') {
      job.matchScore = scoreFor(job, req.user);
      const mine = db.prepare('SELECT * FROM applications WHERE job_id = ? AND student_id = ?').get(row.id, req.user.id);
      out.myApplication = mine && { id: mine.id, status: mine.status, proposedPence: mine.proposed_pence, coverLetter: mine.cover_letter };
    }
    const contract = db.prepare('SELECT id, student_id, entrepreneur_id FROM contracts WHERE job_id = ?').get(row.id);
    if (contract && req.user && [contract.student_id, contract.entrepreneur_id].includes(req.user.id)) out.contractId = contract.id;
    res.json(out);
  });

  r.patch('/:id', requireRole('entrepreneur'), (req, res) => {
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Job not found');
    if (row.owner_id !== req.user.id) throw forbidden();
    const { status } = parse(z.object({ status: z.enum(['open', 'closed']) }), req.body);
    if (row.status === 'in_progress' || row.status === 'completed') throw conflict('This job already has a contract');
    db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, row.id);
    res.json({ job: shapeJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(row.id)) });
  });

  // Paid featured listing: pinned to the top of search for FEATURED_LISTING_DAYS.
  r.post('/:id/feature', requireRole('entrepreneur'), (req, res) => {
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Job not found');
    if (row.owner_id !== req.user.id) throw forbidden();
    if (row.status !== 'open') throw conflict('Only open jobs can be featured');
    transaction(db, () => {
      db.prepare(
        `UPDATE jobs SET featured_until = datetime(MAX(COALESCE(featured_until, datetime('now')), datetime('now')), '+${FEATURED_LISTING_DAYS} days') WHERE id = ?`,
      ).run(row.id);
      db.prepare("INSERT INTO ledger_entries (user_id, kind, amount_pence, memo) VALUES (?, 'featured_listing_fee', ?, ?)").run(
        req.user.id,
        FEATURED_LISTING_FEE_PENCE,
        `Featured listing: job #${row.id}`,
      );
    });
    res.json({ job: shapeJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(row.id)), feePence: FEATURED_LISTING_FEE_PENCE });
  });

  r.post('/:id/applications', requireVerifiedStudent, (req, res) => {
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Job not found');
    if (row.status !== 'open') throw conflict('This job is no longer accepting applications');
    const body = parse(applicationSchema, req.body);
    const existing = db.prepare('SELECT * FROM applications WHERE job_id = ? AND student_id = ?').get(row.id, req.user.id);
    let app;
    if (existing && existing.status !== 'withdrawn') throw conflict('You have already applied to this job');
    if (existing) {
      app = db
        .prepare("UPDATE applications SET cover_letter = ?, proposed_pence = ?, status = 'pending', created_at = datetime('now') WHERE id = ? RETURNING *")
        .get(body.coverLetter, body.proposedPence, existing.id);
    } else {
      app = db
        .prepare('INSERT INTO applications (job_id, student_id, cover_letter, proposed_pence) VALUES (?, ?, ?, ?) RETURNING *')
        .get(row.id, req.user.id, body.coverLetter, body.proposedPence);
    }
    notify(db, row.owner_id, 'application', `${req.user.name} applied to "${row.title}"`, `/jobs/${row.id}`);
    res.status(201).json({ application: { id: app.id, status: app.status } });
  });

  return r;
}

export function applicationRoutes(db) {
  const r = Router();

  const load = (id) => {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    if (!app) throw notFound('Application not found');
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(app.job_id);
    return { app, job };
  };

  r.get('/mine', requireRole('student'), (req, res) => {
    const rows = db
      .prepare(
        `SELECT a.id, a.status, a.proposed_pence AS proposedPence, a.created_at AS createdAt,
                j.id AS jobId, j.title AS jobTitle, j.status AS jobStatus, c.id AS contractId
         FROM applications a JOIN jobs j ON j.id = a.job_id
         LEFT JOIN contracts c ON c.application_id = a.id
         WHERE a.student_id = ? ORDER BY a.id DESC`,
      )
      .all(req.user.id);
    res.json({ applications: rows });
  });

  // Accepting an application creates the escrow contract at the agreed price.
  r.post('/:id/accept', requireRole('entrepreneur'), (req, res) => {
    const { app, job } = load(req.params.id);
    if (job.owner_id !== req.user.id) throw forbidden();
    if (job.status !== 'open') throw conflict('This job already has a contract');
    if (app.status !== 'pending') throw conflict('Only pending applications can be accepted');

    const student = db.prepare('SELECT * FROM users WHERE id = ?').get(app.student_id);
    const rate = student.plan === 'premium' ? config.premiumStudentCommissionRate : config.commissionRate;
    const split = splitPayment(app.proposed_pence, rate);
    const provider = getPaymentProvider();

    const contract = transaction(db, () => {
      db.prepare("UPDATE applications SET status = 'accepted' WHERE id = ?").run(app.id);
      const others = db.prepare("SELECT id, student_id FROM applications WHERE job_id = ? AND id != ? AND status = 'pending'").all(job.id, app.id);
      db.prepare("UPDATE applications SET status = 'rejected' WHERE job_id = ? AND id != ? AND status = 'pending'").run(job.id, app.id);
      db.prepare("UPDATE jobs SET status = 'in_progress' WHERE id = ?").run(job.id);
      const c = db
        .prepare(
          `INSERT INTO contracts (job_id, application_id, entrepreneur_id, student_id, amount_pence, commission_rate,
             commission_pence, payout_pence, provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        )
        .get(job.id, app.id, job.owner_id, app.student_id, split.amountPence, rate, split.commissionPence, split.payoutPence, provider.name);
      for (const o of others) notify(db, o.student_id, 'application_closed', `"${job.title}" has been filled.`, `/jobs/${job.id}`);
      notify(db, app.student_id, 'hired', `You were hired for "${job.title}"! Work starts once escrow is funded.`, `/contracts/${c.id}`);
      return c;
    });
    res.status(201).json({ contractId: contract.id });
  });

  r.post('/:id/reject', requireRole('entrepreneur'), (req, res) => {
    const { app, job } = load(req.params.id);
    if (job.owner_id !== req.user.id) throw forbidden();
    if (app.status !== 'pending') throw conflict('Only pending applications can be rejected');
    db.prepare("UPDATE applications SET status = 'rejected' WHERE id = ?").run(app.id);
    notify(db, app.student_id, 'application_rejected', `Your application to "${job.title}" was not selected.`, `/jobs/${job.id}`);
    res.json({ ok: true });
  });

  r.post('/:id/withdraw', requireAuth, (req, res) => {
    const { app } = load(req.params.id);
    if (app.student_id !== req.user.id) throw forbidden();
    if (app.status !== 'pending') throw badRequest('Only pending applications can be withdrawn');
    db.prepare("UPDATE applications SET status = 'withdrawn' WHERE id = ?").run(app.id);
    res.json({ ok: true });
  });

  return r;
}
