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
