/**
 * Seed a demo database. All demo accounts use the password "password123".
 * Usage: npm run seed  (set DATABASE_PATH to target a different file; existing data is wiped)
 */
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { openDatabase } from './db.js';
import { splitPayment } from './lib/money.js';
import { createIdentity, conversationKey, encryptMessage } from '../../client/src/lib/e2ee.js';

const PASSWORD = 'password123';
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.databasePath + suffix, { force: true });
const db = openDatabase();
const hash = bcrypt.hashSync(PASSWORD, 11);
const keys = {};

async function user(u) {
  const id = await createIdentity(PASSWORD);
  const row = db
    .prepare(
      `INSERT INTO users (email, password_hash, role, name, headline, bio, location, avatar_color, university, course,
        graduation_year, academic_email, academic_verified_at, company, website, plan, public_key, wrapped_private_key)
       VALUES (:email, :hash, :role, :name, :headline, :bio, :location, :color, :university, :course, :grad, :academicEmail,
        :verifiedAt, :company, :website, :plan, :pk, :wpk) RETURNING id`,
    )
    .get({
      email: u.email, hash, role: u.role, name: u.name, headline: u.headline || '', bio: u.bio || '', location: u.location || '',
      color: u.color, university: u.university || null, course: u.course || null, grad: u.grad || null,
      academicEmail: u.academicEmail || null, verifiedAt: u.academicEmail ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
      company: u.company || null, website: u.website || null, plan: u.plan || 'free', pk: id.publicKey, wpk: id.wrappedPrivateKey,
    });
  for (const s of u.skills || []) db.prepare('INSERT INTO skills (user_id, skill) VALUES (?, ?)').run(row.id, s);
  keys[row.id] = id;
  return row.id;
}

const admin = await user({ email: 'admin@collabify.app', role: 'admin', name: 'Collabify Admin', color: '#15142b' });

const maya = await user({
  email: 'maya@demo.collabify.app', role: 'student', name: 'Maya Patel', color: '#ec4899',
  headline: 'Computer Science @ UCL · React & product design', location: 'London, UK',
  bio: 'Final-year CS student who loves building clean, fast web apps. Previously interned at a fintech startup and ran the UCL Tech Society website.',
  university: 'University College London', course: 'Computer Science', grad: 2027, academicEmail: 'maya.patel@ucl.ac.uk',
  skills: ['React', 'JavaScript', 'Figma', 'CSS', 'Node.js'], plan: 'premium',
});
const tom = await user({
  email: 'tom@demo.collabify.app', role: 'student', name: 'Tom Okafor', color: '#0ea5e9',
  headline: 'Marketing & Economics @ Manchester · growth and content', location: 'Manchester, UK',
  bio: 'I run a 20k-follower TikTok for my society and love helping early-stage brands find their voice.',
  university: 'University of Manchester', course: 'Economics', grad: 2026, academicEmail: 'tom.okafor@student.manchester.ac.uk',
  skills: ['Social Media', 'Copywriting', 'SEO', 'Canva', 'TikTok'],
});
const lena = await user({
  email: 'lena@demo.collabify.app', role: 'student', name: 'Lena Fischer', color: '#14b8a6',
  headline: 'Data Science MSc @ Edinburgh · Python, SQL, dashboards', location: 'Edinburgh, UK',
  university: 'University of Edinburgh', course: 'Data Science MSc', grad: 2026, academicEmail: 'l.fischer@ed.ac.uk',
  skills: ['Python', 'SQL', 'Data Analysis', 'Excel', 'Tableau'],
});
const ravi = await user({
  email: 'ravi@demo.collabify.app', role: 'student', name: 'Ravi Shah', color: '#f59e0b',
  headline: 'Design student @ Central Saint Martins · branding', location: 'London, UK',
  university: 'University of the Arts London', course: 'Graphic Communication Design', grad: 2027, academicEmail: 'r.shah@arts.ac.uk',
  skills: ['Branding', 'Illustrator', 'Figma', 'Logo Design'],
});
await user({
  email: 'newstudent@demo.collabify.app', role: 'student', name: 'Jamie Lee', color: '#8b5cf6',
  headline: 'First-year Business student', university: 'University of Leeds', skills: ['Excel', 'Research'],
});

const sara = await user({
  email: 'sara@demo.collabify.app', role: 'entrepreneur', name: 'Sara Mensah', color: '#6d5dfc',
  headline: 'Founder, Brewbox · specialty coffee subscriptions', company: 'Brewbox', website: 'https://brewbox.example',
  location: 'Bristol, UK', bio: 'Building the easiest way to discover independent roasters.', plan: 'growth', skills: ['Marketing', 'React'],
});
const daniel = await user({
  email: 'daniel@demo.collabify.app', role: 'entrepreneur', name: 'Daniel Harris', color: '#22c55e',
  headline: 'Co-founder, Tidyly · AI bookkeeping for freelancers', company: 'Tidyly', website: 'https://tidyly.example',
  location: 'London, UK',
});

function job(owner, j, { status = 'open', featuredDays = 0, daysAgo = 0 } = {}) {
  const row = db
    .prepare(
      `INSERT INTO jobs (owner_id, title, description, category, budget_pence, duration, status, priority, featured_until, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${featuredDays ? `datetime('now', '+${featuredDays} days')` : 'NULL'}, datetime('now', '-${daysAgo} days', '-${Math.floor(Math.random() * 600)} minutes'))
       RETURNING id`,
    )
    .get(owner, j.title, j.description, j.category, j.budget * 100, j.duration, status, owner === sara ? 1 : 0);
  for (const s of j.skills) db.prepare('INSERT INTO job_skills (job_id, skill) VALUES (?, ?)').run(row.id, s);
  return row.id;
}
const apply = (jobId, student, price, letter, status = 'pending') =>
  db.prepare('INSERT INTO applications (job_id, student_id, cover_letter, proposed_pence, status) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .get(jobId, student, letter, price * 100, status).id;

function contract(jobId, appId, ent, stu, price, status) {
  const rate = db.prepare('SELECT plan FROM users WHERE id = ?').get(stu).plan === 'premium' ? config.premiumStudentCommissionRate : config.commissionRate;
  const s = splitPayment(price * 100, rate);
  const id = db
    .prepare(
      `INSERT INTO contracts (job_id, application_id, entrepreneur_id, student_id, amount_pence, commission_rate, commission_pence, payout_pence, status, provider, provider_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mock', ?) RETURNING id`,
    )
    .get(jobId, appId, ent, stu, s.amountPence, rate, s.commissionPence, s.payoutPence, status, `mock_pi_seed_${jobId}`).id;
  const ledger = db.prepare('INSERT INTO ledger_entries (contract_id, user_id, kind, amount_pence, memo) VALUES (?, ?, ?, ?, ?)');
  if (status !== 'awaiting_funding') ledger.run(id, ent, 'escrow_deposit', s.amountPence, 'Escrow funded');
  if (status === 'released') {
    ledger.run(id, stu, 'payout', s.payoutPence, 'Payout to student');
    ledger.run(id, null, 'platform_commission', s.commissionPence, `${rate * 100}% platform commission`);
  }
  return id;
}

// Completed project with reviews
const done = job(sara, {
  title: 'Build a landing page for our coffee subscription launch',
  description: 'We need a fast, mobile-first landing page in React with an email waitlist form and subtle animations. Designs are ready in Figma.',
  category: 'Software Development', budget: 450, duration: '2 weeks', skills: ['React', 'CSS', 'Figma'],
}, { status: 'completed', daysAgo: 40 });
const doneApp = apply(done, maya, 450, 'I have built several React landing pages and can match Figma designs pixel-perfectly.', 'accepted');
const doneC = contract(done, doneApp, sara, maya, 450, 'released');
db.prepare("INSERT INTO portfolio_items (user_id, title, description, contract_id) VALUES (?, ?, ?, ?)").run(maya, 'Brewbox launch landing page', 'Completed via Collabify. Mobile-first React landing page with waitlist, 2,000+ signups in launch week.', doneC);
db.prepare('INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(doneC, sara, maya, 5, 'Maya was brilliant: fast, communicative and the page looks better than our designs. Hiring again!');
db.prepare('INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(doneC, maya, sara, 5, 'Clear brief, quick feedback and paid instantly. Great first client.');
db.prepare("INSERT INTO portfolio_items (user_id, title, description, url) VALUES (?, ?, ?, ?)").run(maya, 'UCL Tech Society website', 'Redesigned and rebuilt the society site in Next.js; 3x faster load times.', 'https://example.com');

const done2 = job(daniel, {
  title: 'Analyse churn data and build a simple dashboard',
  description: 'We have 18 months of subscription data in CSV. Find the main churn drivers and build a Tableau or Looker dashboard we can keep updating.',
  category: 'Data & Analytics', budget: 600, duration: '3 weeks', skills: ['Python', 'SQL', 'Data Analysis', 'Tableau'],
}, { status: 'completed', daysAgo: 30 });
const done2App = apply(done2, lena, 550, 'I specialise in churn modelling for my MSc dissertation and use Tableau daily.', 'accepted');
const done2C = contract(done2, done2App, daniel, lena, 550, 'released');
db.prepare('INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(done2C, daniel, lena, 5, 'Insightful analysis that changed our onboarding strategy.');
db.prepare("INSERT INTO portfolio_items (user_id, title, description, contract_id) VALUES (?, ?, ?, ?)").run(lena, 'Churn analysis for Tidyly', 'Completed via Collabify. Identified three churn drivers and built a live Tableau dashboard.', done2C);

// Active, funded contract
const active = job(sara, {
  title: 'Run our Instagram & TikTok for 4 weeks',
  description: 'Plan, shoot and post 3x weekly short-form content for Brewbox. We will ship you coffee and props. Goal: grow from 1k to 5k followers.',
  category: 'Social Media', budget: 380, duration: '4 weeks', skills: ['Social Media', 'TikTok', 'Copywriting'],
}, { status: 'in_progress', daysAgo: 6 });
const activeApp = apply(active, tom, 380, 'I grew my society TikTok to 20k followers. I have three content pillars in mind for Brewbox already.', 'accepted');
contract(active, activeApp, sara, tom, 380, 'funded');

// Open jobs
const openJobs = [
  [daniel, { title: 'Design a logo and brand kit for a fintech startup', description: 'Tidyly needs a friendly, trustworthy logo, colour palette and type system. Deliverables: logo files (SVG/PNG), a one-page brand guide.', category: 'Design', budget: 300, duration: '10 days', skills: ['Branding', 'Logo Design', 'Illustrator', 'Figma'] }, { featuredDays: 5, daysAgo: 1 }],
  [sara, { title: 'React developer to build a subscription account portal', description: 'Customers need to pause, skip and change their coffee subscription. Build the front end in React against our existing REST API.', category: 'Software Development', budget: 900, duration: '4 weeks', skills: ['React', 'JavaScript', 'Node.js', 'CSS'] }, { daysAgo: 2 }],
  [daniel, { title: 'Write 6 SEO blog posts about freelancer taxes', description: 'Well-researched, friendly 1,200-word posts targeting UK freelancers. We provide keywords and outlines; you bring clarity and personality.', category: 'Writing & Content', budget: 240, duration: '3 weeks', skills: ['Copywriting', 'SEO', 'Research'] }, { daysAgo: 3 }],
  [sara, { title: 'Customer survey analysis & insights report', description: 'Analyse 1,400 survey responses (CSV), segment customers, and summarise insights and recommendations in a short slide deck.', category: 'Data & Analytics', budget: 280, duration: '2 weeks', skills: ['Data Analysis', 'Excel', 'Python'] }, { daysAgo: 4 }],
  [daniel, { title: 'Competitor research for a UK launch', description: 'Map 15 competitors: pricing, features, positioning, reviews. Deliver a spreadsheet and a 2-page summary with opportunities.', category: 'Research', budget: 150, duration: '1 week', skills: ['Research', 'Excel'] }, { daysAgo: 5 }],
  [sara, { title: 'Animated explainer video (60s)', description: 'Script and animate a 60-second explainer for how Brewbox works. Style: playful, flat illustration.', category: 'Video & Animation', budget: 500, duration: '3 weeks', skills: ['After Effects', 'Illustration', 'Storyboarding'] }, { daysAgo: 8 }],
];
const ids = openJobs.map(([o, j, opt]) => job(o, j, opt));
apply(ids[0], ravi, 280, 'Branding is my specialism at CSM. I would start with a short discovery call then present three directions.');
apply(ids[0], maya, 300, 'I have designed identities for two student startups and can deliver everything in Figma with source files.');
apply(ids[1], maya, 900, 'This is exactly my stack. I built a similar portal for a meal-kit startup during my internship.');
apply(ids[2], tom, 240, 'I write SEO content for my part-time job and can turn tax topics into friendly, readable posts.');

// Encrypted conversation between Sara and Maya (real E2EE, decryptable by both with password123)
const [a, b] = sara < maya ? [sara, maya] : [maya, sara];
const conv = db.prepare('INSERT INTO conversations (user_a, user_b, job_id) VALUES (?, ?, ?) RETURNING id').get(a, b, ids[1]).id;
const k = await conversationKey(keys[sara].privateKey, keys[maya].publicKey);
for (const [from, text] of [
  [sara, 'Hi Maya! Loved working with you on the landing page. Would you be up for the account portal project too?'],
  [maya, 'Hi Sara! Absolutely, I just applied. Do you have API docs I could look at?'],
  [sara, "Great! I'll share the Swagger link once we kick off. Escrow will be funded the same day."],
]) {
  const { ciphertext, iv } = await encryptMessage(k, text);
  db.prepare('INSERT INTO messages (conversation_id, sender_id, ciphertext, iv, read_at) VALUES (?, ?, ?, ?, ?)').run(conv, from, ciphertext, iv, from === maya ? null : new Date().toISOString());
}

// Some platform revenue
db.prepare("INSERT INTO ledger_entries (user_id, kind, amount_pence, memo) VALUES (?, 'subscription', 1900, 'Growth subscription (monthly)')").run(sara);
db.prepare("INSERT INTO ledger_entries (user_id, kind, amount_pence, memo) VALUES (?, 'subscription', 499, 'Student Premium subscription (monthly)')").run(maya);
db.prepare("INSERT INTO ledger_entries (user_id, kind, amount_pence, memo) VALUES (?, 'featured_listing_fee', 999, 'Featured listing')").run(daniel);

db.prepare("INSERT INTO notifications (user_id, kind, text, link) VALUES (?, 'application', 'Maya Patel applied to \"React developer to build a subscription account portal\"', ?)").run(sara, `/jobs/${ids[1]}`);

console.log(`Seeded ${config.databasePath}. Log in with any of these (password: ${PASSWORD}):
  student       maya@demo.collabify.app   (verified, premium)
  student       tom@demo.collabify.app    (verified, active contract)
  student       newstudent@demo.collabify.app (unverified)
  entrepreneur  sara@demo.collabify.app   (Growth plan)
  entrepreneur  daniel@demo.collabify.app
  admin         admin@collabify.app`);
void admin;
