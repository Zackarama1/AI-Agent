import { describe, expect, it } from 'vitest';
import { BOTTOM_TEMPLATES, newCanvas, ONE_PIECE_TEMPLATES, TOP_TEMPLATES, withBottomTemplate, withOnePieceTemplate, withTopTemplate, DEFAULT_BOTTOM, DEFAULT_ONE_PIECE, DEFAULT_TOP } from '@/lib/garment/defaults';
import { describeChanges } from '@/lib/garment/diff';
import { SIZES } from '@/lib/garment/grading';
import { addEmbellishment, setFill, setParams } from '@/lib/garment/ops';
import { canvasMeasurements, renderBottom, renderGarmentSvg, renderTop } from '@/lib/garment/render';
import { canvasStateSchema, parseCanvas } from '@/lib/garment/schema';
import { EMBELLISHMENT_TYPES, PRINTS, type CanvasState, type CanvasView } from '@/lib/garment/types';
import { designVersions } from '@/lib/seed/designs';

const VIEWS: CanvasView[] = ['front', 'back', 'side'];
const seedCanvas = designVersions[0].canvas;

function expectWellFormed(svg: string) {
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg.endsWith('</svg>')).toBe(true);
  expect(svg).not.toMatch(/NaN|undefined|Infinity/);
}

describe('parametric garment engine', () => {
  it.each(TOP_TEMPLATES)('renders top %s in every view and size', (t) => {
    const canvas: CanvasState = { ...newCanvas('bikini', withTopTemplate(DEFAULT_TOP, t)), bottom: undefined };
    for (const view of VIEWS) for (const size of SIZES) expectWellFormed(renderGarmentSvg(canvas, { view, size }));
  });

  it.each(BOTTOM_TEMPLATES)('renders bottom %s in every view and size', (t) => {
    const canvas: CanvasState = { ...newCanvas('bikini', undefined, withBottomTemplate(DEFAULT_BOTTOM, t)), top: undefined };
    for (const view of VIEWS) for (const size of SIZES) expectWellFormed(renderGarmentSvg(canvas, { view, size }));
  });

  it.each(ONE_PIECE_TEMPLATES)('renders one-piece %s in every view and size', (t) => {
    const base = newCanvas('one_piece');
    const canvas = { ...base, onePiece: { ...base.onePiece!, params: withOnePieceTemplate(DEFAULT_ONE_PIECE, t) } };
    for (const view of VIEWS) for (const size of SIZES) expectWellFormed(renderGarmentSvg(canvas, { view, size, mode: 'sketch' }));
  });

  it('renders every embellishment type on every part path', () => {
    let canvas = seedCanvas;
    for (const type of EMBELLISHMENT_TYPES) {
      canvas = addEmbellishment(canvas, { type, part: 'top' }).canvas;
      canvas = addEmbellishment(canvas, { type, part: 'bottom' }).canvas;
    }
    canvas = { ...canvas, hardware: [{ id: 'h1', type: 'ring', finish: 'gold', sizeMm: 20, placement: 'centre_front' }] };
    for (const mode of ['rendered', 'sketch'] as const) expectWellFormed(renderGarmentSvg(canvas, { mode, grid: true }));
  });

  it('renders every print', () => {
    for (const print of PRINTS) {
      const c = newCanvas('bikini');
      expectWellFormed(renderGarmentSvg({ ...c, top: { ...c.top!, fill: { kind: 'print', print, hex: '#FBF7F2', accentHex: '#C8664B', scale: 1 } } }));
    }
  });

  it('grades measurements up through the size run', () => {
    const cup = SIZES.map((s) => canvasMeasurements(seedCanvas, s)[0].measurements.find((m) => m.code === 'T1')!.valueCm);
    const leg = SIZES.map((s) => canvasMeasurements(seedCanvas, s)[1].measurements.find((m) => m.code === 'B4')!.valueCm);
    expect(cup).toEqual([...cup].sort((a, b) => a - b));
    expect(new Set(cup).size).toBe(SIZES.length);
    expect(leg).toEqual([...leg].sort((a, b) => a - b));
    // base size M equals the authored parameter
    expect(cup[2]).toBe(seedCanvas.top!.params.cupHeightCm);
  });

  it('applies default tolerances: ±0.5 cm small, ±1 cm large', () => {
    const { measurements } = renderBottom(DEFAULT_BOTTOM);
    for (const m of measurements) expect(m.toleranceCm).toBe(m.valueCm >= 10 ? 1 : 0.5);
  });

  it('exposes the brief §5.2 renderTop signature', () => {
    const { svg, measurements } = renderTop(DEFAULT_TOP, 'S');
    expectWellFormed(svg);
    expect(measurements.map((m) => m.code)).toContain('T1');
  });

  it('keeps pattern ids unique per render prefix', () => {
    const a = renderGarmentSvg(seedCanvas, { idPrefix: 'a' });
    expect(a).toContain('id="a-1"');
    expect(a).not.toContain('id="gs-');
  });
});

describe('safety', () => {
  it('escapes annotation text', () => {
    const svg = renderGarmentSvg({ ...seedCanvas, annotations: [{ id: 'x', x: 0.1, y: 0.1, text: '<script>alert(1)</script>' }] }, { annotations: true });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('never emits unsafe image URLs or colours', () => {
    const c = newCanvas('bikini');
    const evil = { ...c, top: { ...c.top!, fill: { kind: 'image' as const, imageUrl: 'javascript:alert(1)', scale: 1 } }, bottom: { ...c.bottom!, fill: { kind: 'solid' as const, hex: '"/><script>' } } };
    const svg = renderGarmentSvg(evil);
    expect(svg).not.toContain('javascript:');
    expect(svg).not.toContain('<script>');
  });

  it('validates canvas input', () => {
    expect(() => parseCanvas(seedCanvas)).not.toThrow();
    expect(canvasStateSchema.safeParse({ ...seedCanvas, top: { ...seedCanvas.top!, fill: { kind: 'solid', hex: 'red' } } }).success).toBe(false);
    expect(canvasStateSchema.safeParse(setParams(seedCanvas, 'top', { cupHeightCm: 500 })).success).toBe(false);
    expect(canvasStateSchema.safeParse({ ...seedCanvas, top: { ...seedCanvas.top!, fill: { kind: 'image', imageUrl: 'http://x/y.png', scale: 1 } } }).success).toBe(false);
  });
});

describe('change summaries', () => {
  it('describes parameter, fabric and embellishment changes', () => {
    let next = setParams(seedCanvas, 'top', { cupHeightCm: 13 });
    next = addEmbellishment(next, { type: 'pearl', part: 'top' }).canvas;
    expect(describeChanges(seedCanvas, next)).toBe('Top cup height 15 cm → 13 cm; Added pearl on cup upper edge');
    expect(describeChanges(null, seedCanvas)).toBe('First version.');
    expect(describeChanges(seedCanvas, seedCanvas)).toBe('No visible changes.');
    const recoloured = setFill(seedCanvas, 'bottom', { kind: 'solid', hex: '#D8B98A', colourId: 'c1' });
    expect(describeChanges(seedCanvas, recoloured, { c1: 'Champagne' })).toBe('Bottom fabric → Champagne');
  });

  it('detaches a saved shape when its measurements change', () => {
    expect(setParams(seedCanvas, 'top', { cupWidthCm: 15 }).top!.shapeId).toBeUndefined();
  });
});
