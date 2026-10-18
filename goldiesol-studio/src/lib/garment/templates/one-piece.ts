import { cubic, ellipse, join, length, line, mirrorX, quad, reverse, type Polyline, type Pt } from '../geometry';
import { grade, pom, type Grade, type Measurement, type SizeLabel } from '../grading';
import type { CanvasView, OnePieceParams, OnePieceTemplate } from '../types';
import { addArea, addEdge, clamp, emptyPiece, type Piece } from './piece';

// Coordinate system (cm): x = 0 is centre front/back, y = 0 is the top of the shoulder strap.

export const ONE_PIECE_TEMPLATE_DEFAULTS: Record<OnePieceTemplate, Partial<OnePieceParams>> = {
  scoop_back: { necklineDepthCm: 9, backScoopDepthCm: 34, legCutAngleDeg: 40, cutOutSizeCm: 0, backCoverage: 'moderate' },
  plunge: { necklineDepthCm: 24, backScoopDepthCm: 20, legCutAngleDeg: 45, cutOutSizeCm: 0, backCoverage: 'cheeky' },
  cut_out: { necklineDepthCm: 10, backScoopDepthCm: 22, legCutAngleDeg: 42, cutOutSizeCm: 8, backCoverage: 'cheeky' },
  one_shoulder: { necklineDepthCm: 8, backScoopDepthCm: 18, legCutAngleDeg: 42, cutOutSizeCm: 0, backCoverage: 'cheeky' },
  monokini: { necklineDepthCm: 14, backScoopDepthCm: 30, legCutAngleDeg: 46, cutOutSizeCm: 14, backCoverage: 'brazilian' },
  high_leg_maillot: { necklineDepthCm: 8, backScoopDepthCm: 24, legCutAngleDeg: 58, cutOutSizeCm: 0, backCoverage: 'cheeky' },
};

const BACK_SEAT: Record<OnePieceParams['backCoverage'], number> = {
  full: 0.95, moderate: 0.78, cheeky: 0.56, brazilian: 0.38, thong: 0.1,
};

interface Dims {
  g: Grade;
  strapX: number;
  strapW: number;
  bustY: number;
  waistY: number;
  hipY: number;
  crotchY: number;
  bust: number;
  waist: number;
  hip: number;
  crotch: number;
  cut: number;
}

function dims(p: OnePieceParams, size: SizeLabel): Dims {
  const g = grade(size);
  return {
    g,
    strapX: 7 * g.width,
    strapW: p.strapWidthMm / 10,
    bustY: 24 * g.length,
    waistY: 41 * g.length,
    hipY: 54 * g.length,
    crotchY: 67 * g.length,
    bust: 15.5 * g.width,
    waist: 12.6 * g.width,
    hip: 16.8 * g.width,
    crotch: 3.8 * g.width,
    cut: clamp((p.legCutAngleDeg - 20) / 45, 0, 1),
  };
}

// Right half of the body outline from the outer strap top down to the crotch.
function sideAndLeg(p: OnePieceParams, d: Dims, view: 'front' | 'back'): { armhole: Polyline; side: Polyline; leg: Polyline } {
  const armTop: Pt = [d.strapX + d.strapW, 0];
  const legTopY = d.hipY - d.cut * 13 * d.g.length;
  // A high-cut leg starts above the hip line, where the body is still narrower.
  const legX = d.waist + (d.hip - d.waist) * clamp((legTopY - d.waistY) / (d.hipY - d.waistY), 0, 1);
  const armhole = cubic(armTop, [d.strapX + d.strapW + 1, 7], [d.bust - 0.5, 10], [d.bust, 15 * d.g.length]);
  const side = join(
    cubic([d.bust, 15 * d.g.length], [d.bust, d.bustY + 6], [d.waist, d.waistY - 6], [d.waist, d.waistY]),
    cubic([d.waist, d.waistY], [d.waist, d.waistY + 4], [legX, legTopY - 5], [legX, legTopY]),
  );
  const seat = Math.max(d.hip * BACK_SEAT[p.backCoverage], d.crotch);
  const leg =
    view === 'front'
      ? cubic([legX, legTopY], [legX - (legX - d.crotch) * (0.4 + 0.4 * d.cut), legTopY + 3], [d.crotch + 1.2, d.crotchY - 4], [d.crotch, d.crotchY])
      : cubic([legX, legTopY], [legX - (legX - seat) * 0.2, legTopY + (d.crotchY - legTopY) * 0.4], [seat, d.crotchY - 2], [d.crotch * 0.9, d.crotchY]);
  return { armhole, side, leg };
}

function neckline(p: OnePieceParams, d: Dims, view: 'front' | 'back'): Polyline {
  const depth = (view === 'front' ? p.necklineDepthCm : p.backScoopDepthCm) * d.g.length;
  const start: Pt = [d.strapX, 0];
  if (view === 'front' && p.template === 'plunge') return join(line(start, [0.6, depth]), line([0.6, depth], [0, depth + 0.5]));
  return cubic(start, [d.strapX, depth * 0.75], [d.strapX * 0.45, depth], [0, depth]);
}

function buildPanel(p: OnePieceParams, d: Dims, view: 'front' | 'back'): Piece {
  const piece = emptyPiece('one_piece');
  const { armhole, side, leg } = sideAndLeg(p, d, view);
  const oneShoulder = p.template === 'one_shoulder';
  const neck: Polyline = oneShoulder ? [] : neckline(p, d, view);
  const crotch = quad([d.crotch, d.crotchY], [0, d.crotchY + 0.4], [-d.crotch, d.crotchY]);
  const strapTop = line([d.strapX, 0], [d.strapX + d.strapW, 0]);
  const rightHalf = join(strapTop, armhole, side, leg); // strap → armhole → side → leg → crotch

  let outline: Polyline;
  if (oneShoulder) {
    // Asymmetric: no left strap; the neckline sweeps from the right strap to under the left arm.
    const leftUp = reverse(mirrorX(join(side, leg)));
    const underarm = leftUp[leftUp.length - 1];
    const sweep = quad(underarm, [-d.bust * 0.15, 3 * d.g.length], [d.strapX, 0]);
    outline = join(rightHalf, crotch, leftUp, sweep);
    addEdge(piece, view === 'front' ? 'neckline' : 'back_scoop', sweep);
  } else {
    outline = join(reverse(neck), rightHalf, crotch, reverse(mirrorX(join(reverse(neck), rightHalf))));
    addEdge(piece, view === 'front' ? 'neckline' : 'back_scoop', neck, mirrorX(neck));
  }
  piece.outlines.push(outline);
  addArea(piece, 'body_panel', outline);
  addEdge(piece, 'leg_opening', leg, mirrorX(leg));
  addEdge(piece, 'strap', strapTop);

  // princess seams + gusset
  if (view === 'front') {
    piece.seams.push(cubic([d.strapX * 0.75, 6], [d.bust * 0.55, d.bustY], [d.waist * 0.5, d.waistY], [d.hip * 0.45, d.hipY - 3]));
    if (!oneShoulder) piece.seams.push(mirrorX(piece.seams[0]));
    piece.seams.push(line([-d.crotch + 0.3, d.crotchY - 4], [d.crotch - 0.3, d.crotchY - 4]));
  }

  if (p.cutOutSizeCm > 0) {
    const s = p.cutOutSizeCm * d.g.width;
    const holes =
      p.template === 'monokini'
        ? [ellipse(d.waist * 0.55 + s * 0.1, d.waistY - 1, s * 0.42, s * 0.5), ellipse(-(d.waist * 0.55 + s * 0.1), d.waistY - 1, s * 0.42, s * 0.5)]
        : [ellipse(d.waist * 0.72, d.waistY - 1.5, s * 0.32, s * 0.45), ellipse(-d.waist * 0.72, d.waistY - 1.5, s * 0.32, s * 0.45)];
    piece.holes.push(...holes);
    addEdge(piece, 'cut_out_edge', ...holes.map((h) => [...h, h[0]]));
  }

  piece.anchors.centre_front = [[0, view === 'front' ? Math.min(p.necklineDepthCm * d.g.length + 2, d.waistY) : d.waistY]];
  piece.anchors.hips = [[-d.hip, d.hipY - 6], [d.hip, d.hipY - 6]];
  piece.anchors.straps = [[d.strapX + d.strapW / 2, 2], [-(d.strapX + d.strapW / 2), 2]];
  piece.anchors.centre_back = [[0, Math.min(p.backScoopDepthCm * d.g.length, d.waistY + 4)]];
  return piece;
}

function buildSide(p: OnePieceParams, d: Dims): Piece {
  const piece = emptyPiece('one_piece');
  const outline = join(
    cubic([-2, 0], [-9, 8], [-10, 20], [-6, d.waistY]),
    cubic([-6, d.waistY], [-5, d.hipY], [-6, d.crotchY - 6], [0, d.crotchY]),
    cubic([0, d.crotchY], [7, d.crotchY - 3], [8, d.hipY], [6, d.waistY]),
    cubic([6, d.waistY], [5, 30], [3, 10], [1, 0]),
  );
  piece.outlines.push(outline);
  addArea(piece, 'body_panel', outline);
  if (p.strapWidthMm > 0) piece.strings.push({ pts: line([-2, 0], [1, 0]), widthCm: d.strapW });
  return piece;
}

export function buildOnePiece(p: OnePieceParams, size: SizeLabel = 'M', view: CanvasView = 'front'): Piece {
  const d = dims(p, size);
  return view === 'side' ? buildSide(p, d) : buildPanel(p, d, view);
}

export function measureOnePiece(p: OnePieceParams, size: SizeLabel = 'M'): Measurement[] {
  const d = dims(p, size);
  const front = buildOnePiece(p, size, 'front');
  const back = buildOnePiece(p, size, 'back');
  return [
    pom('O1', 'Torso length (strap top to crotch)', d.crotchY),
    pom('O2', 'Bust width (flat, ×2)', d.bust * 4),
    pom('O3', 'Waist width (flat, ×2)', d.waist * 4),
    pom('O4', 'Hip width (flat, ×2)', d.hip * 4),
    pom('O5', 'Front neckline depth', p.necklineDepthCm * d.g.length),
    pom('O6', 'Back scoop depth', p.backScoopDepthCm * d.g.length),
    pom('O7', 'Leg opening (each, relaxed)', length(front.edges.leg_opening[0]) + length(back.edges.leg_opening[0])),
    pom('O8', 'Strap width', d.strapW),
    ...(p.cutOutSizeCm > 0 ? [pom('O9', 'Cut-out width', p.cutOutSizeCm * d.g.width)] : []),
  ];
}
