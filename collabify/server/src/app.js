import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { sessionMiddleware } from './lib/auth.js';
import { errorHandler, notFound } from './lib/http.js';
import { authRoutes } from './routes/auth.js';
import { verificationRoutes } from './routes/verification.js';
import { userRoutes } from './routes/users.js';
import { jobRoutes, applicationRoutes } from './routes/jobs.js';
import { contractRoutes, markFunded } from './routes/contracts.js';
import { messageRoutes } from './routes/messages.js';
import { billingRoutes } from './routes/billing.js';
import { notificationRoutes, streamRoute, statsRoutes } from './routes/misc.js';
import { verifyStripeSignature } from './payments/stripe.js';
import { transaction } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db, { rateLimits = true, sendEmail } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://js.stripe.com'],
          frameSrc: ["'self'", 'https://js.stripe.com'],
          connectSrc: ["'self'", 'https://api.stripe.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

  // Stripe webhook needs the raw body for signature verification, so it is mounted before express.json().
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const raw = req.body.toString('utf8');
    if (!secret || !verifyStripeSignature(raw, req.get('stripe-signature'), secret)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    const event = JSON.parse(raw);
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const c = db.prepare('SELECT * FROM contracts WHERE id = ? AND provider_ref = ?').get(pi.metadata?.contract_id, pi.id);
      if (c && c.status === 'awaiting_funding') {
        const ledger = (cid, uid, kind, amt, memo) =>
          db.prepare('INSERT INTO ledger_entries (contract_id, user_id, kind, amount_pence, memo) VALUES (?, ?, ?, ?, ?)').run(cid, uid, kind, amt, memo);
        const setStatus = (id, status, extra) =>
          db.prepare("UPDATE contracts SET status = ?, provider_ref = ?, updated_at = datetime('now') WHERE id = ? RETURNING *").get(status, extra.provider_ref, id);
        transaction(db, () => markFunded(db, c, pi.id, ledger, setStatus));
      }
    }
    res.json({ received: true });
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware(db));

  // CSRF defence-in-depth: state-changing API calls must be JSON (cannot be sent by a plain HTML form).
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json') && req.headers['content-length'] !== '0') {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    next();
  });

  if (rateLimits) {
    app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
    const strict = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
    app.use(['/api/auth/login', '/api/auth/register', '/api/verification'], strict);
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(db));
  app.use('/api/verification', verificationRoutes(db, sendEmail ? { sendEmail } : undefined));
  app.use('/api/users', userRoutes(db));
  app.use('/api/jobs', jobRoutes(db));
  app.use('/api/applications', applicationRoutes(db));
  app.use('/api/contracts', contractRoutes(db));
  app.use('/api/conversations', messageRoutes(db));
  app.use('/api/billing', billingRoutes(db));
  app.use('/api/notifications', notificationRoutes(db));
  app.use('/api/stats', statsRoutes(db));
  app.get('/api/stream', ...streamRoute());
  app.use('/api', (_req, _res, next) => next(notFound('API route not found')));

  // Serve the built React app in production.
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
