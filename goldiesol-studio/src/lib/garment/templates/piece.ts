import type { Polyline, Pt } from '../geometry';
import type { HardwarePlacement, PiecePart } from '../types';

// Geometry for one garment piece in one view, in centimetres. The renderer turns
// this into SVG; tech packs read edge lengths from it.
export interface Piece {
  part: PiecePart;
  outlines: Polyline[];                          // closed fabric panels
  holes: Polyline[];                             // closed cut-outs
  seams: Polyline[];                             // open stitch / seam lines
  strings: { pts: Polyline; widthCm: number }[]; // straps and ties
  bows: Pt[];
  edges: Record<string, Polyline[]>;             // named edges embellishments can follow
  areas: Record<string, Polyline[]>;             // named closed areas (overlays, scatter)
  anchors: Partial<Record<HardwarePlacement, Pt[]>>;
  insideOut?: boolean;                           // back view of cups: show the lining side
}

export const emptyPiece = (part: PiecePart): Piece => ({
  part,
  outlines: [],
  holes: [],
  seams: [],
  strings: [],
  bows: [],
  edges: {},
  areas: {},
  anchors: {},
});

export const addEdge = (piece: Piece, name: string, ...polys: Polyline[]) => {
  piece.edges[name] = [...(piece.edges[name] ?? []), ...polys];
};

export const addArea = (piece: Piece, name: string, ...polys: Polyline[]) => {
  piece.areas[name] = [...(piece.areas[name] ?? []), ...polys];
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
