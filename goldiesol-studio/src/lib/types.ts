// Row types mirroring the Postgres schema (supabase/migrations). Kept snake_case
// so Supabase rows can be used directly without a mapping layer.

import type { BottomParams, CanvasState, GarmentCategory, OnePieceParams, TopParams } from './garment/types';

interface Row {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface BrandDna extends Row {
  mission: string;
  aesthetic_keywords: string[];
  never_do: string[];
  target_customer: string;
  price_positioning: string;
  reference_brands: string[];
}

export type ShapeKind = 'top' | 'bottom' | 'one_piece' | 'cover_up';

export interface Shape extends Row {
  kind: ShapeKind;
  base_template: string;
  custom_name: string;
  params: TopParams | BottomParams | OnePieceParams;
  thumbnail_url: string | null;
  is_favourite: boolean;
  times_used: number;
  notes: string | null;
}

export const DESIGN_STATUSES = ['idea', 'in_design', 'review', 'approved', 'sampling', 'production', 'archived'] as const;
export type DesignStatus = (typeof DESIGN_STATUSES)[number];

export interface Design extends Row {
  name: string;
  status: DesignStatus;
  category: GarmentCategory | null;
  collection_id: string | null;
  top_shape_id: string | null;
  bottom_shape_id: string | null;
  brief: Record<string, unknown> | null;
  current_version_id: string | null;
  tags: string[];
  score: Record<string, unknown> | null;
}

export interface DesignVersion extends Row {
  design_id: string;
  version_number: number;
  canvas: CanvasState;
  svg_snapshot: string | null;
  png_url: string | null;
  change_summary: string | null;
}

export type NoteType = 'note' | 'feedback' | 'change_request' | 'ai_feedback' | 'supplier_feedback';

export interface DesignNote extends Row {
  design_id: string;
  version_id: string | null;
  type: NoteType;
  body: string;
  anchor: { x: number; y: number; part?: string } | null;
  resolved: boolean;
}

export interface Collection extends Row {
  name: string;
  season: string | null;
  description: string | null;
  cover_url: string | null;
  archived: boolean;
}

export const MATERIAL_TYPES = [
  'main_fabric', 'lining', 'lace', 'mesh', 'trim', 'elastic', 'hardware', 'bead', 'thread', 'padding', 'label',
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export interface Material extends Row {
  type: MaterialType;
  name: string;
  composition: string | null;
  weight_gsm: number | null;
  supplier_id: string | null;
  swatch_url: string | null;
  colourways: string[];
  price_per_unit: number | null;
  unit: string | null;
  chlorine_resistant: boolean | null;
  uv_rating: string | null;
  notes: string | null;
}

export interface Colour extends Row {
  name: string;
  hex: string;
  pantone_code: string | null;
  pantone_system: 'TCX' | 'TPG' | null;
  palette: string;
}

export interface SizeChartRow extends Row {
  size_label: string;
  sort_order: number;
  bust_cm: number;
  underbust_cm: number;
  waist_cm: number;
  hip_cm: number;
  torso_cm: number;
  cup: string | null;
}

export const SUPPLIER_STAGES = [
  'researching', 'contacted', 'replied', 'call_booked', 'sampling', 'quoted', 'approved', 'rejected',
] as const;
export type SupplierStage = (typeof SUPPLIER_STAGES)[number];

export interface Supplier extends Row {
  kind: 'factory' | 'platform';
  name: string;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  specialties: string[];
  moq_per_style: number | null;
  moq_per_order: number | null;
  sample_moq: number | null;
  sample_lead_days: number | null;
  bulk_lead_days: number | null;
  price_tier: '$' | '$$' | '$$$' | null;
  certifications: string[];
  stage: SupplierStage;
  rating: number | null;
  notes: string | null;
  source_url: string | null;
  verified: boolean;
}

export interface SupplierContact extends Row {
  supplier_id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
}

export interface TasteStatement extends Row {
  statement: string;
  evidence_design_ids: string[];
  confidence: number;
  source: 'explicit' | 'observed';
  active: boolean;
  pinned: boolean;
}
