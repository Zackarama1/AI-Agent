import type { LaceTexture } from '../types';

// SVG <pattern> tiles for swim-grade laces, crochet and mesh. Sizes are in SVG
// units (10 per cm), so a 24-unit tile is a 2.4 cm lace repeat.

const petals = (cx: number, cy: number, r: number, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 360) / n;
    return `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.45}" ry="${r * 0.9}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join('');

const LACE_TILES: Record<LaceTexture, { size: number; body: (c: string) => string }> = {
  // Chantilly-style: fine hex net with corded flowers.
  floral: {
    size: 28,
    body: (c) => `
      <path d="M0 7L7 0M7 0L14 7M14 7L21 0M21 0L28 7M0 21L7 14L14 21L21 14L28 21M7 14L7 0M21 14L21 0M0 7L0 21M14 7L14 21M28 7L28 21M7 28L7 14M21 28L21 14"
        stroke="${c}" stroke-width="0.35" opacity="0.55" fill="none"/>
      <g fill="none" stroke="${c}" stroke-width="0.9">${petals(14, 14, 4.5, 6)}<circle cx="14" cy="14" r="1.6" fill="${c}"/></g>
      <g fill="none" stroke="${c}" stroke-width="0.6">${petals(0, 0, 2.6, 5)}${petals(28, 28, 2.6, 5)}${petals(0, 28, 2.6, 5)}${petals(28, 0, 2.6, 5)}</g>`,
  },
  scallop: {
    size: 20,
    body: (c) => `
      <path d="M0 10Q5 2 10 10Q15 2 20 10M0 20Q5 12 10 20Q15 12 20 20" stroke="${c}" stroke-width="0.9" fill="none"/>
      <circle cx="5" cy="7.5" r="0.9" fill="${c}"/><circle cx="15" cy="7.5" r="0.9" fill="${c}"/>
      <path d="M0 0L20 20M20 0L0 20" stroke="${c}" stroke-width="0.25" opacity="0.5"/>`,
  },
  geometric: {
    size: 16,
    body: (c) => `
      <path d="M8 1L15 8L8 15L1 8Z" stroke="${c}" stroke-width="0.8" fill="none"/>
      <path d="M8 5L11 8L8 11L5 8Z" fill="${c}" opacity="0.7"/>
      <path d="M0 0L16 16M16 0L0 16" stroke="${c}" stroke-width="0.25" opacity="0.45"/>`,
  },
  // Eyelash: fine net with dense short fringe strokes.
  eyelash: {
    size: 18,
    body: (c) => `
      <path d="M0 9Q4.5 3 9 9Q13.5 3 18 9" stroke="${c}" stroke-width="0.8" fill="none"/>
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 2 + 1}" y1="${12}" x2="${i * 2 + 1.4}" y2="${17}" stroke="${c}" stroke-width="0.35"/>`).join('')}
      <path d="M0 0L18 18M18 0L0 18" stroke="${c}" stroke-width="0.2" opacity="0.4"/>`,
  },
  // Guipure: bold motifs joined by bars, no net ground.
  guipure: {
    size: 30,
    body: (c) => `
      <g fill="${c}" opacity="0.9">${petals(15, 15, 5.5, 5)}</g>
      <circle cx="15" cy="15" r="2.2" fill="none" stroke="${c}" stroke-width="1" opacity="0.4"/>
      <path d="M15 4V0M15 26V30M4 15H0M26 15H30" stroke="${c}" stroke-width="1.4"/>
      <g fill="${c}" opacity="0.85"><circle cx="0" cy="0" r="3"/><circle cx="30" cy="0" r="3"/><circle cx="0" cy="30" r="3"/><circle cx="30" cy="30" r="3"/></g>`,
  },
};

export function lacePattern(id: string, texture: LaceTexture, hex: string): string {
  const tile = LACE_TILES[texture];
  return `<pattern id="${id}" width="${tile.size}" height="${tile.size}" patternUnits="userSpaceOnUse">${tile.body(hex)}</pattern>`;
}

export function crochetPattern(id: string, hex: string): string {
  return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse">
    <circle cx="11" cy="11" r="6" fill="none" stroke="${hex}" stroke-width="2.2"/>
    <circle cx="11" cy="11" r="2" fill="${hex}"/>
    <path d="M0 0L5 5M22 0L17 5M0 22L5 17M22 22L17 17" stroke="${hex}" stroke-width="2"/>
  </pattern>`;
}

export function meshPattern(id: string, hex: string): string {
  return `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse">
    <path d="M0 0L4 4M4 0L0 4" stroke="${hex}" stroke-width="0.45"/>
  </pattern>`;
}

// Gathered ruching lines and tonal embroidery, used by embellishments.
export function ruchingPattern(id: string, hex: string): string {
  return `<pattern id="${id}" width="12" height="40" patternUnits="userSpaceOnUse">
    <path d="M2 0Q6 10 2 20T2 40M8 0Q12 10 8 20T8 40" stroke="${hex}" stroke-width="0.8" fill="none" opacity="0.6"/>
  </pattern>`;
}

export function embroideryPattern(id: string, hex: string): string {
  return `<pattern id="${id}" width="34" height="34" patternUnits="userSpaceOnUse">
    <g fill="none" stroke="${hex}" stroke-width="0.8">${petals(10, 10, 3, 5)}<path d="M10 13Q14 22 24 24" /><path d="M18 20q3-3 5 0q-3 3-5 0z"/></g>
    <circle cx="10" cy="10" r="1" fill="${hex}"/><circle cx="27" cy="8" r="0.8" fill="${hex}"/>
  </pattern>`;
}
