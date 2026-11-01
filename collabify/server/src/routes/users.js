import { Router } from 'express';
import { z } from 'zod';
import { parse, notFound } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { publicUser, setSkills } from '../lib/users.js';
import { transaction } from '../db.js';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(140).optional(),
  bio: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(80).optional(),
  university: z.string().trim().max(120).optional(),
  course: z.string().trim().max(120).optional(),
  graduationYear: z.number().int().min(1990).max(2040).nullable().optional(),
  company: z.string().trim().max(120).optional(),
  website: z.union([z.url().max(300), z.literal('')]).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

const portfolioSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''),
  url: z.union([z.url().max(300), z.literal('')]).default(''),
});

export function userRoutes(db) {
  const r = Router();

  r.put('/me', requireAuth, (req, res) => {
    const body = parse(profileSchema, req.body);
    const columns = {
      name: body.name,
      headline: body.headline,
      bio: body.bio,
      location: body.location,
      university: req.user.role === 'student' ? body.university : undefined,
      course: req.user.role === 'student' ? body.course : undefined,
      graduation_year: req.user.role === 'student' ? body.graduationYear : undefined,
      company: req.user.role === 'entrepreneur' ? body.company : undefined,
      website: req.user.role === 'entrepreneur' ? body.website : undefined,
    };
    const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
    const user = transaction(db, () => {
      if (entries.length) {
        db.prepare(`UPDATE users SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
          ...entries.map(([, v]) => v),
          req.user.id,
        );
      }
      if (body.skills) setSkills(db, 'skills', 'user_id', req.user.id, body.skills);
      return db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    });
    res.json({ user: publicUser(db, user, { withPrivate: true }) });
  });

  r.post('/me/portfolio', requireAuth, (req, res) => {
    const body = parse(portfolioSchema, req.body);
    const item = db
      .prepare('INSERT INTO portfolio_items (user_id, title, description, url) VALUES (?, ?, ?, ?) RETURNING *')
      .get(req.user.id, body.title, body.description, body.url);
    res.status(201).json({ item });
  });

  r.delete('/me/portfolio/:itemId', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM portfolio_items WHERE id = ? AND user_id = ?').run(req.params.itemId, req.user.id);
    if (!result.changes) throw notFound();
    res.json({ ok: true });
  });

  // Browse verified student talent.
  r.get('/talent', (req, res) => {
    const q = String(req.query.q || '').trim();
    const skill = String(req.query.skill || '').trim();
    const rows = db
      .prepare(
        `SELECT u.* FROM users u
         WHERE u.role = 'student' AND u.academic_verified_at IS NOT NULL
           AND (? = '' OR u.name LIKE ? OR u.headline LIKE ? OR u.university LIKE ? OR u.course LIKE ?)
           AND (? = '' OR EXISTS (SELECT 1 FROM skills s WHERE s.user_id = u.id AND s.skill = ?))
         ORDER BY u.plan = 'premium' DESC, u.created_at DESC
         LIMIT 60`,
      )
      .all(q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, skill, skill);
    res.json({ students: rows.map((u) => publicUser(db, u)) });
  });

  r.get('/:id', (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND role != 'admin'").get(req.params.id);
    if (!user) throw notFound('User not found');
    const reviews = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, u.id AS reviewerId, u.name AS reviewerName,
                j.title AS jobTitle
         FROM reviews r JOIN users u ON u.id = r.reviewer_id
         JOIN contracts c ON c.id = r.contract_id JOIN jobs j ON j.id = c.job_id
         WHERE r.reviewee_id = ? ORDER BY r.id DESC LIMIT 50`,
      )
      .all(user.id);
    const portfolio = db
      .prepare('SELECT id, title, description, url, contract_id AS contractId, created_at AS createdAt FROM portfolio_items WHERE user_id = ? ORDER BY id DESC')
      .all(user.id);
    const openJobs =
      user.role === 'entrepreneur'
        ? db.prepare("SELECT id, title, budget_pence AS budgetPence FROM jobs WHERE owner_id = ? AND status = 'open' ORDER BY id DESC").all(user.id)
        : [];
    res.json({ user: publicUser(db, user), reviews, portfolio, openJobs });
  });

  return r;
}
