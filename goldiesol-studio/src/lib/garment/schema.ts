import { z } from 'zod';
import { BOTTOM_TEMPLATES, ONE_PIECE_TEMPLATES, TOP_TEMPLATES } from './defaults';
import {
  EMBELLISHMENT_TYPES, HARDWARE_FINISHES, HARDWARE_PLACEMENTS, LACE_TEXTURES, PRINTS, type CanvasState,
} from './types';

// Validates canvas state arriving from the browser before it is saved (§5.3).
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const cm = (min: number, max: number) => z.number().finite().min(min).max(max);
const id = z.string().min(1).max(80);
const imageUrl = z
  .string()
  .max(2_000_000)
  .regex(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/);

const fill = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('solid'), colourId: id.optional(), hex }),
  z.object({ kind: z.literal('print'), print: z.enum(PRINTS), hex, accentHex: hex, scale: cm(0.25, 4) }),
  z.object({ kind: z.literal('image'), imageUrl, scale: cm(0.25, 4) }),
  z.object({ kind: z.literal('lace'), texture: z.enum(LACE_TEXTURES), hex, baseHex: hex.optional() }),
  z.object({ kind: z.literal('crochet'), hex, baseHex: hex.optional() }),
  z.object({ kind: z.literal('mesh'), hex, opacity: cm(0, 1) }),
]);

const coverage = z.enum(['full', 'moderate', 'cheeky', 'brazilian', 'thong']);

export const topParamsSchema = z.object({
  template: z.enum(TOP_TEMPLATES as [string, ...string[]]),
  cupHeightCm: cm(6, 30),
  cupWidthCm: cm(6, 30),
  necklineDepthCm: cm(0, 30),
  strapWidthMm: cm(2, 40),
  strapStyle: z.enum(['halter', 'over_shoulder', 'cross_back', 'strapless', 'tie', 'adjustable']),
  closure: z.enum(['tie_back', 'hook', 'clasp', 'ring', 'pullover']),
  padding: z.enum(['none', 'removable', 'moulded']),
  underwire: z.boolean(),
  lined: z.boolean(),
});

export const bottomParamsSchema = z.object({
  template: z.enum(BOTTOM_TEMPLATES as [string, ...string[]]),
  riseFrontCm: cm(8, 40),
  riseBackCm: cm(8, 45),
  legCutAngleDeg: cm(0, 75),
  backCoverage: coverage,
  sideWidthCm: cm(0, 25),
  waistband: z.enum(['none', 'folded', 'elastic', 'ruched']),
  scrunch: z.boolean(),
  lined: z.boolean(),
});

export const onePieceParamsSchema = z.object({
  template: z.enum(ONE_PIECE_TEMPLATES as [string, ...string[]]),
  necklineDepthCm: cm(0, 40),
  backScoopDepthCm: cm(0, 55),
  legCutAngleDeg: cm(0, 75),
  strapWidthMm: cm(2, 60),
  cutOutSizeCm: cm(0, 25),
  backCoverage: coverage,
  lined: z.boolean(),
});

const piece = <T extends z.ZodTypeAny>(params: T) =>
  z.object({ shapeId: id.optional(), params, fill, lining: fill, materialId: id.optional() });

export const canvasStateSchema = z.object({
  category: z.enum(['bikini', 'one_piece', 'monokini', 'tankini', 'cover_up']),
  top: piece(topParamsSchema).optional(),
  bottom: piece(bottomParamsSchema).optional(),
  onePiece: piece(onePieceParamsSchema).optional(),
  embellishments: z
    .array(
      z.object({
        id,
        type: z.enum(EMBELLISHMENT_TYPES),
        part: z.enum(['top', 'bottom', 'one_piece', 'strap', 'tie']),
        path: z.string().max(40),
        materialId: id.optional(),
        colourId: id.optional(),
        density: cm(1, 400).optional(),
        widthMm: cm(1, 80).optional(),
        spacingMm: cm(1, 200).optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .max(60),
  hardware: z
    .array(z.object({ id, type: z.enum(['ring', 'slider', 'clasp', 'toggle', 'bead_end']), finish: z.enum(HARDWARE_FINISHES), sizeMm: cm(2, 60), placement: z.enum(HARDWARE_PLACEMENTS) }))
    .max(20),
  views: z.object({ front: z.boolean(), back: z.boolean(), side: z.boolean() }),
  annotations: z.array(z.object({ id, x: cm(0, 1), y: cm(0, 1), text: z.string().max(200) })).max(40),
});

export function parseCanvas(input: unknown): CanvasState {
  return canvasStateSchema.parse(input) as CanvasState;
}
