import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BrandDna, Collection, Colour, Design, DesignNote, DesignVersion, Material, Shape, SizeChartRow, Supplier,
  SupplierContact,
} from '../types';
import { compareShapes, type Repository } from './repository';

function rows<T>(res: { data: unknown; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T[];
}

export function supabaseRepository(db: SupabaseClient): Repository {
  return {
    mode: 'supabase',
    getBrandDna: async () => rows<BrandDna>(await db.from('brand_dna').select('*').limit(1))[0] ?? null,
    listDesigns: async () => {
      const data = rows<Design & { design_versions: { count: number }[]; collections: { name: string } | null }>(
        await db
          .from('designs')
          .select('*, design_versions(count), collections(name)')
          .order('updated_at', { ascending: false }),
      );
      return data.map(({ design_versions, collections, ...d }) => ({
        ...d,
        version_count: design_versions[0]?.count ?? 0,
        collection_name: collections?.name ?? null,
      }));
    },
    getDesign: async (id) => {
      const [design] = rows<Design>(await db.from('designs').select('*').eq('id', id).limit(1));
      if (!design) return null;
      const [versions, notes] = await Promise.all([
        db.from('design_versions').select('*').eq('design_id', id).order('version_number', { ascending: false }),
        db.from('design_notes').select('*').eq('design_id', id).order('created_at'),
      ]);
      return { design, versions: rows<DesignVersion>(versions), notes: rows<DesignNote>(notes) };
    },
    listOpenNotes: async () => {
      const data = rows<DesignNote & { designs: { name: string } | null }>(
        await db.from('design_notes').select('*, designs(name)').eq('resolved', false).in('type', ['change_request', 'feedback', 'note']),
      );
      return data.map(({ designs, ...n }) => ({ ...n, design_name: designs?.name ?? '' }));
    },
    listShapes: async (kind) => {
      let q = db.from('shapes').select('*');
      if (kind) q = q.eq('kind', kind);
      return rows<Shape>(await q).sort(compareShapes);
    },
    listColours: async () => rows<Colour>(await db.from('colours').select('*').order('palette').order('name')),
    listMaterials: async () => rows<Material>(await db.from('materials').select('*').order('type').order('name')),
    listSuppliers: async () => rows<Supplier>(await db.from('suppliers').select('*').order('name')),
    getSupplier: async (id) => {
      const [supplier] = rows<Supplier>(await db.from('suppliers').select('*').eq('id', id).limit(1));
      if (!supplier) return null;
      const contacts = rows<SupplierContact>(await db.from('supplier_contacts').select('*').eq('supplier_id', id));
      return { supplier, contacts };
    },
    listCollections: async () => {
      const data = rows<Collection & { designs: { count: number }[] }>(
        await db.from('collections').select('*, designs(count)').order('created_at', { ascending: false }),
      );
      return data.map(({ designs, ...c }) => ({ ...c, design_count: designs[0]?.count ?? 0 }));
    },
    listSizeChart: async () => rows<SizeChartRow>(await db.from('size_chart').select('*').order('sort_order')),
  };
}
