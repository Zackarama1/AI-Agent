import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { gbp, timeAgo } from '../lib/api.js';
import { Empty, ErrorBox, MatchScore, Spinner } from '../components/ui.jsx';

export function JobCard({ job }) {
  return (
    <Link to={`/jobs/${job.id}`} className="card card-link">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            {job.featured && <span className="badge badge-brand">★ Featured</span>}
            <span className="badge">{job.category}</span>
          </div>
          <h3 style={{ margin: '6px 0 4px' }}>{job.title}</h3>
          <div className="small muted">
            {job.owner?.company || job.owner?.name} · {job.duration || 'Flexible timeline'} · {timeAgo(job.createdAt)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{gbp(job.budgetPence)}</div>
          <div className="tiny muted">fixed price</div>
        </div>
      </div>
      <p className="small muted" style={{ margin: '10px 0' }}>
        {job.description.length > 180 ? `${job.description.slice(0, 180)}…` : job.description}
      </p>
      <div className="row between">
        <div className="chips">{job.skills.slice(0, 6).map((s) => <span key={s} className="chip">{s}</span>)}</div>
        <div className="row">
          <MatchScore score={job.matchScore} />
          <span className="tiny muted">{job.applicationCount} applicant{job.applicationCount === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const { data: meta } = useApi('/jobs/meta');
  const { data, error, loading } = useApi(`/jobs?${params.toString()}`);

  useEffect(() => {
    setQ(params.get('q') || '');
  }, [params]);
  const update = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next);
  };

  return (
    <main className="container page">
      <h1>Find remote projects</h1>
      <p className="muted">Paid, escrow-protected work from startups and entrepreneurs.</p>
      <form className="card card-flat row" style={{ marginBottom: 20, padding: 14 }} onSubmit={(e) => { e.preventDefault(); update('q', q); }}>
        <input className="grow" style={{ minWidth: 200, flex: 2 }} placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ flex: 1, minWidth: 160 }} value={params.get('category') || ''} onChange={(e) => update('category', e.target.value)}>
          <option value="">All categories</option>
          {meta?.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select style={{ flex: 1, minWidth: 140 }} value={params.get('minBudget') || ''} onChange={(e) => update('minBudget', e.target.value)}>
          <option value="">Any budget</option>
          <option value="100">£100+</option>
          <option value="250">£250+</option>
          <option value="500">£500+</option>
          <option value="1000">£1,000+</option>
        </select>
        <select style={{ flex: 1, minWidth: 140 }} value={params.get('sort') || ''} onChange={(e) => update('sort', e.target.value)}>
          <option value="">Newest</option>
          <option value="budget">Highest budget</option>
        </select>
        <button className="btn btn-primary">Search</button>
      </form>
      {params.get('skill') && (
        <p className="small">Skill: <span className="chip">{params.get('skill')}</span> <button className="btn btn-ghost btn-sm" onClick={() => update('skill', '')}>clear</button></p>
      )}
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data?.jobs.length === 0 ? (
        <div className="card"><Empty icon="🔍" title="No projects match your filters">Try a broader search.</Empty></div>
      ) : (
        <div className="stack">{data?.jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>
      )}
    </main>
  );
}
