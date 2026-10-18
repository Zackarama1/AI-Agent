// Minimal 2D geometry for the parametric garment engine. All garment geometry is
// built in centimetres as sampled polylines, which makes edge lengths (for tech
// pack measurements) and placing beads/pearls along an edge straightforward.

export type Pt = [number, number];
export type Polyline = Pt[];

const SAMPLES = 18;

export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = SAMPLES): Polyline {
  const out: Polyline = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

export function quad(p0: Pt, c: Pt, p1: Pt, n = SAMPLES): Polyline {
  const out: Polyline = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

export const line = (a: Pt, b: Pt): Polyline => [a, b];

// Joins segments end-to-start, dropping the duplicated joint points.
export function join(...segments: Polyline[]): Polyline {
  const out: Polyline = [];
  for (const seg of segments) {
    for (const p of seg) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) out.push(p);
    }
  }
  return out;
}

export const mirrorX = (pts: Polyline): Polyline => pts.map(([x, y]) => [-x, y]);
export const reverse = (pts: Polyline): Polyline => [...pts].reverse();
export const translate = (pts: Polyline, dx: number, dy: number): Polyline => pts.map(([x, y]) => [x + dx, y + dy]);

export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 36): Polyline {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });
}

export function length(pts: Polyline): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

// Evenly spaced points along a polyline (for beads, pearls, appliqué).
export function pointsAlong(pts: Polyline, spacing: number, inset = spacing / 2): Pt[] {
  const total = length(pts);
  if (total === 0 || spacing <= 0) return [];
  const out: Pt[] = [];
  let target = Math.min(inset, total);
  let walked = 0;
  for (let i = 1; i < pts.length && target <= total; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    while (seg > 0 && target <= walked + seg) {
      const t = (target - walked) / seg;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      target += spacing;
    }
    walked += seg;
  }
  return out;
}

export function pointAt(pts: Polyline, fraction: number): Pt {
  const [p] = pointsAlong(pts, Number.POSITIVE_INFINITY, length(pts) * Math.min(Math.max(fraction, 0), 1));
  return p ?? pts[pts.length - 1];
}

export function pointInPolygon([x, y]: Pt, poly: Polyline): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(polys: Polyline[]): BBox {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const poly of polys) {
    for (const [x, y] of poly) {
      b.minX = Math.min(b.minX, x);
      b.minY = Math.min(b.minY, y);
      b.maxX = Math.max(b.maxX, x);
      b.maxY = Math.max(b.maxY, y);
    }
  }
  return b;
}

// Seeded PRNG so bead scatters render identically every time.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = (h << 13) | (h >>> 19);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = (n: number) => Math.round(n * 100) / 100;

export function toPath(pts: Polyline, closed: boolean, scale: number): string {
  if (!pts.length) return '';
  const [first, ...rest] = pts;
  return `M${r(first[0] * scale)} ${r(first[1] * scale)}${rest.map(([x, y]) => `L${r(x * scale)} ${r(y * scale)}`).join('')}${closed ? 'Z' : ''}`;
}
