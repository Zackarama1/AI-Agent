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

export type LaceTexture = 'floral' | 'scallop' | 'geometric' | 'eyelash' | 'guipure';

export type Fill =
  | { kind: 'solid'; colourId?: string; hex: string }
  | { kind: 'print'; imageUrl: string; scale: number; rotationDeg?: number }
  | { kind: 'lace'; texture: LaceTexture; hex: string; baseHex?: string; opacity?: number }
  | { kind: 'crochet'; hex: string }
  | { kind: 'mesh'; hex: string; opacity: number };

export interface Embellishment {
  id: string;
  type: 'lace_trim' | 'lace_overlay' | 'scallop_edge' | 'bead_strand' | 'bead_scatter'
      | 'pearl' | 'bow' | 'ring' | 'charm' | 'ruffle' | 'ruching' | 'crochet_panel'
      | 'embroidery' | 'applique_flower' | 'contrast_binding' | 'logo_hardware';
  part: 'top' | 'bottom' | 'one_piece' | 'strap' | 'tie';
  path: string;               // which edge/area it follows, e.g. 'cup_upper_edge'
  materialId?: string;
  colourId?: string;
  density?: number;           // for bead scatter
  widthMm?: number;
  spacingMm?: number;
  notes?: string;
}

export interface HardwareItem {
  type: string;
  finish: 'gold' | 'rose_gold' | 'silver' | 'pearl' | 'tortoise' | 'clear';
  sizeMm: number;
  placement: string;
}

export interface CanvasState {
  category: GarmentCategory;
  top?: { shapeId?: string; params: TopParams; fill: Fill; lining: Fill };
  bottom?: { shapeId?: string; params: BottomParams; fill: Fill; lining: Fill };
  onePiece?: { shapeId?: string; params: Record<string, unknown>; fill: Fill; lining: Fill };
  embellishments: Embellishment[];
  hardware: HardwareItem[];
  views: { front: boolean; back: boolean; side: boolean };
  annotations: { id: string; x: number; y: number; text: string }[];
}
