import { randomUUID } from 'node:crypto';
import { seed } from '../seed';
import type { Collection, Design, DesignNote, DesignVersion, Shape } from '../types';
import { compareShapes, DuplicateShapeNameError, type Repository } from './repository';

// In-memory repository over a copy of the seed, used when Supabase isn't
// configured. Writes live for the life of the server process only — the demo
// banner says so. Kept on globalThis so dev-server reloads don't reset it.
type DemoStore = {
  designs: Design[];
  design_versions: DesignVersion[];
  design_notes: DesignNote[];
  shapes: Shape[];
  collections: Collection[];
};

const g = globalThis as unknown as { __goldiesolDemo?: DemoStore };

function store(): DemoStore {
  g.__goldiesolDemo ??= structuredClone({
    designs: [...seed.designs],
    design_versions: [...seed.design_versions],
    design_notes: [...seed.design_notes],
    shapes: [...seed.shapes],
    collections: [...seed.collections],
  });
  return g.__goldiesolDemo;
}

export function resetDemoStore() {
  g.__goldiesolDemo = undefined;
}

const now = () => new Date().toISOString();

export const demoRepository: Repository = {
  mode: 'demo',
  getBrandDna: async () => seed.brand_dna[0] ?? null,
  listDesigns: async () => {
    const s = store();
    return s.designs
      .map((d) => ({
        ...d,
        version_count: s.design_versions.filter((v) => v.design_id === d.id).length,
        collection_name: s.collections.find((c) => c.id === d.collection_id)?.name ?? null,
        thumbnail_canvas: s.design_versions.find((v) => v.id === d.current_version_id)?.canvas ?? null,
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  getDesign: async (id) => {
    const s = store();
    const design = s.designs.find((d) => d.id === id);
    if (!design) return null;
    return {
      design,
      versions: s.design_versions.filter((v) => v.design_id === id).sort((a, b) => b.version_number - a.version_number),
      notes: s.design_notes.filter((n) => n.design_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    };
  },
  getVersion: async (designId, versionId) =>
    store().design_versions.find((v) => v.id === versionId && v.design_id === designId) ?? null,
  listOpenNotes: async () => {
    const s = store();
    return s.design_notes
      .filter((n) => !n.resolved && (n.type === 'change_request' || n.type === 'feedback' || n.type === 'note'))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((n) => ({ ...n, design_name: s.designs.find((d) => d.id === n.design_id)?.name ?? '' }));
  },
  listShapes: async (kind) => store().shapes.filter((s) => !kind || s.kind === kind).sort(compareShapes),
  listColours: async () => [...seed.colours],
  listMaterials: async () => [...seed.materials],
  listSuppliers: async () => [...seed.suppliers],
  getSupplier: async (id) => {
    const supplier = seed.suppliers.find((s) => s.id === id);
    return supplier ? { supplier, contacts: [] } : null;
  },
  listCollections: async () => {
    const s = store();
    return s.collections
      .map((c) => ({ ...c, design_count: s.designs.filter((d) => d.collection_id === c.id).length }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  getCollection: async (id) => {
    const s = store();
    const c = s.collections.find((x) => x.id === id);
    return c ? { ...c, design_count: s.designs.filter((d) => d.collection_id === c.id).length } : null;
  },
  listSizeChart: async () => [...seed.size_chart].sort((a, b) => a.sort_order - b.sort_order),

  createDesign: async (input) => {
    const s = store();
    const t = now();
    const design: Design = {
      id: randomUUID(), created_at: t, updated_at: t, name: input.name, status: 'in_design', category: input.category,
      collection_id: input.collection_id ?? null, top_shape_id: input.top_shape_id, bottom_shape_id: input.bottom_shape_id,
      brief: null, current_version_id: null, tags: [], score: null,
    };
    s.designs.push(design);
    return design;
  },
  saveVersion: async (designId, input) => {
    const s = store();
    const design = s.designs.find((d) => d.id === designId);
    if (!design) throw new Error('Design not found');
    const t = now();
    const version: DesignVersion = {
      id: randomUUID(), created_at: t, updated_at: t, design_id: designId,
      version_number: Math.max(0, ...s.design_versions.filter((v) => v.design_id === designId).map((v) => v.version_number)) + 1,
      canvas: input.canvas, svg_snapshot: input.svg_snapshot, png_url: null, change_summary: input.change_summary,
    };
    s.design_versions.push(version);
    design.current_version_id = version.id;
    design.updated_at = t;
    return version;
  },
  updateDesign: async (id, patch) => {
    const design = store().designs.find((d) => d.id === id);
    if (!design) throw new Error('Design not found');
    Object.assign(design, patch, { updated_at: now() });
  },
  addNote: async (input) => {
    const t = now();
    const note: DesignNote = { id: randomUUID(), created_at: t, updated_at: t, resolved: false, ...input };
    store().design_notes.push(note);
    return note;
  },
  updateNote: async (id, patch) => {
    const note = store().design_notes.find((n) => n.id === id);
    if (!note) throw new Error('Note not found');
    Object.assign(note, patch, { updated_at: now() });
    return note;
  },
  createCollection: async (input) => {
    const t = now();
    const c: Collection = { id: randomUUID(), created_at: t, updated_at: t, cover_url: null, archived: false, ...input };
    store().collections.push(c);
    return c;
  },
  updateCollection: async (id, patch) => {
    const c = store().collections.find((x) => x.id === id);
    if (!c) throw new Error('Collection not found');
    Object.assign(c, patch, { updated_at: now() });
  },
  createShape: async (input) => {
    const s = store();
    if (s.shapes.some((x) => x.custom_name.toLowerCase() === input.custom_name.toLowerCase())) throw new DuplicateShapeNameError(input.custom_name);
    const t = now();
    const shape: Shape = { id: randomUUID(), created_at: t, updated_at: t, thumbnail_url: null, is_favourite: false, times_used: 0, notes: input.notes ?? null, ...input };
    s.shapes.push(shape);
    return shape;
  },
  updateShape: async (id, patch) => {
    const s = store();
    const shape = s.shapes.find((x) => x.id === id);
    if (!shape) throw new Error('Shape not found');
    if (patch.custom_name && s.shapes.some((x) => x.id !== id && x.custom_name.toLowerCase() === patch.custom_name!.toLowerCase())) {
      throw new DuplicateShapeNameError(patch.custom_name);
    }
    Object.assign(shape, patch, { updated_at: now() });
  },
  recordShapeUse: async (ids) => {
    for (const shape of store().shapes) if (ids.includes(shape.id)) shape.times_used += 1;
  },
};
