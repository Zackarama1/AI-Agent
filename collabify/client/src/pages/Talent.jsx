import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { Avatar, Empty, Spinner, Stars, VerifiedBadge } from '../components/ui.jsx';

export default function Talent() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data } = useApi(`/users/talent?q=${encodeURIComponent(query)}`);
  return (
    <main className="container page">
      <h1>Verified student talent</h1>
      <p className="muted">Every student here has confirmed their university email.</p>
      <form className="card card-flat row" style={{ padding: 14, marginBottom: 20 }} onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
        <input className="grow" placeholder="Search by name, university, course or headline…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary">Search</button>
      </form>
      {!data ? <Spinner /> : data.students.length === 0 ? <div className="card"><Empty icon="🎓" title="No students found" /></div> : (
        <div className="grid grid-3">
          {data.students.map((s) => (
            <Link key={s.id} to={`/users/${s.id}`} className="card card-link">
              <div className="row">
                <Avatar name={s.name} color={s.avatarColor} size={48} />
                <div style={{ minWidth: 0 }}>
                  <strong>{s.name}</strong>
                  <div className="tiny muted">{s.university}</div>
                </div>
              </div>
              {s.headline && <p className="small" style={{ margin: '12px 0 8px' }}>{s.headline}</p>}
              <div className="row small" style={{ gap: 8, margin: '8px 0' }}>
                <VerifiedBadge />
                {s.plan === 'premium' && <span className="badge badge-brand">Premium</span>}
              </div>
              <div className="row small"><Stars value={s.rating.average} /><span className="muted tiny">{s.completedProjects} completed</span></div>
              <div className="chips" style={{ marginTop: 10 }}>{s.skills.slice(0, 5).map((k) => <span key={k} className="chip">{k}</span>)}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
