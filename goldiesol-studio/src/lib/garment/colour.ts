const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHex = (s: string) => HEX.test(s);

// Never let an unvalidated string reach an SVG attribute.
export const safeHex = (s: string | undefined, fallback = '#FEF5F4') => (s && HEX.test(s) ? s : fallback);

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(safeHex(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

export const mix = (a: string, b: string, t: number) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

export const darken = (hex: string, t: number) => mix(hex, '#2B2422', t);
export const lighten = (hex: string, t: number) => mix(hex, '#FFFFFF', t);

// Relative luminance (0 dark → 1 light).
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Simple CIE76 ΔE between two hex colours — used for "closest saved colour" (§9.3).
export function deltaE(a: string, b: string): number {
  const lab = (hex: string) => {
    const [r, g, bl] = toRgb(hex).map((v) => {
      const c = v / 255;
      return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
    });
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + bl * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
