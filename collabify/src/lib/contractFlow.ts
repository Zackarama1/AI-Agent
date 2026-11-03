import { AUTO_RELEASE_DAYS, formatGBP } from './fees';
import type { Contract } from './types';

/**
 * The project lifecycle as one pure function: given a contract and who is looking at it,
 * say where it is, what that person should know, whose move it is, and what they can do.
 * Every screen that shows a contract uses this, so the rules live in one tested place.
 */

export type Viewer = 'student' | 'business' | 'admin';

export type FlowAction =
  | 'fund' // business pays; money is held
  | 'cancelHire' // business cancels before paying
  | 'deliver' // student hands over the work
  | 'approve' // business approves and the student is paid
  | 'requestChanges' // business sends a delivery back
  | 'reportProblem' // either side, while money is held
  | 'review' // either side, after payment
  | 'resolve'; // admin settles a reported problem

export type FlowTone = 'action' | 'waiting' | 'done' | 'problem' | 'closed';

export type FlowState = {
  steps: readonly string[];
  /** Index of the last completed step; -1 when nothing is done yet. */
  stepIndex: number;
  /** Whether to draw the progress steps at all (not for cancelled/refunded projects). */
  showProgress: boolean;
  tone: FlowTone;
  headline: string;
  detail: string;
  /** Who needs to act next. */
  waitingOn: 'student' | 'business' | 'collabify' | null;
  primary: FlowAction | null;
  secondary: FlowAction[];
  /** Days left until payment is released automatically, while delivered. */
  autoReleaseInDays: number | null;
};

export const STEPS = ['Hired', 'Payment held', 'Delivered', 'Paid'] as const;

const daysLeft = (iso: string | null, now: Date) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000)) : null;

export function contractFlow(
  c: Pick<Contract, 'status' | 'amountPence' | 'totalPence' | 'autoReleaseAt' | 'revisionCount' | 'companyName' | 'studentName'>,
  viewer: Viewer,
  opts: { hasReviewed?: boolean; now?: Date } = {},
): FlowState {
  const now = opts.now ?? new Date();
  const pay = formatGBP(c.amountPence);
  const other = viewer === 'student' ? c.companyName : c.studentName;
  const base = { steps: STEPS, showProgress: true, secondary: [] as FlowAction[], autoReleaseInDays: null };

  switch (c.status) {
    case 'awaiting_funding':
      if (viewer === 'business') {
        return { ...base, stepIndex: 0, tone: 'action', waitingOn: 'business', primary: 'fund', secondary: ['cancelHire'],
          headline: 'Pay to get started',
          detail: `${formatGBP(c.totalPence, { exact: true })} is held safely and only released when you approve the work.` };
      }
      return { ...base, stepIndex: 0, tone: viewer === 'student' ? 'done' : 'waiting', waitingOn: 'business', primary: null,
        headline: viewer === 'student' ? 'You’re hired!' : 'Waiting for payment',
        detail: viewer === 'student' ? `${other} will pay ${pay} into a protected payment. Start once it’s held.` : `${c.companyName} hasn’t paid yet.` };

    case 'funded': {
      const changes = c.revisionCount > 0;
      if (viewer === 'student') {
        return { ...base, stepIndex: 1, tone: 'action', waitingOn: 'student', primary: 'deliver', secondary: ['reportProblem'],
          headline: changes ? 'Deliver the changes' : 'Payment held. Time to build.',
          detail: changes ? `${other} asked for changes (see Messages). Your ${pay} is still held for you.` : `${pay} is held for you. Deliver when you’re ready.` };
      }
      return { ...base, stepIndex: 1, tone: 'waiting', waitingOn: 'student', primary: null, secondary: viewer === 'business' ? ['reportProblem'] : [],
        headline: changes ? 'Changes requested' : 'Payment held',
        detail: changes ? `${c.studentName} is working on your changes.` : `${c.studentName} is working on it. You’ll be notified when it’s delivered.` };
    }

    case 'delivered': {
      const days = daysLeft(c.autoReleaseAt, now);
      const when = days === null ? '' : days === 0 ? ' today' : ` in ${days} day${days === 1 ? '' : 's'}`;
      if (viewer === 'business') {
        return { ...base, stepIndex: 2, tone: 'action', waitingOn: 'business', primary: 'approve', secondary: ['requestChanges', 'reportProblem'], autoReleaseInDays: days,
          headline: 'Review the delivery',
          detail: `Approve to pay ${c.studentName}. If you don’t respond, it’s paid automatically${when}.` };
      }
      return { ...base, stepIndex: 2, tone: 'waiting', waitingOn: 'business', primary: null, secondary: viewer === 'student' ? ['reportProblem'] : [], autoReleaseInDays: days,
        headline: viewer === 'student' ? 'Delivered' : 'Waiting for approval',
        detail: viewer === 'student'
          ? `You’ll be paid when ${other} approves, or automatically${when || ` after ${AUTO_RELEASE_DAYS} days`}.`
          : `Auto-pays${when}.` };
    }

    case 'released': {
      const reviewed = Boolean(opts.hasReviewed);
      const canReview = viewer !== 'admin' && !reviewed;
      return { ...base, stepIndex: 3, tone: 'done', waitingOn: null, primary: canReview ? 'review' : null,
        headline: viewer === 'student' ? `You’ve been paid ${pay}` : 'Project complete',
        detail: canReview ? `How was working with ${other}? Reviews stay hidden until you both leave one.` : 'All done. Thanks for working together.' };
    }

    case 'disputed':
      return { ...base, stepIndex: 1, tone: 'problem', waitingOn: 'collabify', primary: viewer === 'admin' ? 'resolve' : null,
        headline: viewer === 'admin' ? 'Resolve this problem' : 'We’re looking into it',
        detail: viewer === 'admin'
          ? `Pay ${c.studentName} the full ${pay}, or refund ${c.companyName} in full.`
          : 'The payment stays protected while the Collabify team helps you both sort it out.' };

    case 'refunded':
      return { ...base, showProgress: false, stepIndex: -1, tone: 'closed', waitingOn: null, primary: null,
        headline: 'Refunded', detail: viewer === 'business' ? 'You’ve been refunded in full.' : 'This project was closed and the business refunded.' };

    case 'cancelled':
      return { ...base, showProgress: false, stepIndex: -1, tone: 'closed', waitingOn: null, primary: null,
        headline: 'Cancelled', detail: 'This hire was cancelled before payment.' };
  }
}
