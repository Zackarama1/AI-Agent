import type { BottomParams, OnePieceParams, TopParams } from '@/lib/garment/types';

// Parametric controls per piece. Ranges sit inside the server-side schema limits.

type NumericKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];
type BoolKeys<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];
type EnumKeys<T> = { [K in keyof T]: T[K] extends string ? (K extends 'template' ? never : K) : never }[keyof T];

export interface FieldSet<T> {
  sliders: { key: NumericKeys<T>; label: string; unit: string; min: number; max: number; step: number }[];
  selects: { key: EnumKeys<T>; label: string; options: readonly string[] }[];
  toggles: { key: BoolKeys<T>; label: string }[];
}

// Key-erased view used by generic UI that renders any of the sets.
export interface LooseFieldSet {
  sliders: { key: string; label: string; unit: string; min: number; max: number; step: number }[];
  selects: { key: string; label: string; options: readonly string[] }[];
  toggles: { key: string; label: string }[];
}

const COVERAGE = ['full', 'moderate', 'cheeky', 'brazilian', 'thong'] as const;

export const TOP_FIELDS: FieldSet<TopParams> = {
  sliders: [
    { key: 'cupHeightCm', label: 'Cup height', unit: 'cm', min: 8, max: 24, step: 0.5 },
    { key: 'cupWidthCm', label: 'Cup width', unit: 'cm', min: 8, max: 22, step: 0.5 },
    { key: 'necklineDepthCm', label: 'Neckline depth', unit: 'cm', min: 0, max: 20, step: 0.5 },
    { key: 'strapWidthMm', label: 'Strap width', unit: 'mm', min: 3, max: 30, step: 1 },
  ],
  selects: [
    { key: 'strapStyle', label: 'Straps', options: ['halter', 'over_shoulder', 'cross_back', 'strapless', 'tie', 'adjustable'] },
    { key: 'closure', label: 'Closure', options: ['tie_back', 'hook', 'clasp', 'ring', 'pullover'] },
    { key: 'padding', label: 'Padding', options: ['none', 'removable', 'moulded'] },
  ],
  toggles: [
    { key: 'underwire', label: 'Underwire' },
    { key: 'lined', label: 'Lined' },
  ],
};

export const BOTTOM_FIELDS: FieldSet<BottomParams> = {
  sliders: [
    { key: 'riseFrontCm', label: 'Front rise', unit: 'cm', min: 10, max: 34, step: 0.5 },
    { key: 'riseBackCm', label: 'Back rise', unit: 'cm', min: 12, max: 38, step: 0.5 },
    { key: 'legCutAngleDeg', label: 'Leg cut', unit: '°', min: 5, max: 65, step: 1 },
    { key: 'sideWidthCm', label: 'Side width', unit: 'cm', min: 0, max: 20, step: 0.5 },
  ],
  selects: [
    { key: 'backCoverage', label: 'Back coverage', options: COVERAGE },
    { key: 'waistband', label: 'Waistband', options: ['none', 'folded', 'elastic', 'ruched'] },
  ],
  toggles: [
    { key: 'scrunch', label: 'Scrunch back' },
    { key: 'lined', label: 'Lined' },
  ],
};

export const ONE_PIECE_FIELDS: FieldSet<OnePieceParams> = {
  sliders: [
    { key: 'necklineDepthCm', label: 'Front neckline', unit: 'cm', min: 2, max: 35, step: 0.5 },
    { key: 'backScoopDepthCm', label: 'Back scoop', unit: 'cm', min: 5, max: 50, step: 0.5 },
    { key: 'legCutAngleDeg', label: 'Leg cut', unit: '°', min: 10, max: 65, step: 1 },
    { key: 'strapWidthMm', label: 'Strap width', unit: 'mm', min: 4, max: 40, step: 1 },
    { key: 'cutOutSizeCm', label: 'Cut-outs', unit: 'cm', min: 0, max: 18, step: 0.5 },
  ],
  selects: [{ key: 'backCoverage', label: 'Back coverage', options: COVERAGE }],
  toggles: [{ key: 'lined', label: 'Lined' }],
};
