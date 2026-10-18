import type { FunctionSpec } from "./types";

/**
 * Score how well `query` matches `text` (higher is better, 0 = no match).
 * Exact > prefix > word-prefix > subsequence.
 */
export function score(query: string, text: string): number {
  const q = query.trim().toUpperCase();
  const t = text.toUpperCase();
  if (!q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500 - (t.length - q.length);
  if (t.split(/[\s/&-]+/).some((w) => w.startsWith(q))) return 200;
  if (q.length <= 6 && editDistance(q, t) === 1) return 150; // one typo: HELPP, DSE
  let ti = 0;
  for (const ch of q) {
    ti = t.indexOf(ch, ti);
    if (ti === -1) return 0;
    ti += 1;
  }
  return 50;
}

/** Damerau-Levenshtein distance (adjacent transpositions count as one edit). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** Rank functions by code first, then by title. */
export function rankFunctions(query: string, fns: FunctionSpec[], limit = 8): FunctionSpec[] {
  return fns
    .map((f) => ({ f, s: Math.max(score(query, f.code) * 2, score(query, f.title)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.code.localeCompare(b.f.code))
    .slice(0, limit)
    .map((x) => x.f);
}
