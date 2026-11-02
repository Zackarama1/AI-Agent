/**
 * Collabify pricing rules (see CLAUDE.md "Product rules").
 * Fees are charged to the business on top of the project price. Students keep 100%.
 */
export type Plan = 'free' | 'pro' | 'scale';

export const PLANS: Record<Plan, { id: Plan; name: string; feeRate: number; monthlyPence: number }> = {
  free: { id: 'free', name: 'Free', feeRate: 0.12, monthlyPence: 0 },
  pro: { id: 'pro', name: 'Startup Pro', feeRate: 0.08, monthlyPence: 2900 },
  scale: { id: 'scale', name: 'Scale', feeRate: 0.05, monthlyPence: 9900 },
};

export const FEATURED_LISTING_PENCE = 1900;

/** Minimum effective hourly rate: £12.71. */
export const MIN_HOURLY_PENCE = 1271;

/** Days after delivery before payment is released automatically. */
export const AUTO_RELEASE_DAYS = 7;

export function feeFor(amountPence: number, plan: Plan) {
  const feeRate = PLANS[plan].feeRate;
  const feePence = Math.round(amountPence * feeRate);
  return { amountPence, feeRate, feePence, totalPence: amountPence + feePence };
}

export function minimumBudgetPence(estimatedHours: number) {
  return Math.ceil(Math.max(0, estimatedHours) * MIN_HOURLY_PENCE);
}

export function meetsMinimumRate(budgetPence: number, estimatedHours: number) {
  return estimatedHours > 0 && budgetPence >= estimatedHours * MIN_HOURLY_PENCE;
}

export function hourlyRatePence(budgetPence: number, estimatedHours: number) {
  return estimatedHours > 0 ? Math.floor(budgetPence / estimatedHours) : 0;
}

export function formatGBP(pence: number, opts: { exact?: boolean } = {}) {
  const pounds = pence / 100;
  const whole = pence % 100 === 0 && !opts.exact;
  return `£${pounds.toLocaleString('en-GB', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Students must sign up with a UK university email. */
export function isUkUniversityEmail(email: string) {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.ac\.uk$/.test(domain);
}

export function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
