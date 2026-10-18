import type { BottomParams, CanvasState, TopParams } from '../garment/types';
import type { Design, DesignNote, DesignVersion, Shape } from '../types';
import { collections } from './brand';
import { colourByName } from './colours';
import { rowMeta } from './ids';
import { materialByName } from './materials';

// --- Shapes ----------------------------------------------------------------

const goldieLaceTri: TopParams = {
  template: 'triangle',
  cupHeightCm: 15,
  cupWidthCm: 14,
  necklineDepthCm: 9,
  strapWidthMm: 6,
  strapStyle: 'halter',
  closure: 'tie_back',
  padding: 'removable',
  underwire: false,
  lined: true,
};

const goldieTieSide: BottomParams = {
  template: 'tie_side',
  riseFrontCm: 17,
  riseBackCm: 22,
  legCutAngleDeg: 38,
  backCoverage: 'cheeky',
  sideWidthCm: 0,
  waistband: 'none',
  scrunch: false,
  lined: true,
};

const shape = (
  key: string,
  kind: Shape['kind'],
  custom_name: string,
  params: Shape['params'] & { template: string },
  extra: Partial<Shape> = {},
): Shape => ({
  ...rowMeta(`shape:${key}`),
  kind,
  base_template: params.template,
  custom_name,
  params,
  thumbnail_url: null,
  is_favourite: false,
  times_used: 0,
  notes: null,
  ...extra,
});

export const shapes: Shape[] = [
  // From the founder's existing work (§5.4)
  shape('goldie-lace-tri', 'top', 'Goldie Lace Tri', goldieLaceTri, {
    is_favourite: true,
    times_used: 1,
    notes: 'Founder\'s signature lace-trimmed triangle.',
  }),
  shape('goldie-tie-side', 'bottom', 'Goldie Tie-Side', goldieTieSide, {
    is_favourite: true,
    times_used: 1,
    notes: 'Low-rise tie-side, cheeky back.',
  }),
  // Starter silhouettes — rename, refine or archive.
  shape('starter-bandeau', 'top', 'Starter Bandeau', {
    ...goldieLaceTri, template: 'bandeau', cupHeightCm: 12, cupWidthCm: 16, necklineDepthCm: 2,
    strapStyle: 'strapless', closure: 'hook', padding: 'removable',
  }, { notes: 'Starter shape.' }),
  shape('starter-balconette', 'top', 'Starter Balconette', {
    ...goldieLaceTri, template: 'balconette', cupHeightCm: 13, cupWidthCm: 15, necklineDepthCm: 6,
    strapStyle: 'adjustable', closure: 'hook', padding: 'moulded', underwire: true,
  }, { notes: 'Starter shape — needs underwire supplier.' }),
  shape('starter-cheeky', 'bottom', 'Starter Cheeky', {
    ...goldieTieSide, template: 'cheeky', sideWidthCm: 4, riseFrontCm: 19, riseBackCm: 24,
  }, { notes: 'Starter shape.' }),
  shape('starter-high-waist', 'bottom', 'Starter High Waist', {
    ...goldieTieSide, template: 'high_waist', riseFrontCm: 28, riseBackCm: 32, legCutAngleDeg: 30,
    backCoverage: 'moderate', sideWidthCm: 12, waistband: 'folded',
  }, { notes: 'Starter shape.' }),
];

// --- Seed design: "Blush Lace Triangle" ---------------------------------------

const blushWhite = colourByName('Blush White');
const lace = materialByName('Floral Chantilly-Style Stretch Lace');

const blushCanvas: CanvasState = {
  category: 'bikini',
  top: {
    shapeId: shapes[0].id,
    params: goldieLaceTri,
    fill: { kind: 'solid', colourId: blushWhite.id, hex: blushWhite.hex },
    lining: { kind: 'solid', hex: '#F3E3DA' },
  },
  bottom: {
    shapeId: shapes[1].id,
    params: goldieTieSide,
    fill: { kind: 'solid', colourId: blushWhite.id, hex: blushWhite.hex },
    lining: { kind: 'solid', hex: '#F3E3DA' },
  },
  embellishments: [
    { id: 'emb-1', type: 'lace_overlay', part: 'top', path: 'cup_full', materialId: lace.id, colourId: blushWhite.id, notes: 'Sheer floral lace over cup, scallop aligned to upper edge.' },
    { id: 'emb-2', type: 'lace_trim', part: 'bottom', path: 'front_waist_edge', materialId: lace.id, colourId: blushWhite.id, widthMm: 25 },
  ],
  hardware: [],
  views: { front: true, back: true, side: false },
  annotations: [],
};

const designMeta = rowMeta('design:blush-lace-triangle');
const versionMeta = rowMeta('design:blush-lace-triangle:v1');

export const designs: Design[] = [
  {
    ...designMeta,
    name: 'Blush Lace Triangle',
    status: 'in_design',
    category: 'bikini',
    collection_id: collections[0].id,
    top_shape_id: shapes[0].id,
    bottom_shape_id: shapes[1].id,
    brief: {
      feeling: 'delicate',
      occasion: 'Amalfi yacht, honeymoon',
      signatureDetail: 'sheer floral lace',
      colourStory: 'Blush White',
    },
    current_version_id: versionMeta.id,
    tags: ['lace', 'blush', 'triangle', 'tie-side', 'founder-original'],
    score: null,
  },
];

export const designVersions: DesignVersion[] = [
  {
    ...versionMeta,
    design_id: designMeta.id,
    version_number: 1,
    canvas: blushCanvas,
    svg_snapshot: null,
    png_url: null,
    change_summary: 'First version — from the founder\'s original sketch.',
  },
];

export const designNotes: DesignNote[] = [
  {
    ...rowMeta('design:blush-lace-triangle:note-1'),
    design_id: designMeta.id,
    version_id: versionMeta.id,
    type: 'note',
    body: 'Lace must be swim-grade stretch lace — check recovery after a chlorine soak on first samples.',
    anchor: null,
    resolved: false,
  },
];
