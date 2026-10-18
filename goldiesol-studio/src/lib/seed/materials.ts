import type { Material, MaterialType } from '../types';
import { rowMeta } from './ids';

// A swimwear specialist's starter library. Weights are typical industry ranges;
// prices stay blank until real supplier quotes arrive.
type MaterialSeed = {
  type: MaterialType;
  name: string;
  composition?: string;
  weight_gsm?: number;
  colourways?: string[];
  unit?: string;
  chlorine_resistant?: boolean;
  uv_rating?: string;
  notes?: string;
};

const seeds: MaterialSeed[] = [
  // Main fabrics
  { type: 'main_fabric', name: 'Recycled Polyamide Swim (ECONYL-type)', composition: '78% recycled polyamide / 22% elastane', weight_gsm: 190, unit: 'm', chlorine_resistant: true, uv_rating: 'UPF 50+', notes: 'Default Goldiesol body fabric. Soft matte hand, excellent recovery.' },
  { type: 'main_fabric', name: 'Matte Lycra Swim', composition: '80% polyamide / 20% elastane (LYCRA® XTRA LIFE™-type)', weight_gsm: 200, unit: 'm', chlorine_resistant: true, uv_rating: 'UPF 50+' },
  { type: 'main_fabric', name: 'Satin-Finish Swim', composition: '82% polyamide / 18% elastane', weight_gsm: 180, unit: 'm', chlorine_resistant: true, uv_rating: 'UPF 50+', notes: 'Soft sheen — reads luxe in blush and champagne.' },
  { type: 'main_fabric', name: 'Ribbed Swim Knit', composition: '85% polyamide / 15% elastane', weight_gsm: 240, unit: 'm', chlorine_resistant: true, notes: 'Fine 2×1 rib; check rib direction on cut plan.' },
  { type: 'main_fabric', name: 'Crinkle Seersucker Swim', composition: '86% polyamide / 14% elastane', weight_gsm: 210, unit: 'm', notes: 'One-size-fits-more stretch; crinkle relaxes slightly after washing.' },
  { type: 'main_fabric', name: 'Swim Terry', composition: '80% polyamide / 20% elastane, looped face', weight_gsm: 260, unit: 'm', notes: 'Holds water — best for cover-ups and lounge pieces.' },
  { type: 'main_fabric', name: 'Velvet Swim', composition: '82% polyamide / 18% elastane, cut-pile face', weight_gsm: 270, unit: 'm', notes: 'Evening / resort statement pieces; nap direction matters.' },
  { type: 'main_fabric', name: 'Metallic Lurex Knit', composition: '75% polyamide / 15% elastane / 10% metallic yarn', weight_gsm: 210, unit: 'm', chlorine_resistant: false, notes: 'Shimmer; test metallic yarn for chlorine and salt tarnish.' },
  { type: 'main_fabric', name: 'Textured Jacquard Swim', composition: '80% polyamide / 20% elastane', weight_gsm: 230, unit: 'm', notes: 'Woven-in motif — good for tonal florals.' },
  { type: 'main_fabric', name: 'Cotton Crochet', composition: '100% cotton', weight_gsm: 320, unit: 'panel', chlorine_resistant: false, notes: 'Hand or machine crochet. Line fully; sags when wet without stabiliser.' },
  { type: 'main_fabric', name: 'Poly Crochet', composition: '100% polyester', weight_gsm: 280, unit: 'panel', chlorine_resistant: true, notes: 'Holds shape wet far better than cotton crochet.' },

  // Lining & mesh
  { type: 'lining', name: 'Swim Lining — Nude', composition: '85% polyamide / 15% elastane', weight_gsm: 120, unit: 'm', chlorine_resistant: true, colourways: ['nude', 'blush'] },
  { type: 'lining', name: 'Swim Lining — Black', composition: '85% polyamide / 15% elastane', weight_gsm: 120, unit: 'm', chlorine_resistant: true, colourways: ['black'] },
  { type: 'mesh', name: 'Sheer Power Mesh', composition: '80% polyamide / 20% elastane', weight_gsm: 85, unit: 'm', chlorine_resistant: true, notes: 'For sheer panels and lace backing.' },
  { type: 'mesh', name: 'Soft Tulle Mesh', composition: '90% polyamide / 10% elastane', weight_gsm: 45, unit: 'm', notes: 'Overlay layers only — not structural.' },

  // Laces
  { type: 'lace', name: 'Floral Chantilly-Style Stretch Lace', composition: '88% polyamide / 12% elastane', weight_gsm: 110, unit: 'm', notes: 'Fine net ground, corded floral. Signature Goldiesol overlay.' },
  { type: 'lace', name: 'Scalloped Eyelash Lace Trim', composition: '90% polyamide / 10% elastane', unit: 'm', notes: 'Eyelash fringe edge; 25–40 mm width.' },
  { type: 'lace', name: 'Guipure Lace', composition: '100% polyester', weight_gsm: 180, unit: 'm', chlorine_resistant: true, notes: 'No net ground — rigid; place on low-stretch zones or back with mesh.' },
  { type: 'lace', name: 'Geometric Stretch Lace', composition: '86% polyamide / 14% elastane', weight_gsm: 120, unit: 'm' },
  { type: 'lace', name: 'Broderie Anglaise-Look Swim Lace', composition: '82% polyamide / 18% elastane', weight_gsm: 170, unit: 'm', notes: 'Eyelet embroidery look on swim base.' },
  { type: 'lace', name: '3D Flower Appliqué', composition: 'Polyester petals on mesh', unit: 'piece', notes: 'Hand-placed; allow per-piece cost and bartack security.' },

  // Trims & elastics
  { type: 'elastic', name: 'Picot Edge Elastic', composition: 'Polyamide / rubber', unit: 'm', chlorine_resistant: true, notes: '8–10 mm. Delicate decorative edge.' },
  { type: 'elastic', name: 'Swim Elastic (Rubber)', composition: 'Natural rubber', unit: 'm', chlorine_resistant: true, notes: '6 mm for legs, 8–10 mm for bands. Rubber outlasts spandex elastic in chlorine.' },
  { type: 'elastic', name: 'Clear Elastic (TPU)', composition: 'Thermoplastic polyurethane', unit: 'm', notes: 'Shoulder and neckline stabilising.' },
  { type: 'trim', name: 'Scalloped Edge Trim', composition: 'Polyamide / elastane', unit: 'm' },
  { type: 'trim', name: 'Ruffle Trim', composition: 'Self fabric, gathered 1.5×', unit: 'm' },
  { type: 'trim', name: 'Contrast Binding', composition: 'Self or contrast swim fabric, 10 mm finished', unit: 'm' },
  { type: 'trim', name: 'Rouleau Ties', composition: 'Self fabric, 6 mm turned', unit: 'm', notes: 'Tie-side and halter ties; finish ends with knot or bead.' },
  { type: 'trim', name: 'Knotted Ties', composition: 'Self fabric', unit: 'm' },

  // Hardware
  { type: 'hardware', name: 'O-Ring — Gold', composition: 'Zinc alloy, swim-grade gold plating', unit: 'piece', colourways: ['gold'], notes: '15/20/25 mm. Specify salt-spray tested plating.' },
  { type: 'hardware', name: 'O-Ring — Rose Gold', composition: 'Zinc alloy, rose-gold plating', unit: 'piece', colourways: ['rose_gold'] },
  { type: 'hardware', name: 'O-Ring — Tortoise', composition: 'Acetate resin', unit: 'piece', colourways: ['tortoise'] },
  { type: 'hardware', name: 'O-Ring — Clear', composition: 'Acrylic', unit: 'piece', colourways: ['clear'] },
  { type: 'hardware', name: 'Strap Slider', composition: 'Zinc alloy / acetate options', unit: 'piece', colourways: ['gold', 'rose_gold', 'silver', 'tortoise', 'clear'] },
  { type: 'hardware', name: 'Back Clasp', composition: 'Zinc alloy / resin options', unit: 'piece', colourways: ['gold', 'rose_gold', 'pearl', 'tortoise', 'clear'] },
  { type: 'hardware', name: 'Pearl Toggle', composition: 'Shell-coated glass pearl on metal toggle', unit: 'piece', colourways: ['pearl'] },

  // Beads
  { type: 'bead', name: 'Freshwater-Style Pearls', composition: 'Shell-coated glass, 3–8 mm', unit: 'piece', notes: 'Hand-sewn, lock-stitch per bead. Pull test ≥ 50 N.' },
  { type: 'bead', name: 'Glass Seed Beads', composition: 'Glass, size 11/0', unit: 'g', notes: 'Colour-lined beads fade in chlorine — use solid colour or metallic-lined.' },
  { type: 'bead', name: 'Shell Charms', composition: 'Natural shell', unit: 'piece' },
  { type: 'bead', name: 'Crystal Drops', composition: 'Glass crystal, metal bail', unit: 'piece' },
  { type: 'bead', name: 'Bead-End Tie Caps', composition: 'Zinc alloy or wood', unit: 'piece', colourways: ['gold', 'wood', 'pearl'] },

  // Thread, padding, labels
  { type: 'thread', name: 'Textured Nylon Overlock Thread', composition: '100% polyamide (woolly nylon)', unit: 'cone' },
  { type: 'thread', name: 'Polyester Coverstitch Thread', composition: '100% polyester', unit: 'cone' },
  { type: 'padding', name: 'Removable Cup Pads', composition: 'Open-cell foam, fabric-covered', unit: 'pair', notes: 'Triangle and bandeau shapes; specify by size.' },
  { type: 'padding', name: 'Moulded Cups', composition: 'Moulded foam laminate', unit: 'pair' },
  { type: 'label', name: 'Main Label — Goldiesol', composition: 'Satin-weave polyester, champagne on ivory', unit: 'piece' },
  { type: 'label', name: 'Care Label — Swim', composition: 'Printed satin', unit: 'piece', notes: 'Hand wash cold, rinse after chlorine/salt, dry flat in shade.' },
  { type: 'label', name: 'Hygiene Liner', composition: 'Adhesive clear liner', unit: 'piece' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const materials: Material[] = seeds.map((m) => ({
  ...rowMeta(`material:${slug(m.name)}`),
  composition: null,
  weight_gsm: null,
  supplier_id: null,
  swatch_url: null,
  colourways: [],
  price_per_unit: null,
  unit: null,
  chlorine_resistant: null,
  uv_rating: null,
  notes: null,
  ...m,
}));

export const materialByName = (name: string): Material => {
  const m = materials.find((m) => m.name === name);
  if (!m) throw new Error(`Seed material not found: ${name}`);
  return m;
};
