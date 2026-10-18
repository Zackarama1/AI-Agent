import { cubic, join, length, line, mirrorX, quad, reverse, type Polyline } from '../geometry';
import { grade, pom, type Grade, type Measurement, type SizeLabel } from '../grading';
import type { BottomParams, BottomTemplate, CanvasView } from '../types';
import { addArea, addEdge, clamp, emptyPiece, type Piece } from './piece';

// Coordinate system (cm): x = 0 is centre front/back, y = 0 is the waist edge, y grows downwards.

// Seat width at the back leg line, as a share of the half-width, per coverage.
const BACK_SEAT: Record<BottomParams['backCoverage'], number> = {
  full: 0.95,
  moderate: 0.78,
  cheeky: 0.56,
  brazilian: 0.38,
  thong: 0.1,
};

// Sensible starting parameters when switching template (base size M).
export const BOTTOM_TEMPLATE_DEFAULTS: Record<BottomTemplate, Partial<BottomParams>> = {
  tie_side: { riseFrontCm: 17, riseBackCm: 22, legCutAngleDeg: 38, sideWidthCm: 0, backCoverage: 'cheeky', waistband: 'none' },
  fixed_side: { riseFrontCm: 18, riseBackCm: 24, legCutAngleDeg: 32, sideWidthCm: 5, backCoverage: 'moderate' },
  cheeky: { riseFrontCm: 19, riseBackCm: 24, legCutAngleDeg: 36, sideWidthCm: 4, backCoverage: 'cheeky' },
  brazilian: { riseFrontCm: 17, riseBackCm: 22, legCutAngleDeg: 42, sideWidthCm: 3, backCoverage: 'brazilian' },
  thong: { riseFrontCm: 16, riseBackCm: 20, legCutAngleDeg: 48, sideWidthCm: 2, backCoverage: 'thong' },
  high_leg: { riseFrontCm: 21, riseBackCm: 25, legCutAngleDeg: 55, sideWidthCm: 2, backCoverage: 'cheeky' },
  high_waist: { riseFrontCm: 28, riseBackCm: 32, legCutAngleDeg: 30, sideWidthCm: 12, backCoverage: 'moderate', waistband: 'folded' },
  boyshort: { riseFrontCm: 21, riseBackCm: 26, legCutAngleDeg: 12, sideWidthCm: 9, backCoverage: 'full' },
  scrunch_butt: { riseFrontCm: 18, riseBackCm: 23, legCutAngleDeg: 38, sideWidthCm: 4, backCoverage: 'cheeky', scrunch: true },
  v_front: { riseFrontCm: 19, riseBackCm: 23, legCutAngleDeg: 44, sideWidthCm: 3, backCoverage: 'cheeky' },
  ruched_side: { riseFrontCm: 18, riseBackCm: 23, legCutAngleDeg: 38, sideWidthCm: 6, backCoverage: 'cheeky' },
};

interface Dims {
  g: Grade;
  half: number;     // half the waist-edge width
  side: number;
  riseF: number;
  riseB: number;
  crotch: number;   // half the crotch/gusset width
  cut: number;      // 0..1, how high the leg is cut
}

function dims(p: BottomParams, size: SizeLabel): Dims {
  const g = grade(size);
  const riseF = p.riseFrontCm * g.length;
  return {
    g,
    // Higher rises sit at the natural waist, which is narrower than the hip.
    half: (16.5 - Math.max(0, p.riseFrontCm - 19) * 0.25) * g.width,
    side: p.sideWidthCm * g.length,
    riseF,
    riseB: p.riseBackCm * g.length,
    crotch: 3.6 * g.width,
    cut: clamp((p.legCutAngleDeg - 10) / 50, 0, 1),
  };
}

function waistEdge(p: BottomParams, half: number, view: CanvasView): Polyline {
  if (p.template === 'v_front' && view === 'front') return join(line([-half, 0], [0, 2.8]), line([0, 2.8], [half, 0]));
  return quad([-half, 0], [0, view === 'front' ? 1.4 : -0.6], [half, 0]);
}

function buildPanel(p: BottomParams, d: Dims, view: 'front' | 'back'): Piece {
  const piece = emptyPiece('bottom');
  const half = view === 'back' ? d.half * 1.04 : d.half;
  const rise = view === 'back' ? d.riseB : d.riseF;
  const c = view === 'back' ? d.crotch * 0.9 : d.crotch;
  const sideTop = Math.max(d.side, 0.01);

  let legR: Polyline;
  if (view === 'front') {
    legR = cubic(
      [half, sideTop],
      [half - (half - c) * (0.35 + 0.45 * d.cut), sideTop + (rise - sideTop) * (0.22 - 0.14 * d.cut)],
      [c + (half - c) * 0.12, rise - (rise - sideTop) * (0.42 - 0.22 * d.cut)],
      [c, rise],
    );
  } else {
    const share = BACK_SEAT[p.backCoverage];
    const seat = Math.max(half * share, c);
    // Less coverage pulls the leg line inward sooner.
    legR = cubic([half, sideTop], [half - (half - seat) * (0.25 + 0.6 * (1 - share)), sideTop + (rise - sideTop) * 0.35], [seat, rise * 0.86], [c, rise]);
  }

  const top = waistEdge(p, half, view);
  const crotchLine = quad([c, rise], [0, rise + 0.4], [-c, rise]);
  const outline = join(top, line([half, 0], [half, sideTop]), legR, crotchLine, reverse(mirrorX(legR)), line([-half, sideTop], [-half, 0]));
  piece.outlines.push(outline);
  addArea(piece, view === 'front' ? 'front_panel' : 'back_panel', outline);
  addEdge(piece, view === 'front' ? 'front_waist_edge' : 'back_waist_edge', top);
  addEdge(piece, 'leg_opening', legR, mirrorX(legR));

  // waistband / finishing
  if (p.waistband === 'folded') piece.seams.push(quad([-half + 0.3, 3], [0, view === 'front' ? 4.2 : 2.4], [half - 0.3, 3]));
  if (p.waistband === 'elastic') piece.seams.push(quad([-half + 0.3, 1.1], [0, view === 'front' ? 2.4 : 0.5], [half - 0.3, 1.1]));
  if (p.waistband === 'ruched') {
    for (let x = -half + 1.5; x < half - 1; x += 1.6) piece.seams.push(line([x, 0.4], [x + 0.3, 2.6]));
  }
  if (view === 'front') piece.seams.push(line([-c + 0.3, rise - 3.5], [c - 0.3, rise - 3.5])); // gusset seam
  if (view === 'back' && (p.scrunch || p.template === 'scrunch_butt')) {
    piece.seams.push(line([0, 1.5], [0, rise - 1]));
    for (let y = 3; y < rise - 2; y += 1.8) piece.seams.push(join(line([-1.6, y - 0.6], [0, y]), line([0, y], [1.6, y - 0.6])));
  }
  if (p.template === 'ruched_side' && d.side > 1) {
    for (const s of [1, -1]) for (let y = 0.8; y < d.side; y += 1.2) piece.seams.push(line([s * (half - 2.5), y], [s * half, y + 0.4]));
  }

  // Tie sides: strings from the waist corners.
  if (p.template === 'tie_side' || d.side < 0.5) {
    for (const s of [1, -1]) {
      const tie = join(line([s * half, 0.4], [s * (half + 3), 0.6]), quad([s * (half + 3), 0.6], [s * (half + 5), 4], [s * (half + 3.5), 10]));
      piece.strings.push({ pts: tie, widthCm: 0.7 });
      addEdge(piece, 'tie', tie);
      piece.bows.push([s * (half + 3), 0.6]);
      piece.anchors.tie_ends = [...(piece.anchors.tie_ends ?? []), tie[tie.length - 1]];
    }
  }
  piece.anchors.hips = [[-half, sideTop / 2], [half, sideTop / 2]];
  piece.anchors[view === 'front' ? 'centre_front' : 'centre_back'] = [[0, view === 'front' ? 3 : 2]];
  return piece;
}

function buildSide(p: BottomParams, d: Dims): Piece {
  const piece = emptyPiece('bottom');
  const front = -7;
  const back = 7;
  const legF = cubic([front, d.side], [front + 1, d.riseF * 0.6], [front + 4, d.riseF * 0.95], [0, d.riseF]);
  const legB = cubic([0, d.riseF], [back - 2, d.riseF * 0.98], [back + 1, d.riseB * (0.5 + 0.3 * BACK_SEAT[p.backCoverage])], [back, Math.max(d.side, 0.5)]);
  const outline = join(line([front, 0], [back, 0]), line([back, 0], [back, Math.max(d.side, 0.5)]), reverse(legB), reverse(legF), line([front, d.side], [front, 0]));
  piece.outlines.push(outline);
  addArea(piece, 'front_panel', outline);
  addEdge(piece, 'leg_opening', legF, legB);
  return piece;
}

export function buildBottom(p: BottomParams, size: SizeLabel = 'M', view: CanvasView = 'front'): Piece {
  const d = dims(p, size);
  return view === 'side' ? buildSide(p, d) : buildPanel(p, d, view);
}

export function measureBottom(p: BottomParams, size: SizeLabel = 'M'): Measurement[] {
  const d = dims(p, size);
  const front = buildBottom(p, size, 'front');
  const back = buildBottom(p, size, 'back');
  const legFront = length(front.edges.leg_opening[0]);
  const legBack = length(back.edges.leg_opening[0]);
  const waist = length(front.edges.front_waist_edge[0]) + length(back.edges.back_waist_edge[0]);
  const out: Measurement[] = [
    pom('B1', 'Front rise', d.riseF),
    pom('B2', 'Back rise', d.riseB),
    pom('B3', 'Side width', d.side),
    pom('B4', 'Leg opening (each, relaxed)', legFront + legBack),
    pom('B5', 'Waist (relaxed)', waist),
    pom('B6', 'Waist (extended)', waist * 1.35),
    pom('B7', 'Gusset width', d.crotch * 2),
  ];
  if (p.template === 'tie_side' || d.side < 0.5) out.push(pom('B8', 'Side tie length (each)', 38 * d.g.length));
  return out;
}
