import { brandDna, collections, sizeChart } from './brand';
import { colours } from './colours';
import { designNotes, designs, designVersions, shapes } from './designs';
import { materials } from './materials';
import { suppliers } from './suppliers';

export { SEED_TEAM_ID, SEED_TIME, seedId } from './ids';

// Insertion order respects foreign keys.
export const seed = {
  brand_dna: [brandDna],
  collections,
  suppliers,
  shapes,
  designs,
  design_versions: designVersions,
  design_notes: designNotes,
  materials,
  colours,
  size_chart: sizeChart,
} as const;

export type SeedTable = keyof typeof seed;
