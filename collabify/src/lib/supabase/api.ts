import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError, type Api } from '../api';
import { isUkUniversityEmail, type Plan } from '../fees';
import { matchScore } from '../matching';
import { templateBrief } from '../brief';
import type {
  Application, Brief, Business, Contract, Delivery, Message, Profile, Project, Review, Student, StudentPrivate,
} from '../types';

/**
 * Supabase implementation of the Api. Rules are enforced in Postgres (RLS, check constraints and
 * security-definer functions in supabase/migrations); this file only maps rows to app types.
 * Money movement goes through Edge Functions, never the client.
 */

type Row = Record<string, any>;

const PROJECT_SELECT = '*, business:businesses(company_name)';
const CONTRACT_SELECT = '*, project:projects(title), business:businesses(company_name), student:students(profile:profiles(full_name))';
const STUDENT_SELECT = '*, profile:profiles(full_name)';

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((l) => l());

  // Live chat and status changes: refresh screens when rows change.
  sb.channel('collabify-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, changed)
    .subscribe();
  sb.auth.onAuthStateChange(() => changed());

  const fail = (error: { message: string } | null) => {
    if (error) throw new ApiError(error.message.replace(/^.*?: /, ''));
  };
  const uid = async () => {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new ApiError('Please sign in');
    return data.user.id;
  };
  const write = async <T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => {
    const { data, error } = await p;
    fail(error);
    changed();
    return data;
  };

  const rating = async (id: string) => {
    const { data } = await sb.rpc('user_rating', { p_user_id: id });
    const r = (data as Row[] | null)?.[0];
    return { average: r?.average != null ? Number(r.average) : null, count: Number(r?.count ?? 0) };
  };
  const toStudent = async (r: Row): Promise<Student> => {
    const [rt, done] = await Promise.all([rating(r.id), sb.rpc('completed_count', { p_student_id: r.id })]);
    return {
      id: r.id, fullName: r.profile?.full_name ?? '', university: r.university, course: r.course, year: r.year,
      skills: r.skills ?? [], bio: r.bio, portfolioUrl: r.portfolio_url,
      verified: true, // every student row is created by complete_onboarding after .ac.uk verification
      rating: rt, completedCount: Number(done.data ?? 0),
    };
  };
  const toProject = async (r: Row): Promise<Project> => {
    const { data: count } = await sb.rpc('applicant_count', { p_project_id: r.id });
    return {
      id: r.id, businessId: r.business_id, companyName: r.business?.company_name ?? '', title: r.title, category: r.category,
      brief: r.brief, budgetPence: r.budget_pence, estimatedHours: Number(r.estimated_hours), durationDays: r.duration_days,
      skills: r.skills ?? [], status: r.status, featured: r.featured, createdAt: r.created_at, applicantCount: Number(count ?? 0),
    };
  };
  const toContract = (r: Row): Contract => ({
    id: r.id, projectId: r.project_id, projectTitle: r.project?.title ?? '', businessId: r.business_id,
    companyName: r.business?.company_name ?? '', studentId: r.student_id, studentName: r.student?.profile?.full_name ?? '',
    amountPence: r.amount_pence, feeRate: Number(r.fee_rate), feePence: r.fee_pence, totalPence: r.total_pence,
    status: r.status, fundedAt: r.funded_at, deliveredAt: r.delivered_at, releasedAt: r.released_at,
    autoReleaseAt: r.auto_release_at, createdAt: r.created_at,
  });
  const toApplication = async (r: Row): Promise<Application> => ({
    id: r.id, projectId: r.project_id, projectTitle: r.project?.title ?? '', studentId: r.student_id,
    student: await toStudent(r.student), pitch: r.pitch, status: r.status, createdAt: r.created_at,
  });
  const APPLICATION_SELECT = `*, project:projects(title), student:students(${STUDENT_SELECT})`;
  const toReview = (r: Row): Review => ({
    id: r.id, contractId: r.contract_id, reviewerId: r.reviewer_id, revieweeId: r.reviewee_id,
    rating: r.rating, comment: r.comment, createdAt: r.created_at,
  });

  const api: Api = {
    mode: 'supabase',
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    // ---------- Auth (email one-time code) ----------
    async getSession() {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!p) return null; // signed in but not onboarded yet
      return { id: p.id, role: p.role, fullName: p.full_name, email: user.email ?? '' } satisfies Profile;
    },
    async requestCode(email, role) {
      if (role === 'student' && !isUkUniversityEmail(email)) throw new ApiError('Use your university email ending in .ac.uk');
      const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      fail(error);
      return {};
    },
    async verifyCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      fail(error);
      return { profile: await api.getSession() };
    },
    async completeOnboarding(input) {
      const params = input.role === 'student'
        ? { p_role: 'student', p_full_name: input.fullName, p_university: input.university, p_course: input.course, p_year: input.year, p_skills: input.skills }
        : { p_role: 'business', p_full_name: input.fullName, p_company_name: input.companyName, p_website: input.website };
      await write(sb.rpc('complete_onboarding', params));
      const profile = await api.getSession();
      if (!profile) throw new ApiError('Could not finish sign-up');
      return profile;
    },
    async signOut() {
      await sb.auth.signOut();
      changed();
    },

    // ---------- People ----------
    async getStudent(id) {
      const { data } = await sb.from('students').select(STUDENT_SELECT).eq('id', id).maybeSingle();
      return data ? toStudent(data) : null;
    },
    async getMyStudentPrivate() {
      const { data } = await sb.from('student_private').select('*').eq('id', await uid()).maybeSingle();
      if (!data) return null;
      return {
        universityEmail: data.university_email, payoutsEnabled: data.payouts_enabled,
        rightToWorkStatus: data.right_to_work_status, verifiedAt: data.verified_at,
      } satisfies StudentPrivate;
    },
    async updateMyStudent(patch) {
      const row: Row = {};
      if (patch.university !== undefined) row.university = patch.university;
      if (patch.course !== undefined) row.course = patch.course;
      if (patch.year !== undefined) row.year = patch.year;
      if (patch.skills !== undefined) row.skills = patch.skills;
      if (patch.bio !== undefined) row.bio = patch.bio;
      if (patch.portfolioUrl !== undefined) row.portfolio_url = patch.portfolioUrl;
      await write(sb.from('students').update(row).eq('id', await uid()));
    },
    async startPayoutSetup() {
      const { data, error } = await sb.functions.invoke('connect-onboarding', { body: {} });
      fail(error);
      return { url: data?.url };
    },
    async getBusiness(id) {
      const { data } = await sb.from('businesses').select('*, profile:profiles(full_name)').eq('id', id).maybeSingle();
      if (!data) return null;
      return {
        id: data.id, fullName: data.profile?.full_name ?? '', companyName: data.company_name, website: data.website,
        plan: data.plan, rating: await rating(data.id),
      } satisfies Business;
    },
    async updateMyBusiness(patch) {
      const row: Row = {};
      if (patch.companyName !== undefined) row.company_name = patch.companyName;
      if (patch.website !== undefined) row.website = patch.website;
      await write(sb.from('businesses').update(row).eq('id', await uid()));
    },
    async changePlan(plan: Plan) {
      // Subscriptions are sold on the web (Stripe Billing), not through in-app purchase.
      const web = process.env.EXPO_PUBLIC_WEB_URL;
      if (!web) throw new ApiError('Plan changes are not available yet');
      return { url: `${web.replace(/\/$/, '')}/billing?plan=${plan}` };
    },

    // ---------- Projects ----------
    async listOpenProjects(filter = {}) {
      let q = sb.from('projects').select(PROJECT_SELECT).eq('status', 'open')
        .order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(100);
      if (filter.category) q = q.eq('category', filter.category);
      const search = filter.search?.trim().replace(/[%,()]/g, ' ');
      if (search) q = q.or(`title.ilike.%${search}%,brief.ilike.%${search}%`);
      const { data, error } = await q;
      fail(error);
      return Promise.all((data ?? []).map(toProject));
    },
    async getProject(id) {
      const { data } = await sb.from('projects').select(PROJECT_SELECT).eq('id', id).maybeSingle();
      return data ? toProject(data) : null;
    },
    async listMyProjects() {
      const { data, error } = await sb.from('projects').select(PROJECT_SELECT).eq('business_id', await uid()).order('created_at', { ascending: false });
      fail(error);
      return Promise.all((data ?? []).map(toProject));
    },
    async createProject(input) {
      const row = await write(
        sb.from('projects').insert({
          business_id: await uid(), title: input.title.trim(), category: input.category, brief: input.brief.trim(),
          budget_pence: input.budgetPence, estimated_hours: input.estimatedHours, duration_days: input.durationDays, skills: input.skills,
        }).select(PROJECT_SELECT).single(),
      );
      return toProject(row as Row);
    },
    async writeBrief(idea, category) {
      const { data, error } = await sb.functions.invoke('write-brief', { body: { idea, category } });
      if (error || !data?.title) return templateBrief(idea, category);
      return data as Brief;
    },

    // ---------- Applications ----------
    async apply(projectId, pitch) {
      await write(sb.from('applications').insert({ project_id: projectId, student_id: await uid(), pitch: pitch.trim() }));
    },
    async getMyApplication(projectId) {
      const { data } = await sb.from('applications').select(APPLICATION_SELECT).eq('project_id', projectId).eq('student_id', await uid()).maybeSingle();
      return data ? toApplication(data) : null;
    },
    async listMyApplications() {
      const { data, error } = await sb.from('applications').select(APPLICATION_SELECT).eq('student_id', await uid()).order('created_at', { ascending: false });
      fail(error);
      return Promise.all((data ?? []).map(toApplication));
    },
    async listApplicants(projectId) {
      const [{ data, error }, project] = await Promise.all([
        sb.from('applications').select(APPLICATION_SELECT).eq('project_id', projectId),
        api.getProject(projectId),
      ]);
      fail(error);
      const apps = await Promise.all((data ?? []).map(toApplication));
      const order = { hired: 0, shortlisted: 1, applied: 2, declined: 3 } as const;
      return apps.sort((a, b) => order[a.status] - order[b.status] || (project ? matchScore(project, b.student) - matchScore(project, a.student) : 0));
    },
    async setApplicationStatus(applicationId, status) {
      await write(sb.rpc('set_application_status', { p_application_id: applicationId, p_status: status }));
    },
    async hire(applicationId) {
      const row = (await write(sb.rpc('hire_student', { p_application_id: applicationId }))) as Row;
      const c = await api.getContract(row.id);
      if (!c) throw new ApiError('Contract not found');
      return c;
    },

    // ---------- Contracts ----------
    async listMyContracts() {
      const me = await uid();
      const { data, error } = await sb.from('contracts').select(CONTRACT_SELECT).or(`business_id.eq.${me},student_id.eq.${me}`).order('created_at', { ascending: false });
      fail(error);
      return (data ?? []).map(toContract);
    },
    async getContract(id) {
      const { data } = await sb.from('contracts').select(CONTRACT_SELECT).eq('id', id).maybeSingle();
      return data ? toContract(data) : null;
    },
    async getContractForProject(projectId) {
      const { data } = await sb.from('contracts').select(CONTRACT_SELECT).eq('project_id', projectId).maybeSingle();
      return data ? toContract(data) : null;
    },
    async fundContract(contractId) {
      const { data, error } = await sb.functions.invoke('fund-contract', { body: { contractId } });
      fail(error);
      return { checkoutUrl: data?.url };
    },
    async deliver(contractId, message, files) {
      const paths: string[] = [];
      for (const f of files) {
        const path = `${contractId}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, '_')}`;
        const blob = await (await fetch(f.uri)).blob();
        const { error } = await sb.storage.from('deliveries').upload(path, blob);
        fail(error);
        paths.push(path);
      }
      await write(sb.rpc('deliver_contract', { p_contract_id: contractId, p_message: message, p_file_paths: paths }));
    },
    async listDeliveries(contractId) {
      const { data, error } = await sb.from('deliveries').select('*').eq('contract_id', contractId).order('created_at');
      fail(error);
      return (data ?? []).map((d): Delivery => ({ id: d.id, contractId: d.contract_id, message: d.message, files: d.file_paths, createdAt: d.created_at }));
    },
    async approve(contractId) {
      const { error } = await sb.functions.invoke('release-payment', { body: { contractId } });
      fail(error);
      changed();
    },
    async raiseIssue(contractId, reason) {
      await write(sb.rpc('raise_issue', { p_contract_id: contractId, p_reason: reason }));
    },

    // ---------- Reviews ----------
    async submitReview(contractId, ratingValue, comment) {
      await write(sb.rpc('submit_review', { p_contract_id: contractId, p_rating: ratingValue, p_comment: comment }));
    },
    async getContractReviews(contractId) {
      const me = await uid();
      // RLS hides the other side's review until both are in.
      const { data } = await sb.from('reviews').select('*').eq('contract_id', contractId);
      const rows = (data ?? []).map(toReview);
      const mine = rows.find((r) => r.reviewerId === me) ?? null;
      const theirs = rows.find((r) => r.reviewerId !== me) ?? null;
      return { mine, theirs, theirsSubmitted: Boolean(theirs) };
    },
    async listReviewsFor(userId) {
      const { data } = await sb.from('reviews').select('*').eq('reviewee_id', userId).order('created_at', { ascending: false });
      // Only fully revealed reviews are public: drop the viewer's own unrevealed one.
      const rows = (data ?? []).map(toReview);
      const revealed = await Promise.all(rows.map(async (r) => (await sb.rpc('contract_fully_reviewed', { cid: r.contractId })).data === true));
      return rows.filter((_, i) => revealed[i]);
    },

    // ---------- Messages ----------
    async listMessages(contractId) {
      const { data, error } = await sb.from('messages').select('*').eq('contract_id', contractId).order('created_at');
      fail(error);
      return (data ?? []).map((m): Message => ({ id: m.id, contractId: m.contract_id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }));
    },
    async sendMessage(contractId, body) {
      if (!body.trim()) return;
      await write(sb.from('messages').insert({ contract_id: contractId, sender_id: await uid(), body: body.trim() }));
    },

    // ---------- Admin ----------
    async adminOverview() {
      const { data: metrics, error } = await sb.rpc('admin_metrics');
      fail(error);
      const [projects, studentRows] = await Promise.all([
        api.listOpenProjects(),
        sb.from('students').select(STUDENT_SELECT).limit(500),
      ]);
      const students = await Promise.all((studentRows.data ?? []).map(toStudent));
      const { data: apps } = await sb.from('applications').select('project_id, student_id');
      const applied = new Set((apps ?? []).map((a) => `${a.project_id}:${a.student_id}`));
      return {
        metrics: metrics as Awaited<ReturnType<Api['adminOverview']>>['metrics'],
        unmatched: projects.map((project) => ({
          project,
          suggestions: students
            .filter((s) => !applied.has(`${project.id}:${s.id}`))
            .map((s) => ({ student: s, score: matchScore(project, s) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3),
        })),
      };
    },
    async adminShortlist(projectId, studentId) {
      await write(sb.rpc('admin_shortlist', { p_project_id: projectId, p_student_id: studentId }));
    },
  };
  return api;
}
