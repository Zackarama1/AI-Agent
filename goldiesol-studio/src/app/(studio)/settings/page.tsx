import { PageHeader, SectionTitle } from '@/components/brand/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRepository } from '@/lib/data';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic'; // integration status reflects the runtime environment

// Shows only whether each integration is configured — never the values.
const INTEGRATIONS: [label: string, envs: string[]][] = [
  ['Supabase', ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']],
  ['Claude (AI Partner)', ['ANTHROPIC_API_KEY']],
  ['Voyage (embeddings)', ['VOYAGE_API_KEY']],
  ['Trends provider', ['TRENDS_API_URL']],
  ['Image generation', ['IMAGE_GEN_API_KEY']],
];

export default async function SettingsPage() {
  const repo = await getRepository();
  const [dna, sizes] = await Promise.all([repo.getBrandDna(), repo.listSizeChart()]);

  return (
    <>
      <PageHeader eyebrow="Studio" title="Settings" description="Brand DNA, size chart and integrations." />

      {dna && (
        <section className="mb-10">
          <SectionTitle>Brand DNA</SectionTitle>
          <Card>
            <CardContent className="grid gap-6 pt-5 text-sm md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="gs-label mb-1">Mission</p>
                <p className="font-display text-xl leading-snug">{dna.mission}</p>
              </div>
              <div>
                <p className="gs-label mb-2">Aesthetic</p>
                <div className="flex flex-wrap gap-1.5">{dna.aesthetic_keywords.map((k) => <Badge key={k} variant="rose">{k}</Badge>)}</div>
              </div>
              <div>
                <p className="gs-label mb-2">Never</p>
                <ul className="list-inside list-disc text-mist">{dna.never_do.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <div>
                <p className="gs-label mb-1">Customer</p>
                <p>{dna.target_customer}</p>
              </div>
              <div>
                <p className="gs-label mb-1">Price positioning</p>
                <p>{dna.price_positioning}</p>
              </div>
              <div className="md:col-span-2">
                <p className="gs-label mb-1">Benchmarks (positioning only — never designs to copy)</p>
                <p>{dna.reference_brands.join(' · ')}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mb-10">
        <SectionTitle>Size chart</SectionTitle>
        <div className="overflow-x-auto rounded-[var(--radius-gs)] border border-line bg-surface">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                {['Size', 'Bust', 'Underbust', 'Waist', 'Hip', 'Torso', 'Cup'].map((h) => (
                  <th key={h} className="gs-label px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-display text-lg">{s.size_label}</td>
                  {[s.bust_cm, s.underbust_cm, s.waist_cm, s.hip_cm, s.torso_cm].map((v, i) => (
                    <td key={i} className="px-4 py-2.5 tabular-nums">{v} cm</td>
                  ))}
                  <td className="px-4 py-2.5">{s.cup}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-mist">Body measurements. Default grading: ±2 cm bust, waist and hip per size step; cup heights scale proportionally.</p>
      </section>

      <section>
        <SectionTitle>Integrations</SectionTitle>
        <Card>
          <CardHeader><CardTitle className="text-lg">Connected services</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-line text-sm">
              {INTEGRATIONS.map(([label, envs]) => {
                const on = envs.every((e) => Boolean(process.env[e]));
                return (
                  <li key={label} className="flex items-center justify-between py-2.5">
                    {label}
                    {on ? <Badge variant="gold">Connected</Badge> : <Badge variant="muted">Not connected</Badge>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-mist">Keys live in environment variables (see <code>.env.example</code>), never in the database.</p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
