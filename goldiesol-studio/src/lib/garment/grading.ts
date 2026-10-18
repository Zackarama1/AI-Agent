// Size grading (§7). Garment parameters are authored at base size M; every other
// size is derived from these rules. Phase 6 makes the rules editable in /settings.

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
export type SizeLabel = (typeof SIZES)[number];
export const BASE_SIZE: SizeLabel = 'M';

export interface GradingRules {
  circumferenceStepCm: number;   // bust / waist / hip change per size step
  lengthStepPct: number;         // cup heights, rises etc. scale proportionally
  baseBustCm: number;
  baseHipCm: number;
}

export const DEFAULT_GRADING: GradingRules = {
  circumferenceStepCm: 2,
  lengthStepPct: 3,
  baseBustCm: 88,
  baseHipCm: 95,
};

export interface Grade {
  size: SizeLabel;
  step: number;
  width: number;     // multiplier for widths / circumferences
  length: number;    // multiplier for heights / lengths
}

export function grade(size: SizeLabel = BASE_SIZE, rules: GradingRules = DEFAULT_GRADING): Grade {
  const step = SIZES.indexOf(size) - SIZES.indexOf(BASE_SIZE);
  const meanCirc = (rules.baseBustCm + rules.baseHipCm) / 2;
  return {
    size,
    step,
    width: 1 + (step * rules.circumferenceStepCm) / meanCirc,
    length: 1 + (step * rules.lengthStepPct) / 100,
  };
}

export interface Measurement {
  code: string;          // point-of-measure code used in tech packs
  name: string;
  valueCm: number;
  toleranceCm: number;
}

// Default tolerances (§9.1): ±0.5 cm on small dimensions, ±1 cm on large.
export function pom(code: string, name: string, valueCm: number): Measurement {
  const v = Math.round(valueCm * 10) / 10;
  return { code, name, valueCm: v, toleranceCm: v >= 10 ? 1 : 0.5 };
}
