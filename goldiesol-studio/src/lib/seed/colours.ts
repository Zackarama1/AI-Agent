import type { Colour } from '../types';
import { rowMeta } from './ids';

// Hex values only. Pantone codes stay blank until the team enters them from their
// own licensed Pantone source (§9.3) — we never ship a Pantone lookup table.
const palettes: Record<string, [name: string, hex: string][]> = {
  'Goldiesol Core': [
    ['Blush White', '#FEF5F4'],
    ['Goldie Blush', '#EBC7C1'],
    ['Atelier Ivory', '#FBF7F2'],
    ['Champagne', '#D8B98A'],
    ['Cocoa', '#5B3F33'],
    ['Midnight Black', '#151214'],
  ],
  'Riviera Neutrals': [
    ['Sand Dune', '#E3D3BC'],
    ['Linen', '#EFE6D8'],
    ['Driftwood', '#B59F86'],
    ['Taupe Silk', '#9C8878'],
    ['Oyster', '#D9D2C5'],
    ['Espresso', '#3A2A24'],
  ],
  'Sunset Coral': [
    ['Coral Kiss', '#F28B7A'],
    ['Apricot Glow', '#F6B38E'],
    ['Terracotta', '#C8664B'],
    ['Peach Sorbet', '#FBC9B0'],
    ['Rosé', '#E9A3A0'],
  ],
  'Mediterranean Blues': [
    ['Aegean', '#2F6F9F'],
    ['Capri', '#4FA3C7'],
    ['Sea Glass', '#A9D3CF'],
    ['Powder Blue', '#C7DBEA'],
    ['Deep Navy', '#1E2A44'],
  ],
  'Butter & Pistachio': [
    ['Butter', '#F5E3A1'],
    ['Lemon Cream', '#FAF0C3'],
    ['Pistachio', '#C5D8A4'],
    ['Sage', '#A7B89A'],
    ['Olive Silk', '#7A7F4E'],
  ],
  'Jewel Tones': [
    ['Emerald', '#1F6E54'],
    ['Sapphire', '#24427A'],
    ['Ruby', '#9B1B30'],
    ['Amethyst', '#6B4C8A'],
    ['Garnet', '#6E1F2B'],
  ],
  Metallics: [
    ['Gold Lurex', '#C9A55A'],
    ['Rose Gold Shimmer', '#D3A28F'],
    ['Bronze Shimmer', '#9C6B3F'],
    ['Silver Lurex', '#BFC1C2'],
    ['Pearl Shimmer', '#EDE6DC'],
  ],
  // Refreshed from Insights once a trends provider is connected (Phase 5).
  'Seasonal "Now"': [
    ['Butter Yellow', '#F3DE8A'],
    ['Chocolate Brown', '#4E342B'],
    ['Cherry Red', '#A3212E'],
    ['Dusty Lilac', '#C9B6D3'],
  ],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const colours: Colour[] = Object.entries(palettes).flatMap(([palette, entries]) =>
  entries.map(([name, hex]) => ({
    ...rowMeta(`colour:${slug(palette)}:${slug(name)}`),
    name,
    hex,
    pantone_code: null,
    pantone_system: null,
    palette,
  })),
);

export const colourByName = (name: string): Colour => {
  const c = colours.find((c) => c.name === name);
  if (!c) throw new Error(`Seed colour not found: ${name}`);
  return c;
};
