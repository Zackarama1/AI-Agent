import { AREA_EMBELLISHMENTS, PART_PATHS } from './defaults';
import type { CanvasState, Embellishment, EmbellishmentType, Fill, PiecePart, PieceState } from './types';

// Pure canvas edits shared by the editor UI (and, in phase 4, the AI Partner).

export const PART_KEY = { top: 'top', bottom: 'bottom', one_piece: 'onePiece' } as const;
export const PART_LABEL: Record<PiecePart, string> = { top: 'Top', bottom: 'Bottom', one_piece: 'One-piece' };

export const partsOf = (c: CanvasState): PiecePart[] =>
  [c.top && 'top', c.bottom && 'bottom', c.onePiece && 'one_piece'].filter(Boolean) as PiecePart[];

export function getPiece(c: CanvasState, part: PiecePart): PieceState<unknown> | undefined {
  return c[PART_KEY[part]] as PieceState<unknown> | undefined;
}

export function updatePiece<P>(c: CanvasState, part: PiecePart, fn: (p: PieceState<P>) => PieceState<P>): CanvasState {
  const key = PART_KEY[part];
  const piece = c[key] as PieceState<P> | undefined;
  if (!piece) return c;
  return { ...c, [key]: fn(piece) };
}

export const setParams = <P>(c: CanvasState, part: PiecePart, patch: Partial<P>, detachShape = true): CanvasState =>
  updatePiece<P>(c, part, (p) => ({ ...p, params: { ...p.params, ...patch }, ...(detachShape && { shapeId: undefined }) }));

export const setFill = (c: CanvasState, part: PiecePart, fill: Fill): CanvasState =>
  updatePiece(c, part, (p) => ({ ...p, fill }));

// The visible "main" colour of a fill, used when recolouring keeps the fabric type.
export function fillHex(f: Fill): string {
  return f.kind === 'image' ? '#E8C4C0' : f.hex;
}

export function recolour(f: Fill, hex: string, colourId?: string): Fill {
  switch (f.kind) {
    case 'solid': return { kind: 'solid', hex, colourId };
    case 'print': return { ...f, hex };
    case 'image': return { kind: 'solid', hex, colourId };
    default: return { ...f, hex };
  }
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

export function defaultPath(part: PiecePart, type: EmbellishmentType): string {
  const wantArea = AREA_EMBELLISHMENTS.includes(type);
  const paths = PART_PATHS[part];
  return (paths.find((p) => Boolean(p.area) === wantArea) ?? paths[0]).value;
}

export function addEmbellishment(c: CanvasState, e: Omit<Embellishment, 'id' | 'path'> & { path?: string }): { canvas: CanvasState; id: string } {
  const id = newId();
  const part = e.part === 'strap' || e.part === 'tie' ? 'top' : e.part;
  const embellishment: Embellishment = { ...e, id, path: e.path ?? defaultPath(part, e.type) };
  return { canvas: { ...c, embellishments: [...c.embellishments, embellishment] }, id };
}

export const updateEmbellishment = (c: CanvasState, id: string, patch: Partial<Embellishment>): CanvasState => ({
  ...c,
  embellishments: c.embellishments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
});

export const removeEmbellishment = (c: CanvasState, id: string): CanvasState => ({
  ...c,
  embellishments: c.embellishments.filter((e) => e.id !== id),
});

export function duplicateEmbellishment(c: CanvasState, id: string): { canvas: CanvasState; id?: string } {
  const source = c.embellishments.find((e) => e.id === id);
  if (!source) return { canvas: c };
  const copy = { ...source, id: newId() };
  return { canvas: { ...c, embellishments: [...c.embellishments, copy] }, id: copy.id };
}
