import type { CanvasState } from '../garment/types';
import type {
  BrandDna, Collection, Colour, Design, DesignNote, DesignVersion, Material, NoteAnchor, NoteType, Shape,
  ShapeKind, SizeChartRow, Supplier, SupplierContact,
} from '../types';

export interface DesignSummary extends Design {
  version_count: number;
  collection_name: string | null;
  thumbnail_canvas: CanvasState | null;
}

export interface NewDesign {
  name: string;
  category: NonNullable<Design['category']>;
  canvas: CanvasState;
  top_shape_id: string | null;
  bottom_shape_id: string | null;
  collection_id?: string | null;
}

export interface NewVersion {
  canvas: CanvasState;
  change_summary: string;
  svg_snapshot: string;
}

export interface NewNote {
  design_id: string;
  version_id: string | null;
  type: NoteType;
  body: string;
  anchor: NoteAnchor | null;
}

export type DesignPatch = Partial<Pick<Design, 'name' | 'status' | 'top_shape_id' | 'bottom_shape_id' | 'collection_id' | 'tags'>>;
export type CollectionPatch = Partial<Pick<Collection, 'name' | 'season' | 'description' | 'archived'>>;

export type NewShape = Pick<Shape, 'kind' | 'base_template' | 'custom_name' | 'params'> & { notes?: string | null };

export class DuplicateShapeNameError extends Error {
  constructor(name: string) {
    super(`A shape called "${name}" already exists.`);
  }
}

export interface CollectionSummary extends Collection {
  design_count: number;
}

export interface DesignDetail {
  design: Design;
  versions: DesignVersion[];
  notes: DesignNote[];
}

// Every page reads data through this interface, so demo mode (seed data) and
// Supabase are interchangeable.
export interface Repository {
  readonly mode: 'demo' | 'supabase';
  getBrandDna(): Promise<BrandDna | null>;
  listDesigns(): Promise<DesignSummary[]>;
  getDesign(id: string): Promise<DesignDetail | null>;
  getVersion(designId: string, versionId: string): Promise<DesignVersion | null>;
  listOpenNotes(): Promise<(DesignNote & { design_name: string })[]>;
  listShapes(kind?: ShapeKind): Promise<Shape[]>;
  listColours(): Promise<Colour[]>;
  listMaterials(): Promise<Material[]>;
  listSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<{ supplier: Supplier; contacts: SupplierContact[] } | null>;
  listCollections(): Promise<CollectionSummary[]>;
  getCollection(id: string): Promise<CollectionSummary | null>;
  listSizeChart(): Promise<SizeChartRow[]>;

  // Writes. Designs are never deleted — status 'archived' hides them.
  createDesign(input: NewDesign): Promise<Design>;
  saveVersion(designId: string, input: NewVersion): Promise<DesignVersion>;
  updateDesign(id: string, patch: DesignPatch): Promise<void>;
  addNote(input: NewNote): Promise<DesignNote>;
  updateNote(id: string, patch: { resolved?: boolean; body?: string }): Promise<DesignNote>;
  createCollection(input: { name: string; season: string | null; description: string | null }): Promise<Collection>;
  updateCollection(id: string, patch: CollectionPatch): Promise<void>;
  createShape(input: NewShape): Promise<Shape>;
  updateShape(id: string, patch: { custom_name?: string; is_favourite?: boolean }): Promise<void>;
  recordShapeUse(ids: string[]): Promise<void>;
}

// Favourites first, then most used, then name — the order the New Design flow shows.
export const compareShapes = (a: Shape, b: Shape) =>
  Number(b.is_favourite) - Number(a.is_favourite) ||
  b.times_used - a.times_used ||
  a.custom_name.localeCompare(b.custom_name);
