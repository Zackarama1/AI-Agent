import type {
  BrandDna, Collection, Colour, Design, DesignNote, DesignVersion, Material, Shape, ShapeKind,
  SizeChartRow, Supplier, SupplierContact,
} from '../types';

export interface DesignSummary extends Design {
  version_count: number;
  collection_name: string | null;
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
  listOpenNotes(): Promise<(DesignNote & { design_name: string })[]>;
  listShapes(kind?: ShapeKind): Promise<Shape[]>;
  listColours(): Promise<Colour[]>;
  listMaterials(): Promise<Material[]>;
  listSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<{ supplier: Supplier; contacts: SupplierContact[] } | null>;
  listCollections(): Promise<CollectionSummary[]>;
  listSizeChart(): Promise<SizeChartRow[]>;
}

// Favourites first, then most used, then name — the order the New Design flow shows.
export const compareShapes = (a: Shape, b: Shape) =>
  Number(b.is_favourite) - Number(a.is_favourite) ||
  b.times_used - a.times_used ||
  a.custom_name.localeCompare(b.custom_name);
