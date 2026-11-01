import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { parse, badRequest, conflict, forbidden } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { notify } from '../lib/notify.js';
import { publicUser } from '../lib/users.js';

export function isAcademicEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return config.academicDomainSuffixes.some((suffix) => {
    const s = suffix.toLowerCase();
    return s.startsWith('.') ? domain.endsWith(s) : domain === s || domain.endsWith(`.${s}`);
  });
}

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

/**
 * Academic verification: the student proves they control a university email address by
 * entering a one-time code sent to it. In development the code is returned in the response
 * (and logged) instead of being emailed - plug an email provider into sendEmail() for production.
 */
export function verificationRoutes(db, { sendEmail = defaultSendEmail } = {}) {
  const r = Router();

  r.post('/request', requireRole('student'), async (req, res) => {
    const { academicEmail } = parse(z.object({ academicEmail: z.email() }), req.body);
    if (req.user.academic_verified_at) throw conflict('You are already verified');
    if (!isAcademicEmail(academicEmail)) {
      throw badRequest('Please use your university email address (e.g. name@uni.ac.uk or name@college.edu)');
    }
    const takenBy = db
      .prepare('SELECT id FROM users WHERE academic_email = ? COLLATE NOCASE AND academic_verified_at IS NOT NULL')
      .get(academicEmail);
    if (takenBy && takenBy.id !== req.user.id) throw conflict('That academic email is already linked to another account');

    const code = String(crypto.randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO verification_codes (user_id, academic_email, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(user_id) DO UPDATE SET academic_email = excluded.academic_email, code_hash = excluded.code_hash,
       expires_at = excluded.expires_at, attempts = 0`,
    ).run(req.user.id, academicEmail, hashCode(code), expires);

    await sendEmail({
      to: academicEmail,
      subject: 'Your Collabify verification code',
      text: `Your Collabify verification code is ${code}. It expires in 15 minutes.`,
    });
    res.json({ ok: true, sentTo: academicEmail, ...(config.isProd ? {} : { devCode: code }) });
  });

  r.post('/confirm', requireRole('student'), (req, res) => {
    const { code } = parse(z.object({ code: z.string().regex(/^\d{6}$/, 'must be 6 digits') }), req.body);
    const row = db.prepare('SELECT * FROM verification_codes WHERE user_id = ?').get(req.user.id);
    if (!row) throw badRequest('Request a verification code first');
    if (new Date(row.expires_at) < new Date()) throw badRequest('That code has expired - request a new one');
    if (row.attempts >= 5) throw forbidden('Too many attempts - request a new code');

    const a = Buffer.from(hashCode(code), 'hex');
    const b = Buffer.from(row.code_hash, 'hex');
    if (!crypto.timingSafeEqual(a, b)) {
      db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE user_id = ?').run(req.user.id);
      throw badRequest('Incorrect code');
    }

    const domain = row.academic_email.split('@')[1];
    const user = db
      .prepare(
        `UPDATE users SET academic_email = ?, academic_verified_at = datetime('now'),
         university = COALESCE(NULLIF(university, ''), ?) WHERE id = ? RETURNING *`,
      )
      .get(row.academic_email, domain, req.user.id);
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(req.user.id);
    notify(db, user.id, 'verified', 'Your student status is verified - you can now apply for projects.', '/jobs');
    res.json({ user: publicUser(db, user, { withPrivate: true }) });
  });

  return r;
}

async function defaultSendEmail({ to, subject, text }) {
  // Replace with Postmark / SES / Resend in production.
  if (config.isProd) console.warn(`[email] No email provider configured - message to ${to} was not sent`);
  else console.log(`[email] to=${to} subject="${subject}" :: ${text}`);
}
