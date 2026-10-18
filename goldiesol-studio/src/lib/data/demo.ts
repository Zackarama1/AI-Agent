import { seed } from '../seed';
import { compareShapes, type Repository } from './repository';

// Read-only repository over the in-memory seed. Used when Supabase isn't configured.
export const demoRepository: Repository = {
  mode: 'demo',
  getBrandDna: async () => seed.brand_dna[0] ?? null,
  listDesigns: async () =>
    seed.designs
      .map((d) => ({
        ...d,
        version_count: seed.design_versions.filter((v) => v.design_id === d.id).length,
        collection_name: seed.collections.find((c) => c.id === d.collection_id)?.name ?? null,
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  getDesign: async (id) => {
    const design = seed.designs.find((d) => d.id === id);
    if (!design) return null;
    return {
      design,
      versions: seed.design_versions.filter((v) => v.design_id === id).sort((a, b) => b.version_number - a.version_number),
      notes: seed.design_notes.filter((n) => n.design_id === id),
    };
  },
  listOpenNotes: async () =>
    seed.design_notes
      .filter((n) => !n.resolved && (n.type === 'change_request' || n.type === 'feedback' || n.type === 'note'))
      .map((n) => ({ ...n, design_name: seed.designs.find((d) => d.id === n.design_id)?.name ?? '' })),
  listShapes: async (kind) => seed.shapes.filter((s) => !kind || s.kind === kind).sort(compareShapes),
  listColours: async () => [...seed.colours],
  listMaterials: async () => [...seed.materials],
  listSuppliers: async () => [...seed.suppliers],
  getSupplier: async (id) => {
    const supplier = seed.suppliers.find((s) => s.id === id);
    return supplier ? { supplier, contacts: [] } : null;
  },
  listCollections: async () =>
    seed.collections.map((c) => ({ ...c, design_count: seed.designs.filter((d) => d.collection_id === c.id).length })),
  listSizeChart: async () => [...seed.size_chart].sort((a, b) => a.sort_order - b.sort_order),
};
