import { Ruler, Shirt } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ComingInPhase } from '@/components/brand/coming-soon';
import { PageHeader } from '@/components/brand/page-header';
import { StatusPill } from '@/components/brand/status-pill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRepository } from '@/lib/data';
import { formatDate, humanise } from '@/lib/utils';

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepository();
  const detail = await repo.getDesign(id);
  if (!detail) notFound();
  const { design, versions, notes } = detail;
  const current = versions.find((v) => v.id === design.current_version_id) ?? versions[0];
  const canvas = current?.canvas;

  return (
    <>
      <PageHeader
        eyebrow={design.category ? humanise(design.category) : 'Design'}
        title={design.name}
        description={<span className="flex flex-wrap items-center gap-2"><StatusPill status={design.status} /> {design.tags.map((t) => <Badge key={t} variant="muted">{t}</Badge>)}</span>}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link href={`/designs/${id}/model`}><Shirt /> Model Mode</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href={`/designs/${id}/techpack`}><Ruler /> Tech Pack</Link></Button>
          </div>
        }
      />

      <ComingInPhase phase={2} title="The editor opens here">
        Front, back and side views generated from the garment parameters below, with fabrics, lace, beading and an AI
        Partner alongside.
      </ComingInPhase>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <p className="gs-label">Current version {current ? `· v${current.version_number}` : ''}</p>
            <CardTitle>Construction</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 text-sm sm:grid-cols-2">
            {canvas?.top && (
              <ParamList title={`Top · ${humanise(canvas.top.params.template)}`} params={canvas.top.params} fillHex={'hex' in canvas.top.fill ? canvas.top.fill.hex : undefined} />
            )}
            {canvas?.bottom && (
              <ParamList title={`Bottom · ${humanise(canvas.bottom.params.template)}`} params={canvas.bottom.params} fillHex={'hex' in canvas.bottom.fill ? canvas.bottom.fill.hex : undefined} />
            )}
            {canvas && canvas.embellishments.length > 0 && (
              <div className="sm:col-span-2">
                <p className="gs-label mb-2">Embellishments</p>
                <ul className="flex flex-col gap-1.5">
                  {canvas.embellishments.map((e) => (
                    <li key={e.id}>
                      <span className="font-medium">{humanise(e.type)}</span>{' '}
                      <span className="text-mist">on {humanise(e.part)} · {humanise(e.path)}{e.widthMm ? ` · ${e.widthMm} mm` : ''}</span>
                      {e.notes && <span className="block text-xs text-mist">{e.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Versions</CardTitle></CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 text-sm">
                {versions.map((v) => (
                  <li key={v.id}>
                    <span className="gs-label block">v{v.version_number} · {formatDate(v.created_at)}</span>
                    {v.change_summary}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Notes &amp; feedback</CardTitle></CardHeader>
            <CardContent>
              {notes.length ? (
                <ul className="flex flex-col gap-3 text-sm">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <span className="gs-label block">{humanise(n.type)}{n.resolved ? ' · resolved' : ''}</span>
                      {n.body}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mist">No notes yet.</p>
              )}
            </CardContent>
          </Card>
          {design.brief && (
            <Card>
              <CardHeader><CardTitle>Brief</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {Object.entries(design.brief).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-mist">{humanise(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ParamList({ title, params, fillHex }: { title: string; params: object; fillHex?: string }) {
  return (
    <div>
      <p className="gs-label mb-2 flex items-center gap-2">
        {fillHex && <span className="inline-block size-3 rounded-full border border-line" style={{ background: fillHex }} />}
        {title}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {Object.entries(params)
          .filter(([k]) => k !== 'template')
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-mist">{humanise(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</dt>
              <dd className="text-right tabular-nums">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : humanise(String(v))}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
