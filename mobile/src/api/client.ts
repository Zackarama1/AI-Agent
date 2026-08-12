// Thin typed client for the StockSense backend.
//
// IMPORTANT: when testing on a physical phone via Expo Go, "localhost" points
// at the phone, not your computer. Set EXPO_PUBLIC_API_URL to your machine's
// LAN IP, e.g. http://192.168.1.20:8000 — or run a tunnel.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export type Quote = {
  symbol: string;
  price: number;
  change: number;
  percent_change: number;
  high: number;
  low: number;
  open: number;
  prev_close: number;
  is_mock: boolean;
};

export type HoldingWithQuote = {
  id: number;
  symbol: string;
  shares: number;
  cost_basis: number;
  price: number;
  market_value: number;
  total_cost: number;
  gain: number;
  gain_percent: number;
  day_change: number;
  day_change_percent: number;
};

export type PortfolioSummary = {
  holdings: HoldingWithQuote[];
  total_value: number;
  total_cost: number;
  total_gain: number;
  total_gain_percent: number;
  day_change: number;
  day_change_percent: number;
};

export type NewsItem = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
};

export type Brief = { text: string; is_mock: boolean };

export type Candle = { t: number; o: number; h: number; l: number; c: number };
export type History = { symbol: string; candles: Candle[]; is_mock: boolean };
export type SearchResult = { symbol: string; description: string; type: string };
export type WatchItem = {
  id: number;
  symbol: string;
  price: number;
  change: number;
  percent_change: number;
};

export type Alert = {
  id: number;
  symbol: string;
  direction: "above" | "below";
  target: number;
  active: boolean;
};

export type EarningsEvent = {
  symbol: string;
  date: string;
  hour: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  quarter: number | null;
  year: number | null;
  is_mock: boolean;
};

export type User = { id: number; email: string };
export type AuthResponse = { token: string; user: User };

// Bearer token, set after login and on app start from secure storage.
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* body wasn't JSON */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  register: (email: string, password: string) =>
    req<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    req<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => req<User>("/api/auth/me"),
  getPortfolio: () => req<PortfolioSummary>("/api/portfolio"),
  getBrief: () => req<Brief>("/api/portfolio/brief"),
  getNews: (symbol: string) => req<NewsItem[]>(`/api/news/${symbol}`),
  getQuote: (symbol: string) => req<Quote>(`/api/quote/${symbol}`),
  getHistory: (symbol: string, days = 30) =>
    req<History>(`/api/history/${symbol}?days=${days}`),
  addHolding: (h: { symbol: string; shares: number; cost_basis: number }) =>
    req<HoldingWithQuote>("/api/holdings", {
      method: "POST",
      body: JSON.stringify(h),
    }),
  deleteHolding: (id: number) =>
    req<void>(`/api/holdings/${id}`, { method: "DELETE" }),
  search: (q: string) =>
    req<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  getWatchlist: () => req<WatchItem[]>("/api/watchlist"),
  addWatch: (symbol: string) =>
    req<{ ok: boolean }>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  removeWatch: (symbol: string) =>
    req<void>(`/api/watchlist/${symbol}`, { method: "DELETE" }),
  getAlerts: () => req<Alert[]>("/api/alerts"),
  addAlert: (a: { symbol: string; direction: "above" | "below"; target: number }) =>
    req<Alert>("/api/alerts", { method: "POST", body: JSON.stringify(a) }),
  deleteAlert: (id: number) =>
    req<void>(`/api/alerts/${id}`, { method: "DELETE" }),
  registerPushToken: (token: string) =>
    req<{ ok: boolean }>("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  getEarnings: () => req<EarningsEvent[]>("/api/calendar/earnings"),
};
