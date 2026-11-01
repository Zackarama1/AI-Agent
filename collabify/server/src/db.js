import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'entrepreneur', 'admin')),
  name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#6d5dfc',
  -- student fields
  university TEXT,
  course TEXT,
  graduation_year INTEGER,
  academic_email TEXT,
  academic_verified_at TEXT,
  -- entrepreneur fields
  company TEXT,
  website TEXT,
  -- monetisation
  plan TEXT NOT NULL DEFAULT 'free',
  plan_renews_at TEXT,
  -- end-to-end encrypted messaging keys (private key is wrapped client-side with the user's password)
  stripe_account_id TEXT,
  public_key TEXT,
  wrapped_private_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (user_id, skill)
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  contract_id INTEGER REFERENCES contracts(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verification_codes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  academic_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  budget_pence INTEGER NOT NULL CHECK (budget_pence > 0),
  duration TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'closed')),
  priority INTEGER NOT NULL DEFAULT 0,
  featured_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id);

CREATE TABLE IF NOT EXISTS job_skills (
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (job_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_job_skills_skill ON job_skills(skill);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter TEXT NOT NULL,
  proposed_pence INTEGER NOT NULL CHECK (proposed_pence > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, student_id)
);

-- A contract is the escrow-backed agreement created when an application is accepted.
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id),
  entrepreneur_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  amount_pence INTEGER NOT NULL,
  commission_rate REAL NOT NULL,
  commission_pence INTEGER NOT NULL,
  payout_pence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_funding'
    CHECK (status IN ('awaiting_funding', 'funded', 'submitted', 'released', 'disputed', 'refunded', 'cancelled')),
  provider TEXT NOT NULL,
  provider_ref TEXT,
  submission_note TEXT,
  dispute_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Append-only money ledger: every movement is recorded for audit.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  user_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL,
  amount_pence INTEGER NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  user_a INTEGER NOT NULL REFERENCES users(id),
  user_b INTEGER NOT NULL REFERENCES users(id),
  job_id INTEGER REFERENCES jobs(id),
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);

-- Messages are stored as ciphertext only. The server never sees plaintext.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  reviewee_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contract_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, id DESC);
`;

export function openDatabase(path = config.databasePath) {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside a transaction; rolls back on throw. */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
