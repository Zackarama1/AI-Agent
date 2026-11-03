import { ApiError, type Api, type OnboardingInput } from '../api';
import { AUTO_RELEASE_DAYS, FEATURED_DAYS, feeFor, formatGBP, isUkUniversityEmail, meetsMinimumRate, type Plan } from '../fees';
import { matchScore } from '../matching';
import { templateBrief } from '../brief';
import type {
  AppNotification, Application, ApplicationStatus, Business, Contract, ContractStatus, Delivery, Message, Profile, Project,
  ProjectStatus, Review, Role, Student, StudentPrivate,
} from '../types';
import { seed } from './seed';

/**
 * In-memory implementation of the Api, used whenever Supabase env vars are missing.
 * It enforces the same rules as the database (min rate, .ac.uk, who can do what),
 * so every screen can be clicked through realistically.
 */

export type DemoUser = Profile & {
  student?: Omit<Student, 'id' | 'fullName' | 'verified' | 'rating' | 'completedCount'> & { private: StudentPrivate };
  business?: Omit<Business, 'id' | 'fullName' | 'rating'>;
};
export type DemoProject = Omit<Project, 'companyName' | 'applicantCount' | 'featured'>;
export type DemoApplication = {
  id: string; projectId: string; studentId: string; pitch: string; status: ApplicationStatus; createdAt: string;
  /** Declined automatically when someone else was hired; restored if that hire is cancelled. */
  autoDeclined?: boolean;
};
export type DemoContract = Omit<Contract, 'projectTitle' | 'companyName' | 'studentName'>;

export type DemoDb = {
  users: DemoUser[];
  projects: DemoProject[];
  applications: DemoApplication[];
  contracts: DemoContract[];
  deliveries: Delivery[];
  reviews: Review[];
  messages: Message[];
  notifications: (AppNotification & { userId: string })[];
  invites: { projectId: string; studentId: string; createdAt: string }[];
};

const DEMO_CODE_LENGTH = 6;
const now = () => new Date().toISOString();

export function createDemoApi(db: DemoDb = seed()): Api {
  let currentId: string | null = null;
  const pendingCodes = new Map<string, { code: string; role: Role }>();
  const pendingSignups = new Map<string, Role>(); // email -> role, verified but not onboarded
  let verifiedEmail: string | null = null;
  const listeners = new Set<() => void>();
  let seq = 1000;
  const id = (p: string) => `${p}_${++seq}`;

  const changed = () => listeners.forEach((l) => l());
  const user = (uid: string) => db.users.find((u) => u.id === uid);
  const me = () => {
    const u = currentId ? user(currentId) : undefined;
    if (!u) throw new ApiError('Please sign in');
    return u;
  };
  const requireRole = (...roles: Role[]) => {
    const u = me();
    if (!roles.includes(u.role)) throw new ApiError('You can’t do that with this account');
    return u;
  };

  const ratingFor = (uid: string) => {
    // Blind reviews: only count reviews whose contract has both sides reviewed.
    const visible = db.reviews.filter((r) => r.revieweeId === uid && bothReviewed(r.contractId));
    if (!visible.length) return { average: null, count: 0 };
    const avg = visible.reduce((s, r) => s + r.rating, 0) / visible.length;
    return { average: Math.round(avg * 10) / 10, count: visible.length };
  };
  const bothReviewed = (contractId: string) => {
    const c = db.contracts.find((x) => x.id === contractId);
    if (!c) return false;
    const ids = new Set(db.reviews.filter((r) => r.contractId === contractId).map((r) => r.reviewerId));
    return ids.has(c.businessId) && ids.has(c.studentId);
  };

  const toStudent = (u: DemoUser): Student => ({
    id: u.id,
    fullName: u.fullName,
    university: u.student!.university,
    course: u.student!.course,
    year: u.student!.year,
    skills: u.student!.skills,
    bio: u.student!.bio,
    portfolioUrl: u.student!.portfolioUrl,
    verified: Boolean(u.student!.private.verifiedAt),
    rating: ratingFor(u.id),
    completedCount: db.contracts.filter((c) => c.studentId === u.id && c.status === 'released').length,
  });
  const toBusiness = (u: DemoUser): Business => ({
    id: u.id,
    fullName: u.fullName,
    companyName: u.business!.companyName,
    website: u.business!.website,
    plan: u.business!.plan,
    rating: ratingFor(u.id),
  });
  const isFeatured = (p: DemoProject) => Boolean(p.featuredUntil && new Date(p.featuredUntil) > new Date());
  const toProject = (p: DemoProject): Project => ({
    ...p,
    featured: isFeatured(p),
    companyName: user(p.businessId)?.business?.companyName ?? 'Unknown',
    applicantCount: db.applications.filter((a) => a.projectId === p.id && a.status !== 'declined').length,
  });
  const toApplication = (a: DemoApplication): Application => ({
    ...a,
    projectTitle: db.projects.find((p) => p.id === a.projectId)?.title ?? '',
    student: toStudent(user(a.studentId)!),
  });

  /** Payment is released automatically 7 days after delivery. */
  const autoRelease = (c: DemoContract) => {
    if (c.status === 'delivered' && c.autoReleaseAt && new Date(c.autoReleaseAt) <= new Date()) release(c);
    return c;
  };
  const release = (c: DemoContract) => {
    c.status = 'released';
    c.releasedAt = now();
    setProjectStatus(c.projectId, 'completed');
    const title = titleOf(c.projectId);
    notify(c.studentId, 'paid', `You\u2019ve been paid ${formatGBP(c.amountPence)}`, `${title} is complete. Leave ${companyOf(c.businessId)} a review.`, `/contract/${c.id}`);
    notify(c.businessId, 'completed', 'Project complete', `${title} is done. Leave ${nameOf(c.studentId)} a review.`, `/contract/${c.id}`);
  };
  const toContract = (c: DemoContract): Contract => {
    autoRelease(c);
    return {
      ...c,
      projectTitle: db.projects.find((p) => p.id === c.projectId)?.title ?? '',
      companyName: user(c.businessId)?.business?.companyName ?? '',
      studentName: user(c.studentId)?.fullName ?? '',
    };
  };
  const setProjectStatus = (projectId: string, status: ProjectStatus) => {
    const p = db.projects.find((x) => x.id === projectId);
    if (p) p.status = status;
  };
  const contractFor = (contractId: string) => {
    const u = me();
    const c = db.contracts.find((x) => x.id === contractId);
    if (!c) throw new ApiError('Contract not found');
    if (u.role !== 'admin' && c.businessId !== u.id && c.studentId !== u.id) throw new ApiError('Not your contract');
    return c;
  };
  const setContractStatus = (c: DemoContract, status: ContractStatus) => {
    c.status = status;
  };

  // Mirrors the notification triggers in supabase/migrations/20261106000000_notifications.sql.
  const notify = (userId: string, kind: string, title: string, body: string, link: string) => {
    const u = user(userId);
    if (!u || u.email.startsWith('deleted-')) return;
    db.notifications.push({ id: id('n'), userId, kind, title, body, link, readAt: null, createdAt: now() });
  };
  const titleOf = (projectId: string) => db.projects.find((p) => p.id === projectId)?.title ?? '';
  const nameOf = (userId: string) => user(userId)?.fullName ?? '';
  const companyOf = (userId: string) => user(userId)?.business?.companyName ?? '';

  const api: Api = {
    mode: 'demo',
    refresh() {
      changed();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    // ---------- Auth ----------
    async getSession() {
      if (!currentId) return null;
      const { id: uid, role, fullName, email } = me();
      return { id: uid, role, fullName, email };
    },
    async requestCode(email, role) {
      const clean = email.trim().toLowerCase();
      const existing = db.users.find((u) => u.email === clean);
      if (existing && existing.role !== role && existing.role !== 'admin') {
        throw new ApiError(`This email is registered as a ${existing.role} account.`);
      }
      if (role === 'student' && !existing && !isUkUniversityEmail(clean)) {
        throw new ApiError('Use your university email ending in .ac.uk');
      }
      const code = String(Math.floor(Math.random() * 10 ** DEMO_CODE_LENGTH)).padStart(DEMO_CODE_LENGTH, '0');
      pendingCodes.set(clean, { code, role: existing?.role ?? role });
      return { devCode: code };
    },
    async verifyCode(email, code) {
      const clean = email.trim().toLowerCase();
      const pending = pendingCodes.get(clean);
      if (!pending || pending.code !== code.trim()) throw new ApiError('That code isn’t right. Check it and try again.');
      pendingCodes.delete(clean);
      const existing = db.users.find((u) => u.email === clean);
      if (existing) {
        currentId = existing.id;
        changed();
        return { profile: { id: existing.id, role: existing.role, fullName: existing.fullName, email: existing.email } };
      }
      verifiedEmail = clean;
      pendingSignups.set(clean, pending.role);
      return { profile: null };
    },
    async completeOnboarding(input: OnboardingInput) {
      if (!verifiedEmail) throw new ApiError('Verify your email first');
      const role = pendingSignups.get(verifiedEmail);
      if (role !== input.role) throw new ApiError('Account type mismatch');
      const u: DemoUser = { id: id('u'), role: input.role, fullName: input.fullName.trim(), email: verifiedEmail };
      if (input.role === 'student') {
        u.student = {
          university: input.university, course: input.course, year: input.year, skills: input.skills, bio: '', portfolioUrl: '',
          // Signing in with a code sent to a .ac.uk address verifies the student.
          private: { universityEmail: verifiedEmail, payoutsEnabled: false, rightToWorkStatus: 'unknown', verifiedAt: now() },
        };
      } else {
        u.business = { companyName: input.companyName, website: input.website, plan: 'free' };
      }
      db.users.push(u);
      pendingSignups.delete(verifiedEmail);
      verifiedEmail = null;
      currentId = u.id;
      changed();
      return { id: u.id, role: u.role, fullName: u.fullName, email: u.email };
    },
    async deleteAccount() {
      const u = me();
      if (db.contracts.some((c) => (c.businessId === u.id || c.studentId === u.id) && ['funded', 'delivered', 'disputed'].includes(c.status))) {
        throw new ApiError('You have a project with payment held. Finish it, or report a problem, before deleting your account.');
      }
      for (const c of db.contracts.filter((x) => x.status === 'awaiting_funding' && (x.businessId === u.id || x.studentId === u.id))) {
        c.status = 'cancelled';
        if (c.studentId === u.id) {
          setProjectStatus(c.projectId, 'open');
          db.applications.filter((a) => a.projectId === c.projectId && a.autoDeclined).forEach((a) => { a.status = 'applied'; a.autoDeclined = false; });
        }
      }
      for (const p of db.projects.filter((x) => x.businessId === u.id && ['open', 'in_progress'].includes(x.status))) {
        p.status = 'cancelled';
        p.featuredUntil = null;
        db.applications.filter((a) => a.projectId === p.id && a.status !== 'hired').forEach((a) => (a.status = 'declined'));
      }
      db.applications = db.applications.filter((a) => !(a.studentId === u.id && ['applied', 'shortlisted'].includes(a.status)));
      if (u.student) {
        Object.assign(u.student, { university: '', course: '', year: '', skills: [], bio: '', portfolioUrl: '' });
        u.student.private = { ...u.student.private, universityEmail: '', payoutsEnabled: false, verifiedAt: null };
      }
      if (u.business) Object.assign(u.business, { companyName: 'Deleted business', website: '', plan: 'free' });
      u.fullName = 'Deleted user';
      u.email = `deleted-${u.id}`; // frees the email for a new sign-up
      currentId = null;
      changed();
    },
    async signOut() {
      currentId = null;
      changed();
    },

    // ---------- People ----------
    async getStudent(sid) {
      const u = user(sid);
      return u?.student ? toStudent(u) : null;
    },
    async getMyStudentPrivate() {
      const u = me();
      return u.student ? { ...u.student.private } : null;
    },
    async updateMyStudent(patch) {
      const u = requireRole('student');
      Object.assign(u.student!, patch);
      changed();
    },
    async startPayoutSetup() {
      const u = requireRole('student');
      u.student!.private.payoutsEnabled = true; // demo: pretend Stripe onboarding finished
      changed();
      return {};
    },
    async getBusiness(bid) {
      const u = user(bid);
      return u?.business ? toBusiness(u) : null;
    },
    async updateMyBusiness(patch) {
      const u = requireRole('business');
      Object.assign(u.business!, patch);
      changed();
    },
    async changePlan(plan: Plan) {
      const u = requireRole('business');
      u.business!.plan = plan;
      changed();
      return {};
    },

    // ---------- Projects ----------
    async listOpenProjects(filter = {}) {
      const q = filter.search?.trim().toLowerCase() ?? '';
      return db.projects
        .filter((p) => p.status === 'open')
        .filter((p) => !filter.category || p.category === filter.category)
        .filter((p) => !q || `${p.title} ${p.brief} ${p.skills.join(' ')}`.toLowerCase().includes(q))
        .sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a)) || b.createdAt.localeCompare(a.createdAt))
        .map(toProject);
    },
    async getProject(pid) {
      const p = db.projects.find((x) => x.id === pid);
      return p ? toProject(p) : null;
    },
    async listMyProjects() {
      const u = requireRole('business');
      return db.projects.filter((p) => p.businessId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toProject);
    },
    async createProject(input) {
      const u = requireRole('business');
      if (input.title.trim().length < 5) throw new ApiError('Give your project a clearer title');
      if (input.brief.trim().length < 30) throw new ApiError('Add a bit more detail to the brief');
      if (!(input.estimatedHours > 0)) throw new ApiError('Estimate how many hours this will take');
      if (!meetsMinimumRate(input.budgetPence, input.estimatedHours)) {
        throw new ApiError('Budget is below the £12.71/hour minimum for the estimated hours');
      }
      const p: DemoProject = {
        id: id('p'), businessId: u.id, title: input.title.trim(), category: input.category, brief: input.brief.trim(),
        budgetPence: input.budgetPence, estimatedHours: input.estimatedHours, durationDays: input.durationDays,
        skills: input.skills, status: 'open', featuredUntil: null, createdAt: now(),
      };
      db.projects.push(p);
      changed();
      return toProject(p);
    },
    async writeBrief(idea, category) {
      await new Promise((r) => setTimeout(r, 400));
      return templateBrief(idea, category);
    },
    async featureProject(projectId) {
      const u = requireRole('business');
      const p = db.projects.find((x) => x.id === projectId);
      if (!p || p.businessId !== u.id) throw new ApiError('Not your project');
      if (p.status !== 'open') throw new ApiError('Only open projects can be featured');
      const from = isFeatured(p) ? new Date(p.featuredUntil!).getTime() : Date.now();
      p.featuredUntil = new Date(from + FEATURED_DAYS * 86400000).toISOString();
      changed();
      return {};
    },
    async cancelProject(projectId) {
      const u = requireRole('business');
      const p = db.projects.find((x) => x.id === projectId);
      if (!p || p.businessId !== u.id) throw new ApiError('Not your project');
      if (p.status !== 'open') throw new ApiError('Only open projects can be cancelled');
      p.status = 'cancelled';
      p.featuredUntil = null;
      db.applications.filter((a) => a.projectId === p.id && a.status !== 'declined').forEach((a) => {
        a.status = 'declined';
        notify(a.studentId, 'closed', 'Project closed', `${p.title} was closed by the business.`, `/project/${p.id}`);
      });
      changed();
    },

    // ---------- Applications ----------
    async apply(projectId, pitch) {
      const u = requireRole('student');
      const p = db.projects.find((x) => x.id === projectId);
      if (!p || p.status !== 'open') throw new ApiError('This project isn’t taking applications');
      if (pitch.trim().length < 20) throw new ApiError('Write a couple of sentences about why you’re a good fit');
      if (db.applications.some((a) => a.projectId === projectId && a.studentId === u.id)) throw new ApiError('You’ve already applied');
      db.applications.push({ id: id('a'), projectId, studentId: u.id, pitch: pitch.trim(), status: 'applied', createdAt: now() });
      notify(p.businessId, 'application', 'New applicant', `${u.fullName} applied to ${p.title}.`, `/project/${p.id}`);
      changed();
    },
    async getMyApplication(projectId) {
      const u = me();
      const a = db.applications.find((x) => x.projectId === projectId && x.studentId === u.id);
      return a ? toApplication(a) : null;
    },
    async listMyApplications() {
      const u = requireRole('student');
      return db.applications.filter((a) => a.studentId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toApplication);
    },
    async listApplicants(projectId) {
      const u = requireRole('business', 'admin');
      const p = db.projects.find((x) => x.id === projectId);
      if (!p || (u.role !== 'admin' && p.businessId !== u.id)) throw new ApiError('Not your project');
      const order: Record<ApplicationStatus, number> = { hired: 0, shortlisted: 1, applied: 2, declined: 3 };
      return db.applications
        .filter((a) => a.projectId === projectId)
        .map(toApplication)
        .sort((a, b) => order[a.status] - order[b.status] || matchScore(p, b.student) - matchScore(p, a.student));
    },
    async setApplicationStatus(applicationId, status) {
      const u = requireRole('business');
      const a = db.applications.find((x) => x.id === applicationId);
      const p = a && db.projects.find((x) => x.id === a.projectId);
      if (!a || !p || p.businessId !== u.id) throw new ApiError('Not your project');
      if (a.status === 'hired') throw new ApiError('This student is already hired');
      if (status === 'shortlisted' && a.status === 'applied') {
        notify(a.studentId, 'shortlisted', 'You\u2019re on the shortlist', `${p.title} \u00b7 ${formatGBP(p.budgetPence)}`, `/project/${p.id}`);
      } else if (status === 'declined' && a.status !== 'declined') {
        notify(a.studentId, 'declined', 'Not this time', `Your application to ${p.title} wasn\u2019t selected.`, `/project/${p.id}`);
      }
      a.status = status;
      changed();
    },
    async withdrawApplication(applicationId) {
      const u = requireRole('student');
      const i = db.applications.findIndex((x) => x.id === applicationId && x.studentId === u.id);
      if (i < 0) throw new ApiError('Application not found');
      if (!['applied', 'shortlisted'].includes(db.applications[i].status)) throw new ApiError('You can\u2019t withdraw this application');
      db.applications.splice(i, 1);
      changed();
    },
    async suggestStudents(projectId) {
      const u = requireRole('business');
      const p = db.projects.find((x) => x.id === projectId);
      if (!p || p.businessId !== u.id) throw new ApiError('Not your project');
      return db.users
        .filter((x) => x.role === 'student' && !x.email.startsWith('deleted-'))
        .filter((x) => !db.applications.some((a) => a.projectId === p.id && a.studentId === x.id))
        .map((x) => {
          const student = toStudent(x);
          return { student, score: matchScore(p, student), invited: db.invites.some((i) => i.projectId === p.id && i.studentId === x.id) };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    },
    async inviteStudent(projectId, studentId) {
      const u = requireRole('business');
      const p = db.projects.find((x) => x.id === projectId);
      if (!p || p.businessId !== u.id) throw new ApiError('Not your project');
      if (p.status !== 'open') throw new ApiError('Only open projects can send invites');
      if (user(studentId)?.role !== 'student') throw new ApiError('You can only invite students');
      if (db.invites.some((i) => i.projectId === projectId && i.studentId === studentId)) throw new ApiError('Already invited');
      db.invites.push({ projectId, studentId, createdAt: now() });
      notify(studentId, 'invited', 'You\u2019re invited to apply', `${u.business!.companyName} would like you to apply for ${p.title} \u00b7 ${formatGBP(p.budgetPence)}.`, `/project/${p.id}`);
      changed();
    },
    async listMyInvites() {
      const u = requireRole('student');
      return db.invites.filter((i) => i.studentId === u.id).map((i) => i.projectId);
    },
    async hire(applicationId) {
      // Mirrors the hire_student() security-definer function in the database.
      const u = requireRole('business');
      const a = db.applications.find((x) => x.id === applicationId);
      const p = a && db.projects.find((x) => x.id === a.projectId);
      if (!a || !p || p.businessId !== u.id) throw new ApiError('Not your project');
      if (p.status !== 'open') throw new ApiError('You’ve already hired for this project');
      if (a.status === 'declined') throw new ApiError('You declined this applicant');
      const fee = feeFor(p.budgetPence, u.business!.plan);
      const c: DemoContract = {
        id: id('c'), projectId: p.id, businessId: u.id, studentId: a.studentId, amountPence: fee.amountPence,
        feeRate: fee.feeRate, feePence: fee.feePence, totalPence: fee.totalPence, status: 'awaiting_funding',
        fundedAt: null, deliveredAt: null, releasedAt: null, autoReleaseAt: null, createdAt: now(),
        revisionCount: 0, issueReason: null, issueRaisedBy: null,
      };
      db.contracts.push(c);
      a.status = 'hired';
      db.applications.filter((x) => x.projectId === p.id && x.id !== a.id && x.status !== 'declined').forEach((x) => {
        x.status = 'declined';
        x.autoDeclined = true;
        notify(x.studentId, 'filled', 'Project filled', `${p.title} went to another student. Keep applying!`, `/project/${p.id}`);
      });
      p.status = 'in_progress';
      notify(a.studentId, 'hired', 'You\u2019re hired!', `${u.business!.companyName} hired you for ${p.title}. Start once payment is held.`, `/contract/${c.id}`);
      changed();
      return toContract(c);
    },

    // ---------- Contracts ----------
    async listMyContracts() {
      const u = me();
      return db.contracts
        .filter((c) => c.businessId === u.id || c.studentId === u.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toContract);
    },
    async getContract(cid) {
      return toContract(contractFor(cid));
    },
    async getContractForProject(projectId) {
      const u = me();
      const c = db.contracts.find((x) => x.projectId === projectId && x.status !== 'cancelled' && (x.businessId === u.id || x.studentId === u.id || u.role === 'admin'));
      return c ? toContract(c) : null;
    },
    async fundContract(cid) {
      const c = contractFor(cid);
      if (c.businessId !== me().id) throw new ApiError('Only the business can pay');
      if (c.status !== 'awaiting_funding') throw new ApiError('This project is already paid for');
      await new Promise((r) => setTimeout(r, 600)); // feels like a checkout
      setContractStatus(c, 'funded');
      c.fundedAt = now();
      notify(c.studentId, 'funded', 'Payment held: start work', `${formatGBP(c.amountPence)} is held for ${titleOf(c.projectId)}.`, `/contract/${c.id}`);
      changed();
      return {};
    },
    async deliver(cid, message, files) {
      const c = contractFor(cid);
      if (c.studentId !== me().id) throw new ApiError('Only the student can deliver');
      if (c.status !== 'funded') throw new ApiError('You can deliver once payment is held');
      if (message.trim().length < 5 && files.length === 0) throw new ApiError('Add a message or a file');
      db.deliveries.push({ id: id('d'), contractId: c.id, message: message.trim(), files: files.map((f) => f.name), createdAt: now() });
      setContractStatus(c, 'delivered');
      c.deliveredAt = now();
      c.autoReleaseAt = new Date(Date.now() + AUTO_RELEASE_DAYS * 86400000).toISOString();
      setProjectStatus(c.projectId, 'delivered');
      notify(c.businessId, 'delivered', 'Work delivered', `${nameOf(c.studentId)} delivered ${titleOf(c.projectId)}. It\u2019s paid automatically in 7 days unless you ask for changes.`, `/contract/${c.id}`);
      changed();
    },
    async listDeliveries(cid) {
      contractFor(cid);
      return db.deliveries.filter((d) => d.contractId === cid);
    },
    async getDeliveryFileUrl() {
      return null; // demo mode keeps file names only
    },
    async requestChanges(cid, note) {
      const c = contractFor(cid);
      const u = me();
      if (c.businessId !== u.id) throw new ApiError('Only the business can ask for changes');
      if (c.status !== 'delivered') throw new ApiError('You can ask for changes after a delivery');
      if (note.trim().length < 10) throw new ApiError('Tell them what to change');
      setContractStatus(c, 'funded');
      c.autoReleaseAt = null;
      c.revisionCount += 1;
      setProjectStatus(c.projectId, 'in_progress');
      db.messages.push({ id: id('m'), contractId: c.id, senderId: u.id, body: `Changes requested: ${note.trim()}`, createdAt: now() });
      notify(c.studentId, 'changes', 'Changes requested', `${companyOf(c.businessId)} asked for changes to ${titleOf(c.projectId)}. Payment is still held for you.`, `/contract/${c.id}`);
      changed();
    },
    async cancelContract(cid) {
      const c = contractFor(cid);
      if (c.businessId !== me().id) throw new ApiError('Only the business can cancel');
      if (c.status !== 'awaiting_funding') throw new ApiError('Paid projects can\u2019t be cancelled. Report a problem instead.');
      setContractStatus(c, 'cancelled');
      setProjectStatus(c.projectId, 'open');
      for (const a of db.applications.filter((x) => x.projectId === c.projectId)) {
        if (a.studentId === c.studentId) a.status = 'shortlisted';
        else if (a.autoDeclined) {
          a.status = 'applied';
          a.autoDeclined = false;
        }
      }
      notify(c.studentId, 'cancelled', 'Hire cancelled', `${companyOf(c.businessId)} cancelled the hire for ${titleOf(c.projectId)} before paying.`, `/project/${c.projectId}`);
      changed();
    },
    async approve(cid) {
      const c = contractFor(cid);
      if (c.businessId !== me().id) throw new ApiError('Only the business can approve');
      if (c.status !== 'delivered') throw new ApiError('There’s nothing to approve yet');
      release(c);
      changed();
    },
    async raiseIssue(cid, reason) {
      const c = contractFor(cid);
      if (!['funded', 'delivered'].includes(c.status)) throw new ApiError('You can only raise an issue while payment is held');
      if (reason.trim().length < 10) throw new ApiError('Tell us a little more');
      setContractStatus(c, 'disputed');
      c.autoReleaseAt = null;
      c.issueReason = reason.trim();
      c.issueRaisedBy = me().id;
      const title = titleOf(c.projectId);
      notify(c.issueRaisedBy === c.studentId ? c.businessId : c.studentId, 'problem', 'A problem was reported', `On ${title}. The payment stays held while we help.`, `/contract/${c.id}`);
      db.users.filter((x) => x.role === 'admin').forEach((x) => notify(x.id, 'problem', 'Problem to resolve', `${title} \u00b7 ${formatGBP(c.amountPence)}`, `/contract/${c.id}`));
      changed();
    },

    // ---------- Reviews ----------
    async submitReview(cid, rating, comment) {
      const c = contractFor(cid);
      const u = me();
      if (c.status !== 'released') throw new ApiError('You can review once the project is complete');
      if (db.reviews.some((r) => r.contractId === cid && r.reviewerId === u.id)) throw new ApiError('You’ve already reviewed this project');
      if (!(rating >= 1 && rating <= 5)) throw new ApiError('Pick a rating');
      db.reviews.push({
        id: id('r'), contractId: cid, reviewerId: u.id, revieweeId: u.id === c.studentId ? c.businessId : c.studentId,
        rating, comment: comment.trim(), createdAt: now(),
      });
      const reviewee = u.id === c.studentId ? c.businessId : c.studentId;
      const title = titleOf(c.projectId);
      if (bothReviewed(cid)) {
        [u.id, reviewee].forEach((x) => notify(x, 'reviews', 'Reviews are in', `See what was said about ${title}.`, `/contract/${cid}`));
      } else {
        notify(reviewee, 'review_waiting', 'You\u2019ve got a review', `Leave yours for ${title} to see it.`, `/contract/${cid}`);
      }
      changed();
    },
    async getContractReviews(cid) {
      contractFor(cid);
      const u = me();
      const mine = db.reviews.find((r) => r.contractId === cid && r.reviewerId === u.id) ?? null;
      const theirsRow = db.reviews.find((r) => r.contractId === cid && r.reviewerId !== u.id) ?? null;
      return { mine, theirs: mine && theirsRow ? theirsRow : null, theirsSubmitted: Boolean(theirsRow) };
    },
    async listReviewsFor(uid) {
      return db.reviews.filter((r) => r.revieweeId === uid && bothReviewed(r.contractId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    // ---------- Messages ----------
    async listMessages(cid) {
      contractFor(cid);
      return db.messages.filter((m) => m.contractId === cid);
    },
    async sendMessage(cid, body) {
      const c = contractFor(cid);
      if (!body.trim()) return;
      const sender = me();
      db.messages.push({ id: id('m'), contractId: cid, senderId: sender.id, body: body.trim(), createdAt: now() });
      notify(sender.id === c.studentId ? c.businessId : c.studentId, 'message', sender.fullName, body.trim().slice(0, 120), `/chat/${cid}`);
      changed();
    },

    // ---------- Admin ----------
    async adminOverview() {
      requireRole('admin');
      const posted = db.projects.filter((p) => p.status !== 'cancelled');
      const hired = posted.filter((p) => db.contracts.some((c) => c.projectId === p.id));
      const hoursToMatch = hired
        .map((p) => {
          const c = db.contracts.find((x) => x.projectId === p.id)!;
          return (new Date(c.createdAt).getTime() - new Date(p.createdAt).getTime()) / 3600000;
        })
        .sort((a, b) => a - b);
      const byBusiness = new Map<string, number>();
      db.contracts.forEach((c) => byBusiness.set(c.businessId, (byBusiness.get(c.businessId) ?? 0) + 1));
      const paid = db.contracts.filter((c) => ['funded', 'delivered', 'released', 'disputed'].includes(c.status));
      const students = db.users.filter((u) => u.role === 'student').map(toStudent);
      return {
        metrics: {
          openProjects: posted.filter((p) => p.status === 'open').length,
          fillRate: posted.length ? hired.length / posted.length : 0,
          medianHoursToMatch: hoursToMatch.length ? Math.round(hoursToMatch[Math.floor(hoursToMatch.length / 2)]) : null,
          repeatClientRate: byBusiness.size ? [...byBusiness.values()].filter((n) => n > 1).length / byBusiness.size : 0,
          gmvPence: paid.reduce((s, c) => s + c.amountPence, 0),
          feeRevenuePence: paid.reduce((s, c) => s + c.feePence, 0),
        },
        unmatched: db.projects
          .filter((p) => p.status === 'open')
          .map((p) => ({
            project: toProject(p),
            suggestions: students
              .filter((s) => !db.applications.some((a) => a.projectId === p.id && a.studentId === s.id))
              .map((s) => ({ student: s, score: matchScore(p, s) }))
              .filter((x) => x.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3),
          })),
        disputes: db.contracts.filter((c) => c.status === 'disputed').map(toContract),
      };
    },
    async adminShortlist(projectId, studentId) {
      requireRole('admin');
      if (db.applications.some((a) => a.projectId === projectId && a.studentId === studentId)) throw new ApiError('Already on this project');
      db.applications.push({
        id: id('a'), projectId, studentId, status: 'shortlisted', createdAt: now(),
        pitch: 'Recommended by the Collabify team as a strong match for this project.',
      });
      const p = db.projects.find((x) => x.id === projectId);
      if (p) {
        notify(p.businessId, 'recommended', 'We found you a match', `${nameOf(studentId)} looks like a strong fit for ${p.title}.`, `/project/${p.id}`);
        notify(studentId, 'shortlisted', 'You\u2019re on a shortlist', `The Collabify team recommended you for ${p.title}.`, `/project/${p.id}`);
      }
      changed();
    },
    async adminResolve(cid, outcome) {
      requireRole('admin');
      const c = db.contracts.find((x) => x.id === cid);
      if (!c || c.status !== 'disputed') throw new ApiError('This project isn\u2019t under review');
      if (outcome === 'release') {
        release(c);
      } else {
        setContractStatus(c, 'refunded');
        setProjectStatus(c.projectId, 'cancelled');
        const title = titleOf(c.projectId);
        notify(c.businessId, 'refunded', 'Refunded', `You\u2019ve been refunded ${formatGBP(c.totalPence)} for ${title}.`, `/contract/${c.id}`);
        notify(c.studentId, 'refunded', 'Project closed', `${title} was closed and the business refunded.`, `/contract/${c.id}`);
      }
      changed();
    },

    // ---------- Notifications ----------
    async listNotifications() {
      const u = me();
      return db.notifications
        .filter((n) => n.userId === u.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ userId: _userId, ...n }) => n);
    },
    async markNotificationsRead() {
      const u = me();
      const at = now();
      db.notifications.filter((n) => n.userId === u.id && !n.readAt).forEach((n) => (n.readAt = at));
      changed();
    },
    async registerPushToken() {
      // Demo mode doesn't send push notifications.
    },
  };
  return api;
}
