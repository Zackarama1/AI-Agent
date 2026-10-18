import type { CanvasState, EmbellishmentType, Fill } from './garment/types';
import type { DesignStatus } from './types';

// Design Library filters (§11). Pure so they can run on the client and in tests.

export interface LibraryDesign {
  id: string;
  name: string;
  status: DesignStatus;
  category: string | null;
  collection_id: string | null;
  top_shape_id: string | null;
  bottom_shape_id: string | null;
  tags: string[];
  updated_at: string;
  thumbnail_canvas: CanvasState | null;
}

export interface LibraryFilters {
  q: string;
  category: string;
  status: string;          // '' = any non-archived; 'archived' shows only archived
  collectionId: string;
  colourId: string;
  detail: EmbellishmentType | '';
  shapeId: string;
  editedWithinDays: number; // 0 = any time
}

export const EMPTY_FILTERS: LibraryFilters = {
  q: '', category: '', status: '', collectionId: '', colourId: '', detail: '', shapeId: '', editedWithinDays: 0,
};

const fills = (c: CanvasState): Fill[] =>
  [c.top, c.bottom, c.onePiece].flatMap((p) => (p ? [p.fill] : []));

export function usesColour(c: CanvasState | null, colour: { id: string; hex: string }): boolean {
  if (!c) return false;
  const hex = colour.hex.toLowerCase();
  return (
    fills(c).some((f) => (f.kind === 'solid' && f.colourId === colour.id) || ('hex' in f && f.hex.toLowerCase() === hex) || (f.kind === 'print' && f.accentHex.toLowerCase() === hex)) ||
    c.embellishments.some((e) => e.colourId === colour.id)
  );
}

export const detailTypes = (c: CanvasState | null): EmbellishmentType[] =>
  c ? [...new Set(c.embellishments.map((e) => e.type))] : [];

export function filterDesigns<T extends LibraryDesign>(
  designs: T[],
  f: LibraryFilters,
  colours: { id: string; hex: string }[],
  now = Date.now(),
): T[] {
  const q = f.q.trim().toLowerCase();
  const colour = colours.find((c) => c.id === f.colourId);
  return designs.filter((d) => {
    if (f.status === 'archived' ? d.status !== 'archived' : f.status ? d.status !== f.status : d.status === 'archived') return false;
    if (q && !`${d.name} ${d.tags.join(' ')}`.toLowerCase().includes(q)) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.collectionId && (f.collectionId === 'none' ? d.collection_id !== null : d.collection_id !== f.collectionId)) return false;
    if (f.shapeId && d.top_shape_id !== f.shapeId && d.bottom_shape_id !== f.shapeId) return false;
    if (f.detail && !detailTypes(d.thumbnail_canvas).includes(f.detail)) return false;
    if (colour && !usesColour(d.thumbnail_canvas, colour)) return false;
    if (f.editedWithinDays && now - Date.parse(d.updated_at) > f.editedWithinDays * 86_400_000) return false;
    return true;
  });
}

export const MAX_COMPARE = 4;
