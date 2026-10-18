import { beforeEach, describe, expect, it } from 'vitest';
import { demoRepository as repo, resetDemoStore } from '@/lib/data/demo';
import { DuplicateShapeNameError } from '@/lib/data/repository';
import { DEFAULT_TOP, newCanvas } from '@/lib/garment/defaults';

beforeEach(() => resetDemoStore());

describe('demo repository writes', () => {
  it('creates a design and numbers its versions', async () => {
    const canvas = newCanvas('bikini');
    const d = await repo.createDesign({ name: 'Test', category: 'bikini', canvas, top_shape_id: null, bottom_shape_id: null });
    const v1 = await repo.saveVersion(d.id, { canvas, change_summary: 'First version.', svg_snapshot: '<svg/>' });
    const v2 = await repo.saveVersion(d.id, { canvas, change_summary: 'Second', svg_snapshot: '<svg/>' });
    expect([v1.version_number, v2.version_number]).toEqual([1, 2]);
    const detail = await repo.getDesign(d.id);
    expect(detail?.design.current_version_id).toBe(v2.id);
    const summary = (await repo.listDesigns()).find((x) => x.id === d.id)!;
    expect(summary.version_count).toBe(2);
    expect(summary.thumbnail_canvas).toEqual(canvas);
  });

  it('rejects duplicate shape names, case-insensitively', async () => {
    await expect(repo.createShape({ kind: 'top', base_template: 'triangle', custom_name: 'goldie lace tri', params: DEFAULT_TOP })).rejects.toBeInstanceOf(DuplicateShapeNameError);
  });

  it('updates only the fields given', async () => {
    const [shape] = await repo.listShapes('top');
    await repo.updateShape(shape.id, { is_favourite: false });
    const after = (await repo.listShapes('top')).find((s) => s.id === shape.id)!;
    expect(after.custom_name).toBe(shape.custom_name);
    expect(after.is_favourite).toBe(false);
  });

  it('sorts favourites first, then by use', async () => {
    const shapes = await repo.listShapes('bottom');
    expect(shapes[0].is_favourite).toBe(true);
    await repo.recordShapeUse([shapes[1].id, shapes[1].id]);
    await repo.recordShapeUse([shapes[1].id]);
    expect((await repo.listShapes('bottom')).find((s) => s.id === shapes[1].id)!.times_used).toBe(2);
  });
});

describe('notes and collections', () => {
  it('adds pinned notes and resolves them', async () => {
    const [design] = await repo.listDesigns();
    const note = await repo.addNote({ design_id: design.id, version_id: design.current_version_id, type: 'change_request', body: 'Lower rise 2 cm', anchor: { x: 0.4, y: 0.6, view: 'front', part: 'bottom' } });
    expect((await repo.listOpenNotes()).some((n) => n.id === note.id)).toBe(true);
    await repo.updateNote(note.id, { resolved: true });
    expect((await repo.listOpenNotes()).some((n) => n.id === note.id)).toBe(false);
    expect((await repo.getDesign(design.id))!.notes.find((n) => n.id === note.id)?.anchor).toEqual({ x: 0.4, y: 0.6, view: 'front', part: 'bottom' });
  });

  it('creates collections, assigns designs and archives', async () => {
    const [design] = await repo.listDesigns();
    const c = await repo.createCollection({ name: 'Riviera Nights', season: 'Resort 27', description: null });
    await repo.updateDesign(design.id, { collection_id: c.id });
    expect((await repo.getCollection(c.id))!.design_count).toBe(1);
    expect((await repo.listDesigns())[0].collection_name).toBe('Riviera Nights');
    await repo.updateCollection(c.id, { archived: true });
    expect((await repo.getCollection(c.id))!.archived).toBe(true);
  });

  it('fetches a single version only for its own design', async () => {
    const [design] = await repo.listDesigns();
    const v = (await repo.getDesign(design.id))!.versions[0];
    expect((await repo.getVersion(design.id, v.id))?.id).toBe(v.id);
    expect(await repo.getVersion('other-design', v.id)).toBeNull();
  });
});
