import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { parse, badRequest, conflict, unauthorized } from '../lib/http.js';
import { issueSession, clearSession, requireAuth } from '../lib/auth.js';
import { publicUser } from '../lib/users.js';

const AVATAR_COLORS = ['#6d5dfc', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#22c55e'];

const keyFields = {
  publicKey: z.string().min(20).max(2000).optional(),
  wrappedPrivateKey: z.string().min(20).max(5000).optional(),
};

const registerSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(8, 'must be at least 8 characters').max(200),
  role: z.enum(['student', 'entrepreneur']),
  name: z.string().trim().min(2).max(80),
  university: z.string().trim().max(120).optional(),
  course: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  ...keyFields,
});

export function authRoutes(db) {
  const r = Router();

  r.post('/register', async (req, res) => {
    const body = parse(registerSchema, req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) {
      throw conflict('An account with this email already exists');
    }
    const hash = await bcrypt.hash(body.password, 11);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const user = db
      .prepare(
        `INSERT INTO users (email, password_hash, role, name, university, course, company, avatar_color, public_key, wrapped_private_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(
        body.email,
        hash,
        body.role,
        body.name,
        body.role === 'student' ? body.university || null : null,
        body.role === 'student' ? body.course || null : null,
        body.role === 'entrepreneur' ? body.company || null : null,
        color,
        body.publicKey || null,
        body.wrappedPrivateKey || null,
      );
    issueSession(res, user);
    res.status(201).json({ user: publicUser(db, user, { withPrivate: true }) });
  });

  r.post('/login', async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string(), password: z.string() }), req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Always run bcrypt to keep response time constant whether or not the account exists.
    const ok = await bcrypt.compare(password, user?.password_hash || '$2b$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!user || !ok) throw unauthorized('Incorrect email or password');
    issueSession(res, user);
    res.json({ user: publicUser(db, user, { withPrivate: true }) });
  });

  r.post('/logout', (_req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => {
    res.json({ user: req.user ? publicUser(db, req.user, { withPrivate: true }) : null });
  });

  // Set or rotate the user's messaging keypair (e.g. first login on a legacy account).
  r.put('/keys', requireAuth, (req, res) => {
    const body = parse(z.object({ publicKey: keyFields.publicKey.unwrap(), wrappedPrivateKey: keyFields.wrappedPrivateKey.unwrap() }), req.body);
    if (req.user.public_key && req.body.rotate !== true) throw badRequest('Keys already set');
    db.prepare('UPDATE users SET public_key = ?, wrapped_private_key = ? WHERE id = ?').run(
      body.publicKey,
      body.wrappedPrivateKey,
      req.user.id,
    );
    res.json({ ok: true });
  });

  return r;
}
