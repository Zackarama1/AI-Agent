import type { BrandDna, Collection, SizeChartRow } from '../types';
import { rowMeta } from './ids';

export const brandDna: BrandDna = {
  ...rowMeta('brand-dna'),
  mission:
    'Goldiesol is building the global benchmark for feminine, delicate, intricately detailed, high-quality swimwear. ' +
    'We win on finer detail — lace, beading, delicate trims, considered hardware — and on a better fit.',
  aesthetic_keywords: [
    'feminine', 'delicate', 'intricate', 'romantic', 'premium', 'confident', 'sun-kissed', 'lace-led',
    'heirloom detail', 'soft sheen',
  ],
  never_do: [
    'No heavy or oversized logos',
    'No neon or fluorescent colours',
    'No cheap-looking plastic hardware',
    'No beading that cannot pass a pull test',
    'No reproducing another brand\'s signature design',
    'No lace without swim-grade stretch recovery',
  ],
  target_customer:
    'Women 20–38 who travel for the sun — beach clubs, yachts, honeymoons — and buy fewer, better pieces. ' +
    'Follows influencer-led labels but wants something more refined and more detailed.',
  price_positioning:
    'Premium accessible: above influencer-led labels, below luxury houses. Detail and fit justify the step up.',
  reference_brands: ['Frankies Bikinis', 'Kulani Kinis'],
};

export const collections: Collection[] = [
  {
    ...rowMeta('collection:lace-edit'),
    name: 'The Lace Edit',
    season: 'Resort 27',
    description: 'Goldiesol\'s founding drop — blush, ivory and champagne pieces finished in swim-grade lace.',
    cover_url: null,
    archived: false,
  },
];

// Body measurements (cm) for the base size chart. Model Mode grades garments from these.
const sizes: [label: string, bust: number, underbust: number, waist: number, hip: number, torso: number, cup: string][] = [
  ['XS', 80, 66, 62, 87, 148, 'A–B'],
  ['S', 84, 70, 66, 91, 152, 'B–C'],
  ['M', 88, 74, 70, 95, 156, 'B–C'],
  ['L', 93, 79, 75, 100, 160, 'C–D'],
  ['XL', 98, 84, 80, 105, 164, 'C–D'],
];

export const sizeChart: SizeChartRow[] = sizes.map(([size_label, bust_cm, underbust_cm, waist_cm, hip_cm, torso_cm, cup], i) => ({
  ...rowMeta(`size:${size_label}`),
  size_label,
  sort_order: i,
  bust_cm,
  underbust_cm,
  waist_cm,
  hip_cm,
  torso_cm,
  cup,
}));
