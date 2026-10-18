import { darken, lighten, luminance, mix, safeHex } from './colour';
import { bbox, pointAt, pointInPolygon, pointsAlong, seededRandom, toPath, translate, type Polyline, type Pt } from './geometry';
import { BASE_SIZE, type Measurement, type SizeLabel } from './grading';
import { buildBottom, measureBottom } from './templates/bottom';
import { buildOnePiece, measureOnePiece } from './templates/one-piece';
import type { Piece } from './templates/piece';
import { buildTop, measureTop } from './templates/top';
import { crochetPattern, embroideryPattern, lacePattern, meshPattern, ruchingPattern } from './textures/lace';
import { printPattern } from './textures/prints';
import type {
  BottomParams, CanvasState, CanvasView, Embellishment, Fill, HardwareFinish, HardwareItem, PiecePart, TopParams,
} from './types';

export const SCALE = 10; // SVG units per centimetre
const INK = '#2B2422';
const SKIN_GROUND = '#F3E3DA'; // shown through sheer lace when no base colour is set
const BOTTOM_OFFSET_CM = 16; // gap between the top's under-bust line and the bottom's waist edge

export const FINISH_HEX: Record<HardwareFinish, string> = {
  gold: '#C9A55A',
  rose_gold: '#D3A28F',
  silver: '#BFC1C2',
  pearl: '#F2ECE2',
  tortoise: '#8A5A34',
  clear: '#E3EBEE',
};

export interface RenderOptions {
  view?: CanvasView;
  mode?: 'rendered' | 'sketch';
  size?: SizeLabel;
  grid?: boolean;
  annotations?: boolean;
  idPrefix?: string;                    // keeps <pattern> ids unique when several SVGs share a page
  colourHex?: Record<string, string>;   // colour library: id → hex, for embellishments
  selected?: { part?: PiecePart; embellishmentId?: string } | null;
  padCm?: number;
}

export interface PlacedPiece {
  piece: Piece;
  state: { fill: Fill; lining: Fill };
}

// ---------------------------------------------------------------------------
// Geometry assembly
// ---------------------------------------------------------------------------

function offset(piece: Piece, dy: number): Piece {
  if (!dy) return piece;
  const t = (p: Polyline) => translate(p, 0, dy);
  const mapRecord = (r: Record<string, Polyline[]>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.map(t)]));
  return {
    ...piece,
    outlines: piece.outlines.map(t),
    holes: piece.holes.map(t),
    seams: piece.seams.map(t),
    strings: piece.strings.map((s) => ({ ...s, pts: t(s.pts) })),
    bows: piece.bows.map(([x, y]) => [x, y + dy] as Pt),
    edges: mapRecord(piece.edges),
    areas: mapRecord(piece.areas),
    anchors: Object.fromEntries(Object.entries(piece.anchors).map(([k, v]) => [k, v!.map(([x, y]) => [x, y + dy] as Pt)])),
  };
}

export function placePieces(canvas: CanvasState, size: SizeLabel = BASE_SIZE, view: CanvasView = 'front'): PlacedPiece[] {
  const out: PlacedPiece[] = [];
  if (canvas.onePiece) out.push({ piece: buildOnePiece(canvas.onePiece.params, size, view), state: canvas.onePiece });
  if (canvas.top) out.push({ piece: buildTop(canvas.top.params, size, view), state: canvas.top });
  if (canvas.bottom) {
    const dy = canvas.top ? BOTTOM_OFFSET_CM : 0;
    out.push({ piece: offset(buildBottom(canvas.bottom.params, size, view), dy), state: canvas.bottom });
  }
  return out;
}

export function canvasMeasurements(canvas: CanvasState, size: SizeLabel = BASE_SIZE): { part: PiecePart; measurements: Measurement[] }[] {
  const out: { part: PiecePart; measurements: Measurement[] }[] = [];
  if (canvas.top) out.push({ part: 'top', measurements: measureTop(canvas.top.params, size) });
  if (canvas.bottom) out.push({ part: 'bottom', measurements: measureBottom(canvas.bottom.params, size) });
  if (canvas.onePiece) out.push({ part: 'one_piece', measurements: measureOnePiece(canvas.onePiece.params, size) });
  return out;
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SAFE_IMAGE = /^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/;
export const isSafeImageUrl = (url: string) => SAFE_IMAGE.test(url);

const d = (pts: Polyline, closed = false) => toPath(pts, closed, SCALE);
const sc = ([x, y]: Pt): Pt => [Math.round(x * SCALE * 100) / 100, Math.round(y * SCALE * 100) / 100];

class Defs {
  private items = new Map<string, string>();
  private n = 0;
  constructor(private prefix: string) {}
  add(key: string, build: (id: string) => string): string {
    const existing = this.items.get(key);
    if (existing) return existing.match(/id="([^"]+)"/)![1];
    const id = `${this.prefix}-${++this.n}`;
    this.items.set(key, build(id));
    return id;
  }
  toString() {
    return [...this.items.values()].join('');
  }
}

// Paint for a fabric fill: a base colour plus an optional texture overlay.
function fillPaint(fill: Fill, defs: Defs, sketch: boolean): { base: string; overlay?: string; hex: string } {
  if (sketch) {
    if (fill.kind === 'lace') return { base: '#FFFFFF', overlay: `url(#${defs.add(`lace-${fill.texture}-ink`, (id) => lacePattern(id, fill.texture, '#8C807A'))})`, hex: '#FFFFFF' };
    if (fill.kind === 'crochet') return { base: '#FFFFFF', overlay: `url(#${defs.add('crochet-ink', (id) => crochetPattern(id, '#8C807A'))})`, hex: '#FFFFFF' };
    return { base: '#FFFFFF', hex: '#FFFFFF' };
  }
  switch (fill.kind) {
    case 'solid':
      return { base: safeHex(fill.hex), hex: safeHex(fill.hex) };
    case 'print': {
      const [b, a] = [safeHex(fill.hex), safeHex(fill.accentHex, '#D8B98A')];
      const id = defs.add(`print-${fill.print}-${b}-${a}-${fill.scale}`, (pid) => printPattern(pid, fill.print, b, a, fill.scale));
      return { base: `url(#${id})`, hex: b };
    }
    case 'image': {
      if (!isSafeImageUrl(fill.imageUrl)) return { base: '#FEF5F4', hex: '#FEF5F4' };
      const size = 120 * Math.min(Math.max(fill.scale, 0.25), 4);
      const id = defs.add(`img-${fill.imageUrl.slice(-40)}-${fill.scale}`, (pid) =>
        `<pattern id="${pid}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><image href="${escapeXml(fill.imageUrl)}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"/></pattern>`);
      return { base: `url(#${id})`, hex: '#E8C4C0' };
    }
    case 'lace': {
      const hex = safeHex(fill.hex);
      const id = defs.add(`lace-${fill.texture}-${hex}`, (pid) => lacePattern(pid, fill.texture, laceInk(hex)));
      return { base: fill.baseHex ? safeHex(fill.baseHex) : SKIN_GROUND, overlay: `url(#${id})`, hex };
    }
    case 'crochet': {
      const hex = safeHex(fill.hex);
      const id = defs.add(`crochet-${hex}`, (pid) => crochetPattern(pid, hex));
      return { base: fill.baseHex ? safeHex(fill.baseHex) : SKIN_GROUND, overlay: `url(#${id})`, hex };
    }
    case 'mesh': {
      const hex = safeHex(fill.hex);
      const id = defs.add(`mesh-${hex}`, (pid) => meshPattern(pid, hex));
      return { base: mix(SKIN_GROUND, hex, Math.min(Math.max(fill.opacity, 0), 1) * 0.6), overlay: `url(#${id})`, hex };
    }
  }
}

// Tonal lace (lace dyed to match a pale fabric) still needs visible cording.
const laceInk = (hex: string) => (luminance(hex) > 0.75 ? darken(hex, 0.28) : hex);

const outlineStroke = (hex: string, sketch: boolean) => (sketch ? INK : darken(hex, luminance(hex) > 0.5 ? 0.35 : 0.15));

function bowGlyph([x, y]: Pt, colour: string, stroke: string, r = 1.6): string {
  const [cx, cy] = sc([x, y]);
  const s = r * SCALE;
  return `<g stroke="${stroke}" stroke-width="0.8" fill="${colour}">
    <path d="M${cx} ${cy}C${cx - s} ${cy - s * 0.9} ${cx - s * 1.2} ${cy + s * 0.6} ${cx} ${cy}Z"/>
    <path d="M${cx} ${cy}C${cx + s} ${cy - s * 0.9} ${cx + s * 1.2} ${cy + s * 0.6} ${cx} ${cy}Z"/>
    <circle cx="${cx}" cy="${cy}" r="${s * 0.22}"/></g>`;
}

function flowerGlyph([x, y]: Pt, colour: string, stroke: string, r: number): string {
  const [cx, cy] = sc([x, y]);
  const petals = [0, 72, 144, 216, 288]
    .map((deg) => `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * 0.32}" ry="${r * 0.55}" transform="rotate(${deg} ${cx} ${cy})"/>`)
    .join('');
  return `<g fill="${colour}" stroke="${stroke}" stroke-width="0.5">${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="${stroke}"/></g>`;
}

// ---------------------------------------------------------------------------
// Embellishments & hardware
// ---------------------------------------------------------------------------

const AREA_TYPES = new Set<Embellishment['type']>(['lace_overlay', 'crochet_panel', 'embroidery', 'ruching', 'lace_trim']);

function renderEmbellishment(e: Embellishment, piece: Piece, fillHex: string, defs: Defs, opts: RenderOptions): string {
  const sketch = opts.mode === 'sketch';
  // In flat sketches, textures read as mid-grey so construction lines stay dominant.
  const colour = sketch ? (AREA_TYPES.has(e.type) ? '#8C807A' : INK) : safeHex(e.colourId ? opts.colourHex?.[e.colourId] : undefined, darken(fillHex, 0.12));
  const stroke = sketch ? INK : darken(colour, 0.3);
  const closed = (p: Polyline) => [...p, p[0]];
  const edges = piece.edges[e.path] ?? piece.areas[e.path]?.map(closed) ?? [];
  const areas = piece.areas[e.path] ?? piece.outlines;
  const selected = opts.selected?.embellishmentId === e.id;
  const parts: string[] = [];

  const dots = (spacingCm: number, r: number, fill: string, ring?: string) =>
    edges.flatMap((edge) => pointsAlong(edge, spacingCm)).map((p) => {
      const [cx, cy] = sc(p);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${ring ?? stroke}" stroke-width="0.4"/>`;
    });

  switch (e.type) {
    case 'lace_trim': {
      const w = e.widthMm ?? 20;
      const lace = defs.add(`lace-floral-${colour}`, (id) => lacePattern(id, 'floral', laceInk(colour)));
      for (const edge of edges) {
        parts.push(`<path d="${d(edge)}" stroke="${sketch ? '#FFFFFF' : SKIN_GROUND}" stroke-opacity="0.55" stroke-width="${w}" fill="none" stroke-linejoin="round"/>`);
        parts.push(`<path d="${d(edge)}" stroke="url(#${lace})" stroke-width="${w}" fill="none" stroke-linejoin="round"/>`);
        parts.push(`<path d="${d(edge)}" stroke="${colour}" stroke-width="${w * 0.3}" stroke-dasharray="0 ${w * 0.32}" stroke-linecap="round" fill="none" transform="translate(0 ${w * 0.35})" opacity="0.8"/>`);
      }
      break;
    }
    case 'scallop_edge': {
      const w = e.widthMm ?? 8;
      for (const edge of edges) parts.push(`<path d="${d(edge)}" stroke="${colour}" stroke-width="${w}" stroke-dasharray="0 ${w}" stroke-linecap="round" fill="none"/>`);
      break;
    }
    case 'contrast_binding': {
      for (const edge of edges) parts.push(`<path d="${d(edge)}" stroke="${colour}" stroke-width="${e.widthMm ?? 10}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
      break;
    }
    case 'ruffle': {
      const w = e.widthMm ?? 18;
      for (const edge of edges) {
        parts.push(`<path d="${d(edge)}" stroke="${stroke}" stroke-width="${w + 1.2}" fill="none" stroke-linejoin="round"/>`);
        parts.push(`<path d="${d(edge)}" stroke="${sketch ? '#FFFFFF' : lighten(colour, 0.25)}" stroke-width="${w}" fill="none" stroke-linejoin="round"/>`);
        parts.push(`<path d="${d(edge)}" stroke="${stroke}" stroke-width="${w}" stroke-dasharray="0.6 3.4" fill="none" opacity="0.5"/>`);
      }
      break;
    }
    case 'bead_strand':
      parts.push(...dots((e.spacingMm ?? 6) / 10, 1.3, sketch ? '#FFFFFF' : colour));
      break;
    case 'pearl': {
      const pearl = defs.add('pearl-gradient', (id) =>
        `<radialGradient id="${id}" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.6" stop-color="#F2ECE2"/><stop offset="1" stop-color="#CFC3B3"/></radialGradient>`);
      parts.push(...dots((e.spacingMm ?? 12) / 10, (e.widthMm ?? 5) / 2, sketch ? '#FFFFFF' : `url(#${pearl})`, sketch ? INK : '#B9AC9B'));
      break;
    }
    case 'applique_flower':
      for (const p of edges.flatMap((edge) => pointsAlong(edge, (e.spacingMm ?? 28) / 10))) parts.push(flowerGlyph(p, sketch ? '#FFFFFF' : colour, stroke, (e.widthMm ?? 14) / 2));
      break;
    case 'charm':
      for (const p of edges.flatMap((edge) => pointsAlong(edge, (e.spacingMm ?? 35) / 10))) {
        const [cx, cy] = sc(p);
        parts.push(`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + 6}" stroke="${stroke}" stroke-width="0.6"/><path d="M${cx} ${cy + 6}l3 4l-3 4l-3-4z" fill="${sketch ? '#FFFFFF' : colour}" stroke="${stroke}" stroke-width="0.5"/>`);
      }
      break;
    case 'bow':
      for (const edge of edges) parts.push(bowGlyph(pointAt(edge, 0.5), sketch ? '#FFFFFF' : colour, stroke, (e.widthMm ?? 30) / 20));
      break;
    case 'ring':
    case 'logo_hardware':
      for (const edge of edges) {
        const [cx, cy] = sc(pointAt(edge, 0.5));
        const metal = sketch ? INK : FINISH_HEX.gold;
        parts.push(
          e.type === 'ring'
            ? `<circle cx="${cx}" cy="${cy}" r="${(e.widthMm ?? 20) / 2}" fill="none" stroke="${metal}" stroke-width="2.6"/>`
            : `<rect x="${cx - 7}" y="${cy - 2.5}" width="14" height="5" rx="2" fill="${sketch ? '#FFFFFF' : metal}" stroke="${sketch ? INK : darken(metal, 0.3)}" stroke-width="0.6"/>`,
        );
      }
      break;
    case 'lace_overlay':
    case 'crochet_panel':
    case 'embroidery':
    case 'ruching': {
      const id =
        e.type === 'lace_overlay' ? defs.add(`lace-floral-${colour}`, (pid) => lacePattern(pid, 'floral', laceInk(colour)))
        : e.type === 'crochet_panel' ? defs.add(`crochet-${colour}`, (pid) => crochetPattern(pid, colour))
        : e.type === 'embroidery' ? defs.add(`embroidery-${colour}`, (pid) => embroideryPattern(pid, colour))
        : defs.add(`ruching-${stroke}`, (pid) => ruchingPattern(pid, stroke));
      for (const area of areas) parts.push(`<path d="${d(area, true)}" fill="url(#${id})" stroke="none"/>`);
      break;
    }
    case 'bead_scatter': {
      const rand = seededRandom(e.id);
      for (const area of areas) {
        const b = bbox([area]);
        const target = e.density ?? 40;
        let placed = 0;
        for (let tries = 0; placed < target && tries < target * 8; tries++) {
          const p: Pt = [b.minX + rand() * (b.maxX - b.minX), b.minY + rand() * (b.maxY - b.minY)];
          if (!pointInPolygon(p, area)) continue;
          const [cx, cy] = sc(p);
          parts.push(`<circle cx="${cx}" cy="${cy}" r="1.1" fill="${sketch ? INK : colour}" stroke="${stroke}" stroke-width="0.3"/>`);
          placed++;
        }
      }
      break;
    }
  }

  if (!parts.length) return '';
  const highlight = selected
    ? edges.map((edge) => `<path d="${d(edge)}" stroke="#D8B98A" stroke-width="2" stroke-dasharray="4 3" fill="none"/>`).join('')
    : '';
  return `<g data-embellishment="${escapeXml(e.id)}">${parts.join('')}${highlight}</g>`;
}

function renderHardware(h: HardwareItem, pieces: Piece[], sketch: boolean): string {
  const metal = sketch ? INK : FINISH_HEX[h.finish];
  const edge = sketch ? INK : darken(metal, 0.35);
  const r = Math.max(h.sizeMm, 4) / 2;
  const points = pieces.flatMap((p) => p.anchors[h.placement] ?? []);
  return points
    .map((pt) => {
      const [cx, cy] = sc(pt);
      switch (h.type) {
        case 'ring':
          return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${edge}" stroke-width="3.4"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${metal}" stroke-width="2.4"/>`;
        case 'slider':
          return `<rect x="${cx - r}" y="${cy - r * 0.45}" width="${r * 2}" height="${r * 0.9}" rx="${r * 0.3}" fill="${sketch ? '#FFFFFF' : metal}" stroke="${edge}" stroke-width="0.8"/><line x1="${cx}" y1="${cy - r * 0.45}" x2="${cx}" y2="${cy + r * 0.45}" stroke="${edge}" stroke-width="0.8"/>`;
        case 'clasp':
          return `<rect x="${cx - r}" y="${cy - r * 0.5}" width="${r * 0.95}" height="${r}" rx="1.5" fill="${sketch ? '#FFFFFF' : metal}" stroke="${edge}" stroke-width="0.8"/><rect x="${cx + r * 0.05}" y="${cy - r * 0.5}" width="${r * 0.95}" height="${r}" rx="1.5" fill="${sketch ? '#FFFFFF' : metal}" stroke="${edge}" stroke-width="0.8"/>`;
        case 'toggle':
          return `<rect x="${cx - r}" y="${cy - 1.6}" width="${r * 2}" height="3.2" rx="1.6" fill="${sketch ? '#FFFFFF' : metal}" stroke="${edge}" stroke-width="0.6"/>`;
        case 'bead_end':
          return `<circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="${sketch ? '#FFFFFF' : metal}" stroke="${edge}" stroke-width="0.6"/>`;
      }
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

function renderPiece(placed: PlacedPiece, canvas: CanvasState, defs: Defs, opts: RenderOptions): string {
  const { piece, state } = placed;
  const sketch = opts.mode === 'sketch';
  const paint = fillPaint(piece.insideOut ? state.lining : state.fill, defs, sketch);
  const fabricHex = fillPaint(state.fill, defs, false).hex;
  const line = outlineStroke(paint.hex, sketch);
  const shade = sketch
    ? null
    : defs.add('shade', (id) =>
        `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#2B2422" stop-opacity="0.10"/></linearGradient>`);
  const body = piece.outlines.map((o, i) => d(o, true) + (i === 0 ? piece.holes.map((h) => d(h, true)).join('') : '')).join('');
  const out: string[] = [];

  // straps and ties sit behind the panels
  for (const s of piece.strings) {
    out.push(`<path d="${d(s.pts)}" stroke="${line}" stroke-width="${s.widthCm * SCALE + 1}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    out.push(`<path d="${d(s.pts)}" stroke="${sketch ? '#FFFFFF' : fabricHex}" stroke-width="${s.widthCm * SCALE}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  for (const o of piece.outlines) {
    const isFirst = o === piece.outlines[0];
    const path = d(o, true) + (isFirst ? piece.holes.map((h) => d(h, true)).join('') : '');
    out.push(`<path d="${path}" fill="${paint.base}" fill-rule="evenodd" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"${piece.insideOut && !sketch ? ' opacity="0.92"' : ''}/>`);
    if (paint.overlay) out.push(`<path d="${path}" fill="${paint.overlay}" fill-rule="evenodd"/>`);
    if (shade) out.push(`<path d="${path}" fill="url(#${shade})" fill-rule="evenodd"/>`);
  }
  for (const seam of piece.seams) {
    out.push(`<path d="${d(seam)}" stroke="${line}" stroke-width="0.7" stroke-dasharray="3 2.2" fill="none" opacity="${sketch ? 0.9 : 0.55}"/>`);
  }
  for (const b of piece.bows) out.push(bowGlyph(b, sketch ? '#FFFFFF' : fabricHex, line));

  const embellishments = canvas.embellishments.filter((e) =>
    e.part === piece.part || ((e.part === 'strap' || e.part === 'tie') && piece.edges[e.path]),
  );
  for (const e of embellishments) out.push(renderEmbellishment(e, piece, fabricHex, defs, opts));

  if (opts.selected?.part === piece.part) {
    out.push(`<path d="${body}" fill="none" stroke="#D8B98A" stroke-width="2.4" stroke-dasharray="6 4" pointer-events="none"/>`);
  }
  return `<g data-part="${piece.part}" style="cursor:pointer">${out.join('')}</g>`;
}

function gridLines(vb: { x: number; y: number; w: number; h: number }): string {
  const lines: string[] = [];
  const start = (v: number) => Math.ceil(v / SCALE) * SCALE;
  for (let x = start(vb.x); x <= vb.x + vb.w; x += SCALE) {
    lines.push(`<line x1="${x}" y1="${vb.y}" x2="${x}" y2="${vb.y + vb.h}" stroke-width="${x % 50 === 0 ? 0.5 : 0.25}"/>`);
  }
  for (let y = start(vb.y); y <= vb.y + vb.h; y += SCALE) {
    lines.push(`<line x1="${vb.x}" y1="${y}" x2="${vb.x + vb.w}" y2="${y}" stroke-width="${y % 50 === 0 ? 0.5 : 0.25}"/>`);
  }
  return `<g stroke="#D8B98A" opacity="0.5" data-grid>${lines.join('')}</g>`;
}

export function renderGarmentSvg(canvas: CanvasState, opts: RenderOptions = {}): string {
  const view = opts.view ?? 'front';
  const defs = new Defs(opts.idPrefix ?? 'gs');
  const placed = placePieces(canvas, opts.size ?? BASE_SIZE, view);
  const pieces = placed.map((p) => p.piece);

  const allPolys = pieces.flatMap((p) => [...p.outlines, ...p.strings.map((s) => s.pts)]);
  const b = allPolys.length ? bbox(allPolys) : { minX: -20, minY: -20, maxX: 20, maxY: 20 };
  const pad = opts.padCm ?? 6;
  const vb = {
    x: Math.floor((b.minX - pad) * SCALE),
    y: Math.floor((b.minY - pad) * SCALE),
    w: Math.ceil((b.maxX - b.minX + pad * 2) * SCALE),
    h: Math.ceil((b.maxY - b.minY + pad * 2) * SCALE),
  };

  const body = placed.map((p) => renderPiece(p, canvas, defs, opts)).join('');
  const hardware = canvas.hardware.map((h) => renderHardware(h, pieces, opts.mode === 'sketch')).join('');
  const notes =
    opts.annotations && view === 'front'
      ? canvas.annotations
          .map((a) => {
            const x = vb.x + Math.min(Math.max(a.x, 0), 1) * vb.w;
            const y = vb.y + Math.min(Math.max(a.y, 0), 1) * vb.h;
            return `<g data-annotation="${escapeXml(a.id)}"><circle cx="${x}" cy="${y}" r="3" fill="#A8834B"/><text x="${x + 6}" y="${y + 3.5}" font-size="11" font-family="Manrope, sans-serif" fill="${INK}">${escapeXml(a.text)}</text></g>`;
          })
          .join('')
      : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" role="img" aria-label="${escapeXml(`${canvas.category} — ${view} view`)}">`,
    `<defs>${defs}</defs>`,
    opts.grid ? gridLines(vb) : '',
    body,
    hardware,
    notes,
    '</svg>',
  ].join('');
}

// Brief §5.2 convenience signatures: one piece, front view, plus its measurements.
export function renderTop(params: TopParams, size: SizeLabel = BASE_SIZE) {
  const canvas: CanvasState = { category: 'bikini', top: { params, fill: { kind: 'solid', hex: '#FEF5F4' }, lining: { kind: 'solid', hex: SKIN_GROUND } }, embellishments: [], hardware: [], views: { front: true, back: true, side: false }, annotations: [] };
  return { svg: renderGarmentSvg(canvas, { size, mode: 'sketch' }), measurements: measureTop(params, size) };
}

export function renderBottom(params: BottomParams, size: SizeLabel = BASE_SIZE) {
  const canvas: CanvasState = { category: 'bikini', bottom: { params, fill: { kind: 'solid', hex: '#FEF5F4' }, lining: { kind: 'solid', hex: SKIN_GROUND } }, embellishments: [], hardware: [], views: { front: true, back: true, side: false }, annotations: [] };
  return { svg: renderGarmentSvg(canvas, { size, mode: 'sketch' }), measurements: measureBottom(params, size) };
}

