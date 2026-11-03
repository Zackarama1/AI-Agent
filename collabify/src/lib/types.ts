import type { Plan } from './fees';

export type Role = 'student' | 'business' | 'admin';

export type Profile = { id: string; role: Role; fullName: string; email: string };

export type RightToWorkStatus = 'unknown' | 'confirmed' | 'restricted';

export type Student = {
  id: string;
  fullName: string;
  university: string;
  course: string;
  year: string;
  skills: string[];
  bio: string;
  portfolioUrl: string;
  verified: boolean;
  rating: { average: number | null; count: number };
  completedCount: number;
};

/** Visible only to the student themselves (and service role). */
export type StudentPrivate = {
  universityEmail: string;
  payoutsEnabled: boolean;
  rightToWorkStatus: RightToWorkStatus;
  verifiedAt: string | null;
};

export type Business = {
  id: string;
  fullName: string;
  companyName: string;
  website: string;
  plan: Plan;
  rating: { average: number | null; count: number };
};

export type ProjectStatus = 'open' | 'in_progress' | 'delivered' | 'completed' | 'cancelled';

export type Project = {
  id: string;
  businessId: string;
  companyName: string;
  title: string;
  category: string;
  brief: string;
  budgetPence: number;
  estimatedHours: number;
  durationDays: number;
  skills: string[];
  status: ProjectStatus;
  /** Featured (paid, £19) listings sit at the top of the feed until this time. */
  featuredUntil: string | null;
  featured: boolean;
  createdAt: string;
  applicantCount: number;
};

export type NewProject = Pick<Project, 'title' | 'category' | 'brief' | 'budgetPence' | 'estimatedHours' | 'durationDays' | 'skills'>;

export type ApplicationStatus = 'applied' | 'shortlisted' | 'hired' | 'declined';

export type Application = {
  id: string;
  projectId: string;
  projectTitle: string;
  studentId: string;
  student: Student;
  pitch: string;
  status: ApplicationStatus;
  createdAt: string;
};

export type ContractStatus = 'awaiting_funding' | 'funded' | 'delivered' | 'released' | 'refunded' | 'disputed' | 'cancelled';

export type Contract = {
  id: string;
  projectId: string;
  projectTitle: string;
  businessId: string;
  companyName: string;
  studentId: string;
  studentName: string;
  amountPence: number;
  feeRate: number;
  feePence: number;
  totalPence: number;
  status: ContractStatus;
  fundedAt: string | null;
  deliveredAt: string | null;
  releasedAt: string | null;
  autoReleaseAt: string | null;
  /** Times the business has asked for changes after a delivery. */
  revisionCount: number;
  issueReason: string | null;
  issueRaisedBy: string | null;
  createdAt: string;
};

export type Delivery = { id: string; contractId: string; message: string; files: string[]; createdAt: string };

export type Review = { id: string; contractId: string; reviewerId: string; revieweeId: string; rating: number; comment: string; createdAt: string };

/** Blind reviews: `theirs` stays null until both sides have submitted. */
export type ContractReviews = { mine: Review | null; theirs: Review | null; theirsSubmitted: boolean };

export type Message = { id: string; contractId: string; senderId: string; body: string; createdAt: string };

export type Suggestion = { student: Student; score: number; invited: boolean };

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  /** In-app route to open, e.g. /contract/123 */
  link: string;
  readAt: string | null;
  createdAt: string;
};

export type Brief = { title: string; brief: string; skills: string[]; estimatedHours: number; durationDays: number };

export type AdminOverview = {
  metrics: {
    openProjects: number;
    fillRate: number; // share of posted projects that got hired
    medianHoursToMatch: number | null;
    repeatClientRate: number; // share of hiring businesses with 2+ contracts
    gmvPence: number;
    feeRevenuePence: number;
  };
  unmatched: { project: Project; suggestions: { student: Student; score: number }[] }[];
  disputes: Contract[];
};
