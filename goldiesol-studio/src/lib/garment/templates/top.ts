import { cubic, join, length, line, mirrorX, quad, type Polyline, type Pt } from '../geometry';
import { grade, pom, type Grade, type Measurement, type SizeLabel } from '../grading';
import type { CanvasView, TopParams, TopTemplate } from '../types';
import { addArea, addEdge, clamp, emptyPiece, type Piece } from './piece';

// Coordinate system (cm): x = 0 is centre front, y = 0 is the underbust line, y grows downwards.

type TopFamily = 'triangle' | 'halter' | 'bandeau' | 'balconette' | 'underwire';

// Templates without bespoke geometry render from the closest base.
// TODO(phase 9): bespoke geometry for sliding_triangle, scoop, bralette, one_shoulder, ring_front, tie_front, crop.
export const TOP_FAMILY: Record<TopTemplate, TopFamily> = {
  triangle: 'triangle',
  sliding_triangle: 'triangle',
  halter: 'halter',
  bandeau: 'bandeau',
  one_shoulder: 'bandeau',
  ring_front: 'bandeau',
  tie_front: 'bandeau',
  crop: 'bandeau',
  balconette: 'balconette',
  bralette: 'balconette',
  underwire: 'underwire',
  scoop: 'underwire',
};

interface Dims {
  g: Grade;
  cupH: number;
  cupW: number;
  gap: number;       // half the centre-front gap between cups
  neckY: number;     // y of the halter neck point
  strapW: number;    // cm
  tieLen: number;
}

function dims(p: TopParams, size: SizeLabel): Dims {
  const g = grade(size);
  const cupH = p.cupHeightCm * g.length;
  return {
    g,
    cupH,
    cupW: p.cupWidthCm * g.width,
    gap: clamp(0.6 + (p.necklineDepthCm - 6) * 0.25, 0.3, 3.5),
    neckY: -cupH - 15 * g.length,
    strapW: p.strapWidthMm / 10,
    tieLen: 42 * g.length,
  };
}

function addStraps(piece: Piece, p: TopParams, d: Dims, apexR: Pt, view: CanvasView) {
  if (p.strapStyle === 'strapless') return;
  const halter = p.strapStyle === 'halter' || p.strapStyle === 'tie';
  const neck: Pt = [d.gap + 2.2, d.neckY];
  for (const sign of [1, -1]) {
    const apex: Pt = [apexR[0] * sign, apexR[1]];
    let strap: Polyline;
    if (view === 'back') {
      if (halter) strap = quad([sign * 1.2, d.neckY + 1], [sign * 3, d.neckY + 4], [sign * 4, d.neckY + 7]);
      else if (p.strapStyle === 'cross_back') strap = line([sign * (d.cupW + d.gap), d.neckY + 3], [-sign * (d.cupW * 0.6), -0.8]);
      else strap = line([sign * (apexR[0] + 1), d.neckY + 3], [sign * (apexR[0] + 1.5), -0.8]);
    } else {
      strap = halter
        ? quad(apex, [sign * (apexR[0] - 1), (apex[1] + d.neckY) / 2], [sign * neck[0], neck[1]])
        : line(apex, [sign * (apexR[0] + 1), d.neckY + 3]);
    }
    piece.strings.push({ pts: strap, widthCm: d.strapW });
    addEdge(piece, 'strap', strap);
    if (view !== 'back') piece.anchors.straps = [...(piece.anchors.straps ?? []), strap[Math.floor(strap.length * 0.4)]];
  }
  if (p.strapStyle === 'tie' && view === 'back') piece.bows.push([0, d.neckY + 1]);
}

// Under-bust ties or band running round the body to the back.
function addBackClosure(piece: Piece, p: TopParams, d: Dims, halfWidth: number, y: number) {
  const left: Polyline = line([-halfWidth - 6, y], [-1.2, y]);
  const right: Polyline = line([1.2, y], [halfWidth + 6, y]);
  piece.strings.push({ pts: left, widthCm: 0.9 }, { pts: right, widthCm: 0.9 });
  addEdge(piece, 'tie', left, right);
  if (p.closure === 'tie_back') {
    piece.bows.push([0, y]);
    piece.strings.push({ pts: line([0, y], [-1.5, y + 9]), widthCm: 0.6 }, { pts: line([0, y], [2, y + 9.5]), widthCm: 0.6 });
  } else {
    piece.anchors.centre_back = [[0, y]];
  }
}

function sideTies(piece: Piece, d: Dims, outer: number, y: number) {
  for (const sign of [1, -1]) {
    const tie = join(line([sign * outer, y], [sign * (outer + 6), y + 0.3]), quad([sign * (outer + 6), y + 0.3], [sign * (outer + 8), y + 3], [sign * (outer + 7.5), y + 8]));
    piece.strings.push({ pts: tie, widthCm: 0.7 });
    addEdge(piece, 'tie', tie);
    piece.anchors.tie_ends = [...(piece.anchors.tie_ends ?? []), tie[tie.length - 1]];
  }
}

function triangleCup(d: Dims, inner: number): { outline: Polyline; upper: Polyline; lower: Polyline; apex: Pt } {
  const { cupW: W, cupH: H } = d;
  const A: Pt = [inner, 0];
  const B: Pt = [inner + W, 0];
  const C: Pt = [inner + W * 0.38, -H];
  const lower = quad(A, [inner + W / 2, 0.5], B);
  const outer = cubic(B, [inner + W * 0.97, -H * 0.38], [inner + W * 0.62, -H * 0.86], C);
  const innerEdge = quad(C, [inner + W * 0.1, -H * 0.42], A);
  return { outline: join(lower, outer, innerEdge), upper: join(outer, innerEdge), lower, apex: C };
}

function buildTriangle(p: TopParams, d: Dims, view: CanvasView, halter: boolean): Piece {
  const piece = emptyPiece('top');
  const inner = halter ? 0.25 : d.gap;
  const cup = triangleCup(d, inner);
  const band = halter ? 2.5 * d.g.length : 0;

  for (const flip of [false, true]) {
    const m = (pts: Polyline) => (flip ? mirrorX(pts) : pts);
    const outline = m(cup.outline);
    piece.outlines.push(outline);
    addArea(piece, 'cup_full', outline);
    addEdge(piece, 'cup_upper_edge', m(cup.upper));
    if (!halter) addEdge(piece, 'cup_lower_edge', m(cup.lower));
    // gathered centre seam and casing channel
    piece.seams.push(m(line(cup.apex, [inner + d.cupW * 0.46, 0])));
    if (!halter) piece.seams.push(m(line([inner + 0.5, -1.1], [inner + d.cupW - 0.6, -1.1])));
  }

  const outer = inner + d.cupW;
  if (halter) {
    const bandPoly: Polyline = [[-outer, 0], [outer, 0], [outer, band], [-outer, band]];
    piece.outlines.push(bandPoly);
    addEdge(piece, 'band', line([-outer, band], [outer, band]));
    addEdge(piece, 'cup_lower_edge', line([-outer, band], [outer, band]));
    piece.seams.push(line([-outer + 0.4, 0.2], [outer - 0.4, 0.2]));
  } else {
    // centre-front string through the casing
    piece.strings.push({ pts: line([-inner, -0.55], [inner, -0.55]), widthCm: 0.6 });
  }
  piece.anchors.centre_front = [[0, halter ? band / 2 : -0.55]];

  if (view === 'back') {
    piece.insideOut = true;
    addBackClosure(piece, p, d, outer, halter ? band / 2 : -0.55);
  } else {
    sideTies(piece, d, outer, halter ? band / 2 : -0.55);
  }
  addStraps(piece, p, d, cup.apex, view);
  return piece;
}

function buildBandeau(p: TopParams, d: Dims, view: CanvasView): Piece {
  const piece = emptyPiece('top');
  const W = d.cupW + d.gap + 1;
  const H = d.cupH;
  const top = join(
    cubic([-W, -H * 0.82], [-W * 0.6, -H * 1.08], [-W * 0.2, -H * 1.02], [0, -H * 0.78]),
    cubic([0, -H * 0.78], [W * 0.2, -H * 1.02], [W * 0.6, -H * 1.08], [W, -H * 0.82]),
  );
  const bottom = quad([W, 0], [0, 0.9], [-W, 0]);
  const outline = join(top, line([W, -H * 0.82], [W, 0]), bottom, line([-W, 0], [-W, -H * 0.82]));
  piece.outlines.push(outline);
  addArea(piece, 'cup_full', outline);
  addEdge(piece, 'cup_upper_edge', top);
  addEdge(piece, 'cup_lower_edge', bottom);
  addEdge(piece, 'band', bottom);
  // centre twist / ruching
  for (const dx of [-0.8, 0, 0.8]) piece.seams.push(quad([dx, -H * 0.78], [dx * 2.2, -H * 0.4], [dx, 0.3]));
  piece.anchors.centre_front = [[0, -H * 0.42]];
  if (view === 'back') {
    piece.insideOut = true;
    addBackClosure(piece, p, d, W, -H * 0.4);
  } else {
    piece.anchors.hips = [[-W, -H * 0.4], [W, -H * 0.4]];
  }
  addStraps(piece, p, d, [W * 0.55, -H * 0.98], view);
  return piece;
}

function buildWired(p: TopParams, d: Dims, view: CanvasView, family: 'balconette' | 'underwire'): Piece {
  const piece = emptyPiece('top');
  const { cupW: W, cupH: H } = d;
  const band = 3 * d.g.length;
  const gx = Math.max(d.gap, 0.8);
  const outer = gx + W;
  const topY = family === 'balconette' ? -band - H * 0.62 : -band - H * 0.85;
  const apex: Pt = [gx + W * 0.7, family === 'balconette' ? -band - H * 0.8 : -band - H];

  for (const flip of [false, true]) {
    const m = (pts: Polyline) => (flip ? mirrorX(pts) : pts);
    const wire = cubic([gx, -band - H * 0.35], [gx, -band + 1.2], [outer, -band + 1.2], [outer, -band - H * 0.45]);
    const outerEdge = quad([outer, -band - H * 0.45], [outer + 0.3, apex[1] + 2], apex);
    const topEdge =
      family === 'balconette'
        ? quad(apex, [gx + W * 0.35, topY - 0.6], [gx, -band - H * 0.35])
        : cubic(apex, [gx + W * 0.35, apex[1] + 1], [gx + 0.6, topY + 2], [gx, -band - H * 0.35]);
    const outline = join(wire, outerEdge, topEdge);
    piece.outlines.push(m(outline));
    addArea(piece, 'cup_full', m(outline));
    addEdge(piece, 'cup_upper_edge', m(join(outerEdge, topEdge)));
    addEdge(piece, 'cup_lower_edge', m(wire));
    // cup seam: vertical for balconette, diagonal for full-cup underwire
    piece.seams.push(m(family === 'balconette' ? quad([gx + W * 0.5, -band + 0.4], [gx + W * 0.47, -band - H * 0.4], [gx + W * 0.5, topY - 0.3]) : quad([gx + 0.3, -band - H * 0.55], [gx + W * 0.5, -band - H * 0.5], [outer, -band - H * 0.55])));
    if (p.underwire) piece.seams.push(m(translate1(wire, 0.35)));
  }
  // under-band and centre gore
  const bandPoly: Polyline = join(line([-outer, -band], [outer, -band]), line([outer, -band], [outer, 0]), quad([outer, 0], [0, 0.3], [-outer, 0]));
  piece.outlines.unshift(bandPoly);
  addEdge(piece, 'band', quad([outer, 0], [0, 0.3], [-outer, 0]));
  piece.seams.push(line([-outer + 0.5, -0.5], [outer - 0.5, -0.5]));
  piece.anchors.centre_front = [[0, -band - 0.8]];
  if (view === 'back') {
    piece.insideOut = true;
    addBackClosure(piece, p, d, outer, -band / 2);
  } else {
    piece.anchors.hips = [[-outer, -band / 2], [outer, -band / 2]];
  }
  addStraps(piece, p, d, apex, view);
  return piece;
}

const translate1 = (pts: Polyline, dy: number): Polyline => pts.map(([x, y]) => [x, y + dy]);

function buildSide(p: TopParams, d: Dims): Piece {
  // Simplified side profile: cup projection, band and strap.
  const piece = emptyPiece('top');
  const depth = d.cupH * 0.55;
  const profile = join(line([0, 0], [-4, 0]), cubic([-4, 0], [-4 - depth, -1], [-4 - depth * 0.6, -d.cupH * 0.9], [-3, -d.cupH]), line([-3, -d.cupH], [0, -d.cupH * 0.5]), line([0, -d.cupH * 0.5], [0, 0]));
  piece.outlines.push(profile);
  addArea(piece, 'cup_full', profile);
  addEdge(piece, 'cup_upper_edge', line([-3, -d.cupH], [0, -d.cupH * 0.5]));
  piece.strings.push({ pts: line([0, -0.5], [8, -0.5]), widthCm: 0.9 });
  if (p.strapStyle !== 'strapless') piece.strings.push({ pts: quad([-3, -d.cupH], [-2, d.neckY / 2], [1, d.neckY]), widthCm: d.strapW });
  return piece;
}

export function buildTop(p: TopParams, size: SizeLabel = 'M', view: CanvasView = 'front'): Piece {
  const d = dims(p, size);
  if (view === 'side') return buildSide(p, d);
  const family = TOP_FAMILY[p.template];
  switch (family) {
    case 'triangle':
      return buildTriangle(p, d, view, false);
    case 'halter':
      return buildTriangle(p, d, view, true);
    case 'bandeau':
      return buildBandeau(p, d, view);
    case 'balconette':
    case 'underwire':
      return buildWired(p, d, view, family);
  }
}

export function measureTop(p: TopParams, size: SizeLabel = 'M'): Measurement[] {
  const d = dims(p, size);
  const front = buildTop(p, size, 'front');
  const out: Measurement[] = [
    pom('T1', 'Cup height (centre)', d.cupH),
    pom('T2', 'Cup width (base)', d.cupW),
    pom('T3', 'Centre front gap', d.gap * 2),
  ];
  const upper = front.edges.cup_upper_edge?.[0];
  if (upper) out.push(pom('T4', 'Cup upper edge length', length(upper)));
  if (p.strapStyle !== 'strapless') {
    const strap = front.edges.strap?.[0];
    const strapLen = (strap ? length(strap) : 0) + (p.strapStyle === 'halter' || p.strapStyle === 'tie' ? 22 * d.g.length : 18 * d.g.length);
    out.push(pom('T5', 'Strap length (each, finished)', strapLen), pom('T6', 'Strap width', d.strapW));
  }
  const family = TOP_FAMILY[p.template];
  if (family === 'triangle') out.push(pom('T7', 'Under-bust tie length (each)', d.tieLen));
  else out.push(pom('T7', 'Band length (relaxed, 10% negative ease)', 74 * d.g.width * 0.9));
  return out;
}

