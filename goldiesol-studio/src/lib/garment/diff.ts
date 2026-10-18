import type { CanvasState, Fill } from './types';

// Rule-based change summary for each autosaved version. Phase 4 lets the AI
// Partner rewrite these in prose.

const UNITS: Record<string, string> = { Cm: ' cm', Mm: ' mm', Deg: '°' };

function label(key: string): { name: string; unit: string } {
  const m = key.match(/(Cm|Mm|Deg)$/);
  const bare = m ? key.slice(0, -m[1].length) : key;
  const name = bare.replace(/([A-Z])/g, ' $1').toLowerCase();
  return { name: name.charAt(0).toUpperCase() + name.slice(1), unit: m ? UNITS[m[1]] : '' };
}

const fmt = (v: unknown) => (typeof v === 'number' ? String(Math.round(v * 10) / 10) : String(v).replace(/_/g, ' '));

function describeFill(f: Fill, colourNames: Record<string, string>): string {
  switch (f.kind) {
    case 'solid': return (f.colourId && colourNames[f.colourId]) || f.hex;
    case 'print': return `${f.print.replace(/_/g, ' ')} print`;
    case 'image': return 'uploaded print';
    case 'lace': return `${f.texture} lace`;
    case 'crochet': return 'crochet';
    case 'mesh': return 'mesh';
  }
}

const PART_NAMES = { top: 'Top', bottom: 'Bottom', onePiece: 'One-piece' } as const;

export function describeChanges(prev: CanvasState | null, next: CanvasState, colourNames: Record<string, string> = {}): string {
  if (!prev) return 'First version.';
  const changes: string[] = [];

  for (const part of ['top', 'bottom', 'onePiece'] as const) {
    const a = prev[part];
    const b = next[part];
    if (!a && b) changes.push(`Added ${PART_NAMES[part].toLowerCase()}`);
    if (a && !b) changes.push(`Removed ${PART_NAMES[part].toLowerCase()}`);
    if (!a || !b) continue;
    const pa = a.params as unknown as Record<string, unknown>;
    const pb = b.params as unknown as Record<string, unknown>;
    if (pa.template !== pb.template) changes.push(`${PART_NAMES[part]}: ${fmt(pa.template)} → ${fmt(pb.template)}`);
    for (const key of Object.keys(pb)) {
      if (key === 'template' || pa[key] === pb[key]) continue;
      const { name, unit } = label(key);
      changes.push(`${PART_NAMES[part]} ${name.toLowerCase()} ${fmt(pa[key])}${unit} → ${fmt(pb[key])}${unit}`);
    }
    if (JSON.stringify(a.fill) !== JSON.stringify(b.fill)) changes.push(`${PART_NAMES[part]} fabric → ${describeFill(b.fill, colourNames)}`);
    if (a.shapeId !== b.shapeId && b.shapeId) changes.push(`${PART_NAMES[part]} loaded from saved shape`);
  }

  const before = new Map(prev.embellishments.map((e) => [e.id, e]));
  const after = new Map(next.embellishments.map((e) => [e.id, e]));
  for (const [id, e] of after) {
    const old = before.get(id);
    if (!old) changes.push(`Added ${e.type.replace(/_/g, ' ')} on ${e.path.replace(/_/g, ' ')}`);
    else if (JSON.stringify(old) !== JSON.stringify(e)) changes.push(`Adjusted ${e.type.replace(/_/g, ' ')}`);
  }
  for (const [id, e] of before) if (!after.has(id)) changes.push(`Removed ${e.type.replace(/_/g, ' ')}`);

  if (JSON.stringify(prev.hardware) !== JSON.stringify(next.hardware)) changes.push('Updated hardware');
  if (JSON.stringify(prev.annotations) !== JSON.stringify(next.annotations)) changes.push('Updated annotations');

  if (!changes.length) return 'No visible changes.';
  const shown = changes.slice(0, 4).join('; ');
  return changes.length > 4 ? `${shown}; +${changes.length - 4} more` : shown;
}
