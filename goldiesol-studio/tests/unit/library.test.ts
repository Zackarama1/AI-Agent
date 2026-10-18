import { describe, expect, it } from 'vitest';
import { addEmbellishment, setFill } from '@/lib/garment/ops';
import { EMPTY_FILTERS, filterDesigns, type LibraryDesign } from '@/lib/library';
import { designs, designVersions } from '@/lib/seed/designs';

const canvas = designVersions[0].canvas;
const base: LibraryDesign = { ...designs[0], thumbnail_canvas: canvas };
const now = Date.parse('2026-10-18T12:00:00Z');
const make = (patch: Partial<LibraryDesign>): LibraryDesign => ({ ...base, ...patch });
const colours = [{ id: 'emerald', hex: '#1F6E54' }];

describe('filterDesigns', () => {
  const list = [
    make({ id: 'a', name: 'Blush Lace Triangle', updated_at: '2026-10-17T00:00:00Z' }),
    make({ id: 'b', name: 'Emerald Maillot', category: 'one_piece', status: 'review', collection_id: null, tags: ['jewel'], thumbnail_canvas: setFill(canvas, 'top', { kind: 'solid', hex: '#1F6E54', colourId: 'emerald' }), updated_at: '2026-08-01T00:00:00Z' }),
    make({ id: 'c', name: 'Old Idea', status: 'archived' }),
    make({ id: 'd', name: 'Pearl Tri', thumbnail_canvas: addEmbellishment(canvas, { type: 'pearl', part: 'top' }).canvas }),
  ];
  const ids = (f: Partial<typeof EMPTY_FILTERS>) => filterDesigns(list, { ...EMPTY_FILTERS, ...f }, colours, now).map((d) => d.id);

  it('hides archived designs unless asked', () => {
    expect(ids({})).toEqual(['a', 'b', 'd']);
    expect(ids({ status: 'archived' })).toEqual(['c']);
  });
  it('searches names and tags', () => expect(ids({ q: 'jewel' })).toEqual(['b']));
  it('filters by category, status and collection', () => {
    expect(ids({ category: 'one_piece' })).toEqual(['b']);
    expect(ids({ status: 'review' })).toEqual(['b']);
    expect(ids({ collectionId: 'none' })).toEqual(['b']);
  });
  it('filters by colour and detail type', () => {
    expect(ids({ colourId: 'emerald' })).toEqual(['b']);
    expect(ids({ detail: 'pearl' })).toEqual(['d']);
    expect(ids({ detail: 'lace_overlay' })).toEqual(['a', 'b', 'd']);
  });
  it('filters by last edited', () => expect(ids({ editedWithinDays: 7 })).toEqual(['a']));
});
