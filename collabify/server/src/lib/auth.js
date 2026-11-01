import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized, forbidden } from './http.js';

export const COOKIE_NAME = 'collabify_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: MAX_AGE_SECONDS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: MAX_AGE_SECONDS * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Attaches req.user (fresh from the DB) when a valid session cookie is present. */
export function sessionMiddleware(db) {
  const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
  return (req, _res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.user = getUser.get(payload.sub) || null;
      } catch {
        req.user = null;
      }
    }
    next();
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden(`Only ${roles.join(' or ')} accounts can do this`));
  next();
};

export const requireVerifiedStudent = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'student') return next(forbidden('Only student accounts can do this'));
  if (!req.user.academic_verified_at) return next(forbidden('Verify your academic email first'));
  next();
};
