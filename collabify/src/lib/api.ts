import type {
  AdminOverview, AppNotification, Application, Brief, Business, Contract, ContractReviews, Delivery, Message, NewProject,
  Profile, Project, Review, Role, Student, StudentPrivate,
} from './types';
import type { Plan } from './fees';

export type OnboardingInput =
  | { role: 'student'; fullName: string; university: string; course: string; year: string; skills: string[] }
  | { role: 'business'; fullName: string; companyName: string; website: string };

export type DeliveryFile = { name: string; uri: string };

/**
 * The one interface every screen talks to. Two implementations:
 * - demo: in-memory store with seeded, clearly fictional data (no env vars needed)
 * - supabase: Postgres + Auth + Storage + Edge Functions
 */
export interface Api {
  readonly mode: 'demo' | 'supabase';
  /** Fires after any write so screens can refresh. */
  onChange(cb: () => void): () => void;
  /** Ask every screen to reload (e.g. after returning from a Stripe page). */
  refresh(): void;

  // Auth
  getSession(): Promise<Profile | null>;
  requestCode(email: string, role: Role): Promise<{ devCode?: string }>;
  verifyCode(email: string, code: string): Promise<{ profile: Profile | null }>;
  completeOnboarding(input: OnboardingInput): Promise<Profile>;
  signOut(): Promise<void>;
  /** Delete the signed-in account. Refused while payment is held for one of their projects. */
  deleteAccount(): Promise<void>;

  // People
  getStudent(id: string): Promise<Student | null>;
  getMyStudentPrivate(): Promise<StudentPrivate | null>;
  updateMyStudent(patch: Partial<Pick<Student, 'university' | 'course' | 'year' | 'skills' | 'bio' | 'portfolioUrl'>>): Promise<void>;
  startPayoutSetup(): Promise<{ url?: string }>;
  getBusiness(id: string): Promise<Business | null>;
  updateMyBusiness(patch: Partial<Pick<Business, 'companyName' | 'website'>>): Promise<void>;
  /** Plans are sold on the web (Stripe Billing): returns a checkout or billing-portal URL. Demo mode switches instantly. */
  changePlan(plan: Plan): Promise<{ url?: string }>;

  // Projects
  listOpenProjects(filter?: { category?: string; search?: string }): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  listMyProjects(): Promise<Project[]>;
  createProject(input: NewProject): Promise<Project>;
  writeBrief(idea: string, category: string): Promise<Brief>;
  /** £19 to pin a project to the top for 7 days. Returns a checkout URL; demo mode features instantly. */
  featureProject(projectId: string): Promise<{ checkoutUrl?: string }>;
  /** Close an open project before anyone is hired. */
  cancelProject(projectId: string): Promise<void>;

  // Applications
  apply(projectId: string, pitch: string): Promise<void>;
  getMyApplication(projectId: string): Promise<Application | null>;
  listMyApplications(): Promise<Application[]>;
  listApplicants(projectId: string): Promise<Application[]>;
  setApplicationStatus(applicationId: string, status: 'shortlisted' | 'declined'): Promise<void>;
  withdrawApplication(applicationId: string): Promise<void>;
  hire(applicationId: string): Promise<Contract>;

  // Contracts & payments
  listMyContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | null>;
  getContractForProject(projectId: string): Promise<Contract | null>;
  /** Returns a Stripe Checkout URL to open in the browser; demo mode funds instantly. */
  fundContract(contractId: string): Promise<{ checkoutUrl?: string }>;
  deliver(contractId: string, message: string, files: DeliveryFile[]): Promise<void>;
  listDeliveries(contractId: string): Promise<Delivery[]>;
  /** Signed link to a delivered file; null in demo mode where files aren't stored. */
  getDeliveryFileUrl(path: string): Promise<string | null>;
  approve(contractId: string): Promise<void>;
  /** Business sends a delivery back for changes: payment stays held, auto-release pauses. */
  requestChanges(contractId: string, note: string): Promise<void>;
  /** Business cancels a hire before paying; the project reopens. */
  cancelContract(contractId: string): Promise<void>;
  raiseIssue(contractId: string, reason: string): Promise<void>;

  // Reviews (blind)
  submitReview(contractId: string, rating: number, comment: string): Promise<void>;
  getContractReviews(contractId: string): Promise<ContractReviews>;
  listReviewsFor(userId: string): Promise<Review[]>;

  // Messages
  listMessages(contractId: string): Promise<Message[]>;
  sendMessage(contractId: string, body: string): Promise<void>;

  // Notifications
  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(): Promise<void>;
  /** Save this device's Expo push token for the signed-in user. */
  registerPushToken(token: string, platform: string): Promise<void>;

  // Admin
  adminOverview(): Promise<AdminOverview>;
  adminShortlist(projectId: string, studentId: string): Promise<void>;
  /** Settle a reported problem: pay the student, or refund the business in full. */
  adminResolve(contractId: string, outcome: 'release' | 'refund'): Promise<void>;
}

export class ApiError extends Error {}

let instance: Api | null = null;

export function getApi(): Api {
  if (!instance) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createSupabaseApi } = require('./supabase/api') as typeof import('./supabase/api');
      instance = createSupabaseApi(url, key);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createDemoApi } = require('./demo/store') as typeof import('./demo/store');
      instance = createDemoApi();
    }
  }
  return instance;
}
