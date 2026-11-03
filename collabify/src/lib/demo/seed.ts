import { feeFor } from '../fees';
import type { DemoDb, DemoUser } from './store';

/**
 * Seed data for demo mode. Every business, person and project here is fictional.
 * Demo sign-in: use any of the emails below; the one-time code is shown on screen.
 */
export const DEMO_ACCOUNTS = [
  { email: 'maya@student.demo.ac.uk', label: 'Student · Maya', role: 'student' as const },
  { email: 'sara@brewbox.demo', label: 'Business · Brewbox', role: 'business' as const },
  { email: 'admin@collabify.demo', label: 'Admin', role: 'admin' as const },
];

const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

const student = (
  id: string, fullName: string, email: string, university: string, course: string, year: string, skills: string[], bio: string, payoutsEnabled = true,
): DemoUser => ({
  id, role: 'student', fullName, email,
  student: {
    university, course, year, skills, bio, portfolioUrl: '',
    private: { universityEmail: email, payoutsEnabled, rightToWorkStatus: 'unknown', verifiedAt: daysAgo(60) },
  },
});
const business = (id: string, fullName: string, email: string, companyName: string, website: string, plan: 'free' | 'pro' | 'scale'): DemoUser => ({
  id, role: 'business', fullName, email, business: { companyName, website, plan },
});

export function seed(): DemoDb {
  const users: DemoUser[] = [
    student('s_maya', 'Maya Patel', 'maya@student.demo.ac.uk', 'UCL', 'Computer Science', 'Year 3', ['React', 'JavaScript', 'Figma', 'CSS'], 'I build fast, clean web apps and love turning rough ideas into something people can click.'),
    student('s_tom', 'Tom Okafor', 'tom@student.demo.ac.uk', 'University of Manchester', 'Economics', 'Year 2', ['Social media', 'Canva', 'Copywriting', 'TikTok'], 'I run a 20k-follower TikTok for my society.'),
    student('s_lena', 'Lena Fischer', 'lena@student.demo.ac.uk', 'University of Edinburgh', 'Data Science MSc', 'Postgrad', ['Python', 'Excel', 'Data analysis', 'Research'], 'Dashboards, data cleaning and clear charts.'),
    student('s_ravi', 'Ravi Shah', 'ravi@student.demo.ac.uk', 'University of the Arts London', 'Graphic Design', 'Year 2', ['Figma', 'Branding', 'Illustrator'], 'Brand identities with personality.', false),
    business('b_sara', 'Sara Mensah', 'sara@brewbox.demo', 'Brewbox (demo)', 'https://brewbox.example', 'free'),
    business('b_dan', 'Daniel Harris', 'dan@tidyly.demo', 'Tidyly (demo)', 'https://tidyly.example', 'pro'),
    { id: 'admin', role: 'admin', fullName: 'Collabify Team', email: 'admin@collabify.demo' },
  ];

  const db: DemoDb = { users, projects: [], applications: [], contracts: [], deliveries: [], reviews: [], messages: [], notifications: [], invites: [] };

  const project = (
    id: string, businessId: string, title: string, category: string, brief: string, budget: number, hours: number, days: number,
    skills: string[], status: DemoDb['projects'][number]['status'], createdDaysAgo: number, featured = false,
  ) => db.projects.push({
    id, businessId, title, category, brief, budgetPence: budget * 100, estimatedHours: hours, durationDays: days, skills, status, featuredUntil: featured ? daysAhead(5) : null,
    createdAt: daysAgo(createdDaysAgo),
  });

  project('p_logo', 'b_dan', 'Logo and brand kit', 'Design',
    'What we need\nA friendly, trustworthy logo for a bookkeeping app for freelancers.\n\nDeliverables\n• 2–3 concepts\n• Final logo (SVG, PNG)\n• One-page brand guide',
    300, 18, 10, ['Branding', 'Figma', 'Illustrator'], 'open', 1, true);
  project('p_portal', 'b_sara', 'Subscription account page', 'Development',
    'What we need\nA page where customers can pause, skip or change their coffee subscription, built in React against our existing API.\n\nDeliverables\n• Working code in our repo\n• Preview link',
    900, 60, 28, ['React', 'JavaScript', 'CSS'], 'open', 2);
  project('p_research', 'b_dan', 'Competitor pricing research', 'Research',
    'What we need\nMap 12 competitors: pricing, features and positioning.\n\nDeliverables\n• Spreadsheet\n• One-page summary',
    180, 12, 7, ['Research', 'Excel'], 'open', 3);
  project('p_survey', 'b_sara', 'Customer survey insights', 'Data',
    'What we need\nAnalyse 1,400 survey responses and tell us what our customers want next.\n\nDeliverables\n• Charts\n• Short slide deck',
    280, 16, 14, ['Data analysis', 'Excel', 'Python'], 'open', 4);
  project('p_social', 'b_sara', 'Two weeks of TikTok content', 'Social media',
    'What we need\nPlan, film and post short videos for our launch.\n\nDeliverables\n• Content calendar\n• 8 posts',
    450, 30, 14, ['Social media', 'TikTok', 'Canva'], 'in_progress', 9);
  project('p_landing', 'b_sara', 'Launch landing page', 'Development',
    'What we need\nA fast, mobile-first landing page with a waitlist form.',
    450, 30, 14, ['React', 'CSS', 'Figma'], 'completed', 40);
  project('p_churn', 'b_dan', 'Churn dashboard', 'Data',
    'What we need\nFind why customers cancel and build a dashboard we can keep updating.',
    550, 35, 21, ['Python', 'Data analysis'], 'delivered', 20);

  const apply = (id: string, projectId: string, studentId: string, pitch: string, status: DemoDb['applications'][number]['status'], d: number) =>
    db.applications.push({ id, projectId, studentId, pitch, status, createdAt: daysAgo(d) });
  apply('a1', 'p_logo', 's_ravi', 'Branding is my thing. I’d start with a quick call, then show you three directions.', 'shortlisted', 1);
  apply('a2', 'p_logo', 's_maya', 'I’ve designed identities for two student startups and work fully in Figma.', 'applied', 0);
  apply('a3', 'p_portal', 's_maya', 'This is exactly my stack. I built a similar portal during my internship.', 'applied', 1);
  apply('a4', 'p_social', 's_tom', 'I grew my society TikTok to 20k. I have three content ideas already.', 'hired', 8);
  apply('a5', 'p_landing', 's_maya', 'I can match your Figma designs pixel for pixel.', 'hired', 39);
  apply('a6', 'p_churn', 's_lena', 'Churn modelling is the topic of my dissertation.', 'hired', 19);

  const contract = (
    id: string, projectId: string, businessId: string, studentId: string, budget: number, plan: 'free' | 'pro' | 'scale',
    status: DemoDb['contracts'][number]['status'], created: number, extra: Partial<DemoDb['contracts'][number]> = {},
  ) => {
    const f = feeFor(budget * 100, plan);
    db.contracts.push({
      id, projectId, businessId, studentId, amountPence: f.amountPence, feeRate: f.feeRate, feePence: f.feePence, totalPence: f.totalPence,
      status, fundedAt: null, deliveredAt: null, releasedAt: null, autoReleaseAt: null, createdAt: daysAgo(created),
      revisionCount: 0, issueReason: null, issueRaisedBy: null, ...extra,
    });
  };
  contract('c_social', 'p_social', 'b_sara', 's_tom', 450, 'free', 'funded', 7, { fundedAt: daysAgo(7) });
  contract('c_landing', 'p_landing', 'b_sara', 's_maya', 450, 'free', 'released', 38, { fundedAt: daysAgo(38), deliveredAt: daysAgo(26), releasedAt: daysAgo(25) });
  contract('c_churn', 'p_churn', 'b_dan', 's_lena', 550, 'pro', 'delivered', 18, { fundedAt: daysAgo(18), deliveredAt: daysAgo(2), autoReleaseAt: daysAhead(5) });

  db.deliveries.push(
    { id: 'd1', contractId: 'c_landing', message: 'Live at the preview link. Repo shared with you.', files: ['landing-page.zip'], createdAt: daysAgo(26) },
    { id: 'd2', contractId: 'c_churn', message: 'Dashboard is shared, and the write-up is attached. Three main churn drivers inside.', files: ['churn-report.pdf'], createdAt: daysAgo(2) },
  );
  db.reviews.push(
    { id: 'r1', contractId: 'c_landing', reviewerId: 'b_sara', revieweeId: 's_maya', rating: 5, comment: 'Fast, clear and the page looks better than our designs.', createdAt: daysAgo(25) },
    { id: 'r2', contractId: 'c_landing', reviewerId: 's_maya', revieweeId: 'b_sara', rating: 5, comment: 'Clear brief and quick feedback. Great first client.', createdAt: daysAgo(24) },
  );
  db.messages.push(
    { id: 'm1', contractId: 'c_social', senderId: 'b_sara', body: 'Welcome aboard Tom! Coffee and props are on their way.', createdAt: daysAgo(7) },
    { id: 'm2', contractId: 'c_social', senderId: 's_tom', body: 'Amazing, thanks! First draft calendar coming tomorrow.', createdAt: daysAgo(6) },
  );
  const note = (userId: string, kind: string, title: string, body: string, link: string, hoursAgo: number, read = false) =>
    db.notifications.push({ id: `n_${db.notifications.length + 1}`, userId, kind, title, body, link, readAt: read ? daysAgo(0, hoursAgo) : null, createdAt: daysAgo(0, hoursAgo) });
  note('b_sara', 'application', 'New applicant', 'Maya Patel applied to Subscription account page.', '/project/p_portal', 20);
  note('b_sara', 'message', 'Tom Okafor', 'Amazing, thanks! First draft calendar coming tomorrow.', '/chat/c_social', 140, true);
  note('s_tom', 'funded', 'Payment held: start work', '£450 is held for Two weeks of TikTok content.', '/contract/c_social', 168, true);
  note('s_maya', 'paid', 'You\u2019ve been paid £450', 'Launch landing page is complete. Leave Brewbox (demo) a review.', '/contract/c_landing', 600, true);
  note('s_ravi', 'shortlisted', 'You\u2019re on the shortlist', 'Logo and brand kit \u00b7 £300', '/project/p_logo', 22);
  note('b_dan', 'delivered', 'Work delivered', 'Lena Fischer delivered Churn dashboard. It\u2019s paid automatically in 7 days unless you ask for changes.', '/contract/c_churn', 48);
  db.invites.push({ projectId: 'p_survey', studentId: 's_lena', createdAt: daysAgo(0, 5) });
  note('s_lena', 'invited', 'You\u2019re invited to apply', 'Brewbox (demo) would like you to apply for Customer survey insights \u00b7 £280.', '/project/p_survey', 5);
  return db;
}
