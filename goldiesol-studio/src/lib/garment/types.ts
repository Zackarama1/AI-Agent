// Parametric garment model (§5.2–5.3). Every piece is generated from these
// parameters, which map directly onto tech pack points of measure.

export type TopTemplate =
  | 'triangle' | 'sliding_triangle' | 'bandeau' | 'balconette' | 'underwire'
  | 'halter' | 'scoop' | 'bralette' | 'one_shoulder' | 'ring_front' | 'tie_front' | 'crop';

export type BottomTemplate =
  | 'tie_side' | 'fixed_side' | 'cheeky' | 'brazilian' | 'thong' | 'high_leg'
  | 'high_waist' | 'boyshort' | 'scrunch_butt' | 'v_front' | 'ruched_side';

export type OnePieceTemplate =
  | 'scoop_back' | 'plunge' | 'cut_out' | 'one_shoulder' | 'monokini' | 'high_leg_maillot';

export interface TopParams {
  template: TopTemplate;
  cupHeightCm: number;        // centre cup height (base size M)
  cupWidthCm: number;
  necklineDepthCm: number;
  strapWidthMm: number;
  strapStyle: 'halter' | 'over_shoulder' | 'cross_back' | 'strapless' | 'tie' | 'adjustable';
  closure: 'tie_back' | 'hook' | 'clasp' | 'ring' | 'pullover';
  padding: 'none' | 'removable' | 'moulded';
  underwire: boolean;
  lined: boolean;
}

export interface BottomParams {
  template: BottomTemplate;
  riseFrontCm: number;
  riseBackCm: number;
  legCutAngleDeg: number;     // higher = higher-cut leg
  backCoverage: 'full' | 'moderate' | 'cheeky' | 'brazilian' | 'thong';
  sideWidthCm: number;        // 0 for tie-side
  waistband: 'none' | 'folded' | 'elastic' | 'ruched';
  scrunch: boolean;
  lined: boolean;
}

export type GarmentCategory = 'bikini' | 'one_piece' | 'monokini' | 'tankini' | 'cover_up';

export interface OnePieceParams {
  template: OnePieceTemplate;
  necklineDepthCm: number;    // front neckline depth below the strap point
  backScoopDepthCm: number;   // back neckline depth below the strap point
  legCutAngleDeg: number;
  strapWidthMm: number;
  cutOutSizeCm: number;       // 0 = no cut-outs
  backCoverage: BottomParams['backCoverage'];
  lined: boolean;
}

export const LACE_TEXTURES = ['floral', 'scallop', 'geometric', 'eyelash', 'guipure'] as const;
export type LaceTexture = (typeof LACE_TEXTURES)[number];

export const PRINTS = [
  'ditsy_floral', 'tropical', 'gingham', 'polka', 'stripe', 'abstract_brush',
  'leopard', 'snake', 'paisley', 'tie_dye', 'watercolour_floral',
] as const;
export type PrintId = (typeof PRINTS)[number];

export type Fill =
  | { kind: 'solid'; colourId?: string; hex: string }
  | { kind: 'print'; print: PrintId; hex: string; accentHex: string; scale: number }
  | { kind: 'image'; imageUrl: string; scale: number }
  | { kind: 'lace'; texture: LaceTexture; hex: string; baseHex?: string }
  | { kind: 'crochet'; hex: string; baseHex?: string }
  | { kind: 'mesh'; hex: string; opacity: number };

export const EMBELLISHMENT_TYPES = [
  'lace_trim', 'lace_overlay', 'scallop_edge', 'bead_strand', 'bead_scatter',
  'pearl', 'bow', 'ring', 'charm', 'ruffle', 'ruching', 'crochet_panel',
  'embroidery', 'applique_flower', 'contrast_binding', 'logo_hardware',
] as const;
export type EmbellishmentType = (typeof EMBELLISHMENT_TYPES)[number];

export type PiecePart = 'top' | 'bottom' | 'one_piece';

export interface Embellishment {
  id: string;
  type: EmbellishmentType;
  part: PiecePart | 'strap' | 'tie';
  path: string;               // which edge/area it follows, e.g. 'cup_upper_edge'
  materialId?: string;
  colourId?: string;
  density?: number;           // for bead scatter
  widthMm?: number;
  spacingMm?: number;
  notes?: string;
}

export const HARDWARE_FINISHES = ['gold', 'rose_gold', 'silver', 'pearl', 'tortoise', 'clear'] as const;
export type HardwareFinish = (typeof HARDWARE_FINISHES)[number];
export const HARDWARE_PLACEMENTS = ['centre_front', 'hips', 'straps', 'centre_back', 'tie_ends'] as const;
export type HardwarePlacement = (typeof HARDWARE_PLACEMENTS)[number];

export interface HardwareItem {
  id: string;
  type: 'ring' | 'slider' | 'clasp' | 'toggle' | 'bead_end';
  finish: HardwareFinish;
  sizeMm: number;
  placement: HardwarePlacement;
}

export interface PieceState<P> {
  shapeId?: string;
  params: P;
  fill: Fill;
  lining: Fill;
  materialId?: string;      // main fabric from the materials library
}

export type CanvasView = 'front' | 'back' | 'side';

export interface CanvasState {
  category: GarmentCategory;
  top?: PieceState<TopParams>;
  bottom?: PieceState<BottomParams>;
  onePiece?: PieceState<OnePieceParams>;
  embellishments: Embellishment[];
  hardware: HardwareItem[];
  views: { front: boolean; back: boolean; side: boolean };
  annotations: { id: string; x: number; y: number; text: string }[];  // x, y as 0..1 of the canvas
}
