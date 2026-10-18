import { newCanvas } from './defaults';
import type { BottomParams, CanvasState, OnePieceParams, TopParams } from './types';

// A single-piece canvas for thumbnails of saved shapes.
export function shapeCanvas(kind: 'top' | 'bottom' | 'one_piece' | 'cover_up', params: unknown, hex = '#FEF5F4'): CanvasState {
  const fill = { kind: 'solid', hex } as const;
  if (kind === 'top' || kind === 'bottom') {
    const c = newCanvas('bikini');
    return kind === 'top'
      ? { ...c, bottom: undefined, top: { ...c.top!, fill, params: params as TopParams } }
      : { ...c, top: undefined, bottom: { ...c.bottom!, fill, params: params as BottomParams } };
  }
  const c = newCanvas('one_piece');
  return { ...c, onePiece: { ...c.onePiece!, fill, params: params as OnePieceParams } };
}
