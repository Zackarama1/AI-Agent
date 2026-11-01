// Central configuration. Every value can be overridden with an environment variable.
const env = process.env;

const isProd = env.NODE_ENV === 'production';

if (isProd && !env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = {
  isProd,
  port: Number(env.PORT || 4000),
  databasePath: env.DATABASE_PATH || 'collabify.db',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  // Platform commission taken from every completed project (business plan: 15%).
  commissionRate: Number(env.PLATFORM_COMMISSION_RATE ?? 0.15),
  // Premium students keep more of what they earn.
  premiumStudentCommissionRate: Number(env.PREMIUM_STUDENT_COMMISSION_RATE ?? 0.1),
  currency: env.CURRENCY || 'gbp',
  // 'mock' records money movement in the internal ledger only.
  // 'stripe' uses Stripe Connect (requires STRIPE_SECRET_KEY).
  paymentProvider: env.PAYMENT_PROVIDER || 'mock',
  stripeSecretKey: env.STRIPE_SECRET_KEY || '',
  appUrl: env.APP_URL || 'http://localhost:5173',
  // Email domains accepted as academic. Extend via ACADEMIC_DOMAINS="uni.example,college.example".
  academicDomainSuffixes: [
    '.ac.uk', '.edu', '.edu.au', '.ac.nz', '.ac.za', '.ac.in', '.edu.sg', '.ac.jp', '.edu.cn',
    ...(env.ACADEMIC_DOMAINS ? env.ACADEMIC_DOMAINS.split(',').map((d) => d.trim()).filter(Boolean) : []),
  ],
};

export const PLANS = {
  entrepreneur: {
    free: { id: 'free', name: 'Starter', pricePence: 0, activeListingLimit: 2, priorityPosting: false },
    growth: { id: 'growth', name: 'Growth', pricePence: 1900, activeListingLimit: 10, priorityPosting: true },
    scale: { id: 'scale', name: 'Scale', pricePence: 4900, activeListingLimit: Infinity, priorityPosting: true },
  },
  student: {
    free: { id: 'free', name: 'Student', pricePence: 0 },
    premium: { id: 'premium', name: 'Student Premium', pricePence: 499 },
  },
};

export const FEATURED_LISTING_FEE_PENCE = Number(env.FEATURED_LISTING_FEE_PENCE ?? 999);
export const FEATURED_LISTING_DAYS = 7;
