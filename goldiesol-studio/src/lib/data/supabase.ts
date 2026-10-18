import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanvasState } from '../garment/types';
import type {
  BrandDna, Collection, Colour, Design, DesignNote, DesignVersion, Material, Shape, SizeChartRow, Supplier,
  SupplierContact,
} from '../types';
import { compareShapes, DuplicateShapeNameError, type Repository } from './repository';

function rows<T>(res: { data: unknown; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T[];
}

function one<T>(res: { data: unknown; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

function check(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

const UNIQUE_VIOLATION = '23505';

// designs ↔ design_versions are linked twice (design_id and current_version_id),
// so embeds must name the foreign key.
const VERSIONS_FK = 'design_versions!design_versions_design_id_fkey';
const CURRENT_FK = 'design_versions!designs_current_version_fk';

export function supabaseRepository(db: SupabaseClient): Repository {
  return {
    mode: 'supabase',
    getBrandDna: async () => rows<BrandDna>(await db.from('brand_dna').select('*').limit(1))[0] ?? null,
    listDesigns: async () => {
      const data = rows<
        Design & {
          versions: { count: number }[];
          collections: { name: string } | null;
          current: { canvas: CanvasState } | null;
        }
      >(
        await db
          .from('designs')
          .select(`*, versions:${VERSIONS_FK}(count), collections(name), current:${CURRENT_FK}(canvas)`)
          .order('updated_at', { ascending: false }),
      );
      return data.map(({ versions, collections, current, ...d }) => ({
        ...d,
        version_count: versions[0]?.count ?? 0,
        collection_name: collections?.name ?? null,
        thumbnail_canvas: current?.canvas ?? null,
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
    getVersion: async (designId, versionId) =>
      rows<DesignVersion>(await db.from('design_versions').select('*').eq('id', versionId).eq('design_id', designId).limit(1))[0] ?? null,
    listOpenNotes: async () => {
      const data = rows<DesignNote & { designs: { name: string } | null }>(
        await db
          .from('design_notes')
          .select('*, designs(name)')
          .eq('resolved', false)
          .in('type', ['change_request', 'feedback', 'note'])
          .order('created_at', { ascending: false }),
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
    getCollection: async (id) => {
      const [c] = rows<Collection & { designs: { count: number }[] }>(await db.from('collections').select('*, designs(count)').eq('id', id).limit(1));
      if (!c) return null;
      const { designs, ...rest } = c;
      return { ...rest, design_count: designs[0]?.count ?? 0 };
    },
    listSizeChart: async () => rows<SizeChartRow>(await db.from('size_chart').select('*').order('sort_order')),

    createDesign: async (input) =>
      one<Design>(
        await db
          .from('designs')
          .insert({
            name: input.name,
            category: input.category,
            status: 'in_design',
            top_shape_id: input.top_shape_id,
            bottom_shape_id: input.bottom_shape_id,
            collection_id: input.collection_id ?? null,
          })
          .select()
          .single(),
      ),
    saveVersion: async (designId, input) => {
      const [latest] = rows<{ version_number: number }>(
        await db.from('design_versions').select('version_number').eq('design_id', designId).order('version_number', { ascending: false }).limit(1),
      );
      const version = one<DesignVersion>(
        await db
          .from('design_versions')
          .insert({ design_id: designId, version_number: (latest?.version_number ?? 0) + 1, ...input })
          .select()
          .single(),
      );
      check(await db.from('designs').update({ current_version_id: version.id }).eq('id', designId));
      return version;
    },
    updateDesign: async (id, patch) => check(await db.from('designs').update(patch).eq('id', id)),
    addNote: async (input) => one<DesignNote>(await db.from('design_notes').insert(input).select().single()),
    updateNote: async (id, patch) => one<DesignNote>(await db.from('design_notes').update(patch).eq('id', id).select().single()),
    createCollection: async (input) => one<Collection>(await db.from('collections').insert(input).select().single()),
    updateCollection: async (id, patch) => check(await db.from('collections').update(patch).eq('id', id)),
    createShape: async (input) => {
      const res = await db.from('shapes').insert(input).select().single();
      if (res.error?.code === UNIQUE_VIOLATION) throw new DuplicateShapeNameError(input.custom_name);
      return one<Shape>(res);
    },
    updateShape: async (id, patch) => {
      const res = await db.from('shapes').update(patch).eq('id', id);
      if (res.error?.code === UNIQUE_VIOLATION) throw new DuplicateShapeNameError(patch.custom_name ?? '');
      check(res);
    },
    recordShapeUse: async (ids) => {
      if (!ids.length) return;
      check(await db.rpc('increment_shape_use', { shape_ids: ids }));
    },
  };
}
