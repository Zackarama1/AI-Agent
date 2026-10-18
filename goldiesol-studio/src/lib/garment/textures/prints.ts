import { darken, lighten, mix } from '../colour';
import type { PrintId } from '../types';

// Generated print repeats (§5.5). `scale` 1 = the default repeat size.

type PrintTile = { size: number; body: (base: string, accent: string) => string };

const PRINT_TILES: Record<PrintId, PrintTile> = {
  ditsy_floral: {
    size: 30,
    body: (b, a) => {
      const flower = (x: number, y: number, r: number) =>
        [0, 72, 144, 216, 288].map((deg) => `<circle cx="${x}" cy="${y - r}" r="${r * 0.75}" transform="rotate(${deg} ${x} ${y})"/>`).join('');
      return `<g fill="${a}">${flower(8, 8, 2)}${flower(23, 20, 1.8)}</g>
        <circle cx="8" cy="8" r="1" fill="${lighten(b, 0.6)}"/><circle cx="23" cy="20" r="0.9" fill="${lighten(b, 0.6)}"/>
        <path d="M14 26q2-3 4 0M2 18q2-2 3 1" stroke="${darken(a, 0.3)}" stroke-width="0.7" fill="none"/>`;
    },
  },
  tropical: {
    size: 80,
    body: (b, a) => `
      <g fill="${a}" opacity="0.9">
        <path d="M10 70Q20 30 55 15Q40 45 10 70Z"/><path d="M45 78Q60 50 78 48Q68 70 45 78Z" opacity="0.75"/>
      </g>
      <path d="M10 70Q30 45 55 15M45 78Q62 60 78 48" stroke="${darken(a, 0.35)}" stroke-width="1" fill="none"/>
      <path d="M60 5Q70 20 65 35" stroke="${mix(a, b, 0.4)}" stroke-width="3" fill="none"/>`,
  },
  gingham: {
    size: 16,
    body: (b, a) => `
      <rect width="8" height="16" fill="${a}" opacity="0.45"/><rect width="16" height="8" fill="${a}" opacity="0.45"/>
      <rect width="8" height="8" fill="${a}" opacity="0.5"/>`,
  },
  polka: {
    size: 18,
    body: (_b, a) => `<circle cx="4.5" cy="4.5" r="2.4" fill="${a}"/><circle cx="13.5" cy="13.5" r="2.4" fill="${a}"/>`,
  },
  stripe: {
    size: 14,
    body: (_b, a) => `<rect width="14" height="5" fill="${a}"/><rect y="9" width="14" height="1.2" fill="${a}" opacity="0.6"/>`,
  },
  abstract_brush: {
    size: 60,
    body: (b, a) => `
      <path d="M5 15Q20 2 35 14T58 10" stroke="${a}" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.85"/>
      <path d="M2 45Q18 32 30 44T55 40" stroke="${mix(a, b, 0.45)}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.7"/>
      <circle cx="44" cy="27" r="3" fill="${darken(a, 0.2)}"/>`,
  },
  leopard: {
    size: 34,
    body: (b, a) => {
      const spot = (x: number, y: number, r: number) =>
        `<path d="M${x - r} ${y}q${r * 0.4} -${r} ${r} -${r * 0.9}q${r} 0 ${r} ${r * 0.9}q-${r * 0.2} ${r} -${r} ${r}q-${r * 0.8} 0 -${r} -${r}z" fill="none" stroke="${darken(a, 0.45)}" stroke-width="1.6"/>
         <ellipse cx="${x}" cy="${y}" rx="${r * 0.45}" ry="${r * 0.38}" fill="${mix(a, b, 0.2)}"/>`;
      return spot(9, 9, 5) + spot(26, 24, 4.5) + spot(27, 6, 2.5) + spot(8, 28, 3);
    },
  },
  snake: {
    size: 14,
    body: (b, a) => `
      <path d="M0 7Q3.5 0 7 7T14 7M-7 0Q-3.5 -7 0 0T7 0T14 0T21 0M0 14Q3.5 7 7 14T14 14" stroke="${darken(a, 0.3)}" stroke-width="0.8" fill="none"/>
      <path d="M3.5 3.5L7 7L3.5 10.5" fill="${mix(a, b, 0.5)}" opacity="0.6"/>`,
  },
  paisley: {
    size: 40,
    body: (b, a) => `
      <path d="M12 30C2 28 2 12 14 8C26 4 30 20 22 26C18 29 14 26 16 22" fill="${mix(a, b, 0.25)}" stroke="${darken(a, 0.3)}" stroke-width="1"/>
      <circle cx="14" cy="17" r="2.5" fill="${lighten(b, 0.4)}"/>
      <path d="M30 34q4 -6 8 0q-4 4 -8 0z" fill="${a}"/>`,
  },
  tie_dye: {
    size: 90,
    body: (b, a) => `
      <circle cx="45" cy="45" r="40" fill="none" stroke="${a}" stroke-width="10" opacity="0.35"/>
      <circle cx="45" cy="45" r="24" fill="none" stroke="${a}" stroke-width="8" opacity="0.5"/>
      <circle cx="45" cy="45" r="9" fill="${a}" opacity="0.7"/>
      <circle cx="45" cy="45" r="32" fill="none" stroke="${lighten(b, 0.5)}" stroke-width="2" opacity="0.6"/>`,
  },
  watercolour_floral: {
    size: 70,
    body: (b, a) => `
      <g opacity="0.55"><circle cx="20" cy="20" r="11" fill="${a}"/><circle cx="28" cy="16" r="9" fill="${mix(a, '#FFFFFF', 0.3)}"/>
      <circle cx="52" cy="50" r="12" fill="${mix(a, b, 0.4)}"/><circle cx="45" cy="56" r="8" fill="${a}"/></g>
      <path d="M20 31Q18 45 30 55" stroke="${darken(mix(a, '#7A7F4E', 0.6), 0.1)}" stroke-width="1.2" fill="none" opacity="0.6"/>`,
  },
};

export function printPattern(id: string, print: PrintId, base: string, accent: string, scale: number): string {
  const tile = PRINT_TILES[print];
  const size = tile.size * Math.min(Math.max(scale, 0.25), 4);
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" viewBox="0 0 ${tile.size} ${tile.size}">
    <rect width="${tile.size}" height="${tile.size}" fill="${base}"/>${tile.body(base, accent)}</pattern>`;
}
