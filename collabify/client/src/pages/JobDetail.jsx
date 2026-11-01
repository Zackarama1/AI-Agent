import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { api, gbp, timeAgo } from '../lib/api.js';
import { Avatar, Empty, ErrorBox, MatchScore, Spinner, Stars, StatusBadge, VerifiedBadge } from '../components/ui.jsx';

function ApplyForm({ job, onDone }) {
  const { user } = useAuth();
  const feeRate = user.plan === 'premium' ? 0.1 : 0.15;
  const [form, setForm] = useState({ coverLetter: '', proposed: (job.budgetPence / 100).toString() });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const proposedPence = Math.round(Number(form.proposed) * 100) || 0;
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api.post(`/jobs/${job.id}/applications`, { coverLetter: form.coverLetter, proposedPence });
          onDone();
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Apply for this project</h3>
      <div className="field">
        <label htmlFor="cl">Why are you a great fit?</label>
        <textarea id="cl" required minLength={30} value={form.coverLetter} onChange={(e) => setForm({ ...form, coverLetter: e.target.value })} placeholder="Relevant experience, coursework, links to past work, and how you'd approach it…" />
      </div>
      <div className="field">
        <label htmlFor="pp">Your price (£)</label>
        <input id="pp" type="number" min="10" step="1" required value={form.proposed} onChange={(e) => setForm({ ...form, proposed: e.target.value })} />
        <div className="hint">You'll receive {gbp(proposedPence - Math.round(proposedPence * feeRate))} after the {feeRate * 100}% platform fee.</div>
      </div>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy}>Submit application</button>
    </form>
  );
}

function Applicants({ applications, job, reload }) {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const act = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    }
  };
  const message = (userId) =>
    act(async () => {
      const { conversationId } = await api.post('/conversations', { userId, jobId: job.id });
      navigate(`/messages/${conversationId}`);
    });

  if (!applications.length) return <div className="card"><Empty icon="📬" title="No applications yet">Featured listings get seen first.</Empty></div>;
  return (
    <div className="stack">
      <ErrorBox error={error} />
      {applications.map((a) => (
        <div key={a.id} className="card">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="row">
              <Avatar name={a.student.name} color={a.student.avatarColor} size={44} />
              <div>
                <Link to={`/users/${a.student.id}`}><strong>{a.student.name}</strong></Link>
                <div className="small muted">{[a.student.course, a.student.university].filter(Boolean).join(' · ')}</div>
                <div className="row small" style={{ gap: 8, marginTop: 2 }}>
                  {a.student.verified && <VerifiedBadge />}
                  <Stars value={a.student.rating.average} />
                  <span className="muted tiny">{a.student.completedProjects} completed</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800 }}>{gbp(a.proposedPence)}</div>
              <MatchScore score={a.matchScore} />
            </div>
          </div>
          <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '12px 0' }}>{a.coverLetter}</p>
          <div className="chips" style={{ marginBottom: 12 }}>{a.student.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
          <div className="row between">
            <span className="tiny muted">Applied {timeAgo(a.createdAt)}</span>
            <div className="row">
              <StatusBadge status={a.status} />
              <button className="btn btn-secondary btn-sm" onClick={() => message(a.student.id)}>💬 Message</button>
              {a.status === 'pending' && job.status === 'open' && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => act(async () => { await api.post(`/applications/${a.id}/reject`); reload(); })}>Decline</button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      act(async () => {
                        if (!confirm(`Hire ${a.student.name} for ${gbp(a.proposedPence)}? You'll fund escrow next.`)) return;
                        const { contractId } = await api.post(`/applications/${a.id}/accept`);
                        navigate(`/contracts/${contractId}`);
                      })
                    }
                  >
                    Hire
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/jobs/${id}`);
  const [actionError, setActionError] = useState(null);
  if (loading && !data) return <Spinner />;
  if (error) return <main className="container page"><ErrorBox error={error} /></main>;
  const { job, applications, myApplication, contractId } = data;
  const isOwner = user?.id === job.owner.id;

  const act = async (fn) => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e);
    }
  };

  return (
    <main className="container page">
      <Link to={isOwner ? '/dashboard' : '/jobs'} className="small">← Back</Link>
      <div className="layout-side" style={{ marginTop: 14 }}>
        <section className="stack">
          <div className="card">
            <div className="row" style={{ gap: 8 }}>
              {job.featured && <span className="badge badge-brand">★ Featured</span>}
              <span className="badge">{job.category}</span>
              <StatusBadge status={job.status} />
            </div>
            <h1 style={{ margin: '12px 0 6px', fontSize: '1.8rem' }}>{job.title}</h1>
            <div className="muted small">Posted {timeAgo(job.createdAt)} · {job.applicationCount} applicant{job.applicationCount === 1 ? '' : 's'}</div>
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
            <p style={{ whiteSpace: 'pre-wrap' }}>{job.description}</p>
            <h4>Skills</h4>
            <div className="chips">{job.skills.map((s) => <Link key={s} to={`/jobs?skill=${encodeURIComponent(s)}`} className="chip">{s}</Link>)}</div>
          </div>
          <ErrorBox error={actionError} />
          {isOwner && (
            <>
              <div className="section-title" style={{ marginTop: 10 }}>
                <h2>Applicants</h2>
                <span className="small muted">Sorted by match score</span>
              </div>
              <Applicants applications={applications} job={job} reload={reload} />
            </>
          )}
        </section>
        <aside className="stack">
          <div className="card">
            <div className="label tiny muted">FIXED BUDGET</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{gbp(job.budgetPence)}</div>
            <div className="small muted">{job.duration || 'Flexible timeline'}</div>
            {job.matchScore != null && <div style={{ marginTop: 10 }}><MatchScore score={job.matchScore} /></div>}
            <div className="alert alert-ok small" style={{ marginTop: 14 }}>🔒 Payment is held in escrow before work starts.</div>
            {contractId && <Link to={`/contracts/${contractId}`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}>View contract</Link>}
            {isOwner && job.status === 'open' && (
              <div className="stack" style={{ marginTop: 12 }}>
                {!job.featured && (
                  <button className="btn btn-secondary btn-block" onClick={() => act(async () => {
                    if (!confirm('Feature this listing for 7 days for £9.99?')) return;
                    await api.post(`/jobs/${job.id}/feature`); reload();
                  })}>★ Feature for £9.99</button>
                )}
                <button className="btn btn-ghost btn-block" onClick={() => act(async () => { await api.patch(`/jobs/${job.id}`, { status: 'closed' }); reload(); })}>Close listing</button>
              </div>
            )}
            {isOwner && job.status === 'closed' && (
              <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={() => act(async () => { await api.patch(`/jobs/${job.id}`, { status: 'open' }); reload(); })}>Reopen listing</button>
            )}
          </div>
          <div className="card">
            <h4>About the client</h4>
            <div className="row">
              <Avatar name={job.owner.name} color={job.owner.avatarColor} />
              <div>
                <Link to={`/users/${job.owner.id}`}><strong>{job.owner.name}</strong></Link>
                {job.owner.company && <div className="small muted">{job.owner.company}</div>}
              </div>
            </div>
            {user?.role === 'student' && (
              <button className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 14 }} onClick={() => act(async () => {
                const { conversationId } = await api.post('/conversations', { userId: job.owner.id, jobId: job.id });
                navigate(`/messages/${conversationId}`);
              })}>💬 Ask a question</button>
            )}
          </div>
          {!user && job.status === 'open' && (
            <div className="card center">
              <p className="small">Are you a university student?</p>
              <Link to="/signup?role=student" className="btn btn-primary btn-block">Join to apply</Link>
            </div>
          )}
          {user?.role === 'student' && job.status === 'open' && !user.verified && (
            <div className="alert alert-warn small">Verify your university email to apply. <Link to="/verify">Verify now →</Link></div>
          )}
          {user?.role === 'student' && myApplication && myApplication.status !== 'withdrawn' && (
            <div className="card">
              <div className="row between"><strong>Your application</strong><StatusBadge status={myApplication.status} /></div>
              <div className="small muted" style={{ margin: '6px 0 10px' }}>Proposed {gbp(myApplication.proposedPence)}</div>
              {myApplication.status === 'pending' && (
                <button className="btn btn-ghost btn-sm" onClick={() => act(async () => { await api.post(`/applications/${myApplication.id}/withdraw`); reload(); })}>Withdraw</button>
              )}
            </div>
          )}
          {user?.role === 'student' && user.verified && job.status === 'open' && (!myApplication || myApplication.status === 'withdrawn') && (
            <ApplyForm job={job} onDone={reload} />
          )}
        </aside>
      </div>
    </main>
  );
}
