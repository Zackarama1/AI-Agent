import { BOTTOM_TEMPLATE_DEFAULTS } from './templates/bottom';
import { ONE_PIECE_TEMPLATE_DEFAULTS } from './templates/one-piece';
import type {
  BottomParams, BottomTemplate, CanvasState, EmbellishmentType, GarmentCategory, OnePieceParams, OnePieceTemplate,
  PiecePart, TopParams, TopTemplate,
} from './types';

export const TOP_TEMPLATES: TopTemplate[] = [
  'triangle', 'halter', 'bandeau', 'balconette', 'underwire', 'sliding_triangle', 'scoop', 'bralette',
  'one_shoulder', 'ring_front', 'tie_front', 'crop',
];
export const BOTTOM_TEMPLATES = Object.keys(BOTTOM_TEMPLATE_DEFAULTS) as BottomTemplate[];
export const ONE_PIECE_TEMPLATES = Object.keys(ONE_PIECE_TEMPLATE_DEFAULTS) as OnePieceTemplate[];

const TOP_TEMPLATE_DEFAULTS: Partial<Record<TopTemplate, Partial<TopParams>>> = {
  triangle: { strapStyle: 'halter', closure: 'tie_back', underwire: false, padding: 'removable' },
  sliding_triangle: { strapStyle: 'tie', closure: 'tie_back', underwire: false },
  halter: { strapStyle: 'halter', closure: 'hook', cupHeightCm: 16, underwire: false },
  bandeau: { strapStyle: 'strapless', closure: 'hook', cupHeightCm: 12, cupWidthCm: 16, necklineDepthCm: 3, underwire: false },
  balconette: { strapStyle: 'adjustable', closure: 'hook', cupHeightCm: 13, necklineDepthCm: 6, underwire: true, padding: 'moulded' },
  underwire: { strapStyle: 'adjustable', closure: 'hook', cupHeightCm: 15, necklineDepthCm: 7, underwire: true, padding: 'moulded' },
};

export const DEFAULT_TOP: TopParams = {
  template: 'triangle', cupHeightCm: 15, cupWidthCm: 14, necklineDepthCm: 9, strapWidthMm: 6, strapStyle: 'halter',
  closure: 'tie_back', padding: 'removable', underwire: false, lined: true,
};
export const DEFAULT_BOTTOM: BottomParams = {
  template: 'tie_side', riseFrontCm: 17, riseBackCm: 22, legCutAngleDeg: 38, backCoverage: 'cheeky', sideWidthCm: 0,
  waistband: 'none', scrunch: false, lined: true,
};
export const DEFAULT_ONE_PIECE: OnePieceParams = {
  template: 'scoop_back', necklineDepthCm: 9, backScoopDepthCm: 34, legCutAngleDeg: 40, strapWidthMm: 12,
  cutOutSizeCm: 0, backCoverage: 'moderate', lined: true,
};

export const withTopTemplate = (p: TopParams, template: TopTemplate): TopParams => ({ ...p, ...TOP_TEMPLATE_DEFAULTS[template], template });
export const withBottomTemplate = (p: BottomParams, template: BottomTemplate): BottomParams => ({ ...p, ...BOTTOM_TEMPLATE_DEFAULTS[template], template, scrunch: template === 'scrunch_butt' || (p.scrunch && template !== 'tie_side') });
export const withOnePieceTemplate = (p: OnePieceParams, template: OnePieceTemplate): OnePieceParams => ({ ...p, ...ONE_PIECE_TEMPLATE_DEFAULTS[template], template });

const BLUSH = '#FEF5F4';
const LINING = { kind: 'solid', hex: '#F3E3DA' } as const;

export function newCanvas(category: GarmentCategory, top?: TopParams, bottom?: BottomParams): CanvasState {
  const views = { front: true, back: true, side: false };
  const base = { category, embellishments: [], hardware: [], views, annotations: [] };
  if (category === 'one_piece' || category === 'monokini') {
    const params = category === 'monokini' ? withOnePieceTemplate(DEFAULT_ONE_PIECE, 'monokini') : DEFAULT_ONE_PIECE;
    return { ...base, onePiece: { params, fill: { kind: 'solid', hex: BLUSH }, lining: LINING } };
  }
  return {
    ...base,
    top: { params: top ?? DEFAULT_TOP, fill: { kind: 'solid', hex: BLUSH }, lining: LINING },
    bottom: { params: bottom ?? DEFAULT_BOTTOM, fill: { kind: 'solid', hex: BLUSH }, lining: LINING },
  };
}

// Named edges/areas each part exposes, for placing embellishments.
export const PART_PATHS: Record<PiecePart, { value: string; label: string; area?: boolean }[]> = {
  top: [
    { value: 'cup_upper_edge', label: 'Cup upper edge' },
    { value: 'cup_lower_edge', label: 'Cup lower edge' },
    { value: 'cup_full', label: 'Whole cup', area: true },
    { value: 'strap', label: 'Straps' },
    { value: 'tie', label: 'Ties' },
    { value: 'band', label: 'Under-band' },
  ],
  bottom: [
    { value: 'front_waist_edge', label: 'Front waist edge' },
    { value: 'back_waist_edge', label: 'Back waist edge' },
    { value: 'leg_opening', label: 'Leg openings' },
    { value: 'front_panel', label: 'Front panel', area: true },
    { value: 'back_panel', label: 'Back panel', area: true },
    { value: 'tie', label: 'Side ties' },
  ],
  one_piece: [
    { value: 'neckline', label: 'Front neckline' },
    { value: 'back_scoop', label: 'Back scoop' },
    { value: 'leg_opening', label: 'Leg openings' },
    { value: 'cut_out_edge', label: 'Cut-out edges' },
    { value: 'strap', label: 'Straps' },
    { value: 'body_panel', label: 'Whole body', area: true },
  ],
};

export const AREA_EMBELLISHMENTS: EmbellishmentType[] = ['lace_overlay', 'bead_scatter', 'ruching', 'crochet_panel', 'embroidery'];

// Left-rail groupings (§5.1) with sensible starting widths/spacings.
export const EMBELLISHMENT_PRESETS: { group: 'lace' | 'beading'; type: EmbellishmentType; label: string; widthMm?: number; spacingMm?: number; density?: number }[] = [
  { group: 'lace', type: 'lace_trim', label: 'Lace trim', widthMm: 20 },
  { group: 'lace', type: 'lace_overlay', label: 'Lace overlay' },
  { group: 'lace', type: 'scallop_edge', label: 'Scallop edge', widthMm: 8 },
  { group: 'lace', type: 'ruffle', label: 'Ruffle', widthMm: 18 },
  { group: 'lace', type: 'contrast_binding', label: 'Contrast binding', widthMm: 10 },
  { group: 'lace', type: 'ruching', label: 'Ruching' },
  { group: 'lace', type: 'crochet_panel', label: 'Crochet panel' },
  { group: 'lace', type: 'embroidery', label: 'Embroidery' },
  { group: 'lace', type: 'applique_flower', label: '3D flower appliqué', widthMm: 14, spacingMm: 28 },
  { group: 'beading', type: 'pearl', label: 'Pearls', widthMm: 5, spacingMm: 12 },
  { group: 'beading', type: 'bead_strand', label: 'Seed-bead strand', spacingMm: 6 },
  { group: 'beading', type: 'bead_scatter', label: 'Bead scatter', density: 40 },
  { group: 'beading', type: 'charm', label: 'Shell charms', spacingMm: 35 },
  { group: 'beading', type: 'bow', label: 'Bow', widthMm: 30 },
  { group: 'beading', type: 'ring', label: 'Ring detail', widthMm: 20 },
  { group: 'beading', type: 'logo_hardware', label: 'Logo plate' },
];
