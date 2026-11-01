import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { api, gbp, timeAgo } from '../lib/api.js';
import { Avatar, Empty, ErrorBox, Spinner, Stars, VerifiedBadge } from '../components/ui.jsx';

export default function Profile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const { data, error } = useApi(`/users/${id}`);
  if (error) return <main className="container page"><ErrorBox error={error} /></main>;
  if (!data) return <Spinner />;
  const { user, reviews, portfolio, openJobs } = data;
  const isMe = me?.id === user.id;
  const canMessage = me && !isMe && me.role !== user.role;

  return (
    <main className="container page">
      <div className="layout-side">
        <section className="stack">
          <div className="card">
            <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
              <Avatar name={user.name} color={user.avatarColor} size={76} />
              <div className="grow">
                <div className="row" style={{ gap: 10 }}>
                  <h1 style={{ margin: 0, fontSize: '1.7rem' }}>{user.name}</h1>
                  {user.verified && <VerifiedBadge />}
                  {user.plan !== 'free' && <span className="badge badge-brand">{user.role === 'student' ? 'Premium' : 'Pro client'}</span>}
                </div>
                {user.headline && <p style={{ margin: '4px 0' }}>{user.headline}</p>}
                <div className="small muted">
                  {user.role === 'student'
                    ? [user.course, user.university, user.graduationYear && `Class of ${user.graduationYear}`].filter(Boolean).join(' · ')
                    : [user.company, user.website && <a key="w" href={user.website} target="_blank" rel="noreferrer noopener">{user.website.replace(/^https?:\/\//, '')}</a>].filter(Boolean).reduce((a, b, i) => (i ? [...a, ' · ', b] : [b]), [])}
                  {user.location && ` · ${user.location}`}
                </div>
                <div className="row small" style={{ marginTop: 8 }}>
                  <Stars value={user.rating.average} />
                  {user.rating.count > 0 && <span className="muted">{user.rating.average} ({user.rating.count} review{user.rating.count === 1 ? '' : 's'})</span>}
                  <span className="muted">· {user.completedProjects} project{user.completedProjects === 1 ? '' : 's'} completed</span>
                </div>
              </div>
              {isMe && <Link to="/profile/edit" className="btn btn-secondary btn-sm">Edit profile</Link>}
              {canMessage && (
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  const { conversationId } = await api.post('/conversations', { userId: user.id });
                  navigate(`/messages/${conversationId}`);
                }}>💬 Message</button>
              )}
            </div>
            {user.bio && <p style={{ marginTop: 18, whiteSpace: 'pre-wrap' }}>{user.bio}</p>}
            {user.skills.length > 0 && <div className="chips" style={{ marginTop: 12 }}>{user.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
          </div>

          {user.role === 'student' && (
            <div className="card">
              <h3>Portfolio</h3>
              {portfolio.length === 0 ? <p className="muted small">No portfolio items yet.</p> : (
                <div className="grid grid-2" style={{ gap: 14 }}>
                  {portfolio.map((p) => (
                    <div key={p.id} className="card card-flat" style={{ padding: 16 }}>
                      <div className="row between"><strong>{p.title}</strong>{p.contractId && <span className="badge badge-ok">Collabify project</span>}</div>
                      <p className="small muted" style={{ margin: '6px 0' }}>{p.description}</p>
                      {p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="small">View →</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3>Reviews</h3>
            {reviews.length === 0 ? <Empty icon="⭐" title="No reviews yet" /> : (
              <div className="stack">
                {reviews.map((r) => (
                  <div key={r.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                    <div className="row between"><Stars value={r.rating} /><span className="tiny muted">{timeAgo(r.createdAt)}</span></div>
                    {r.comment && <p className="small" style={{ margin: '6px 0' }}>"{r.comment}"</p>}
                    <div className="tiny muted">{r.reviewerName} · {r.jobTitle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <aside className="stack">
          {openJobs.length > 0 && (
            <div className="card">
              <h4>Open projects</h4>
              <div className="stack">
                {openJobs.map((j) => (
                  <Link key={j.id} to={`/jobs/${j.id}`} className="row between small"><span>{j.title}</span><strong>{gbp(j.budgetPence)}</strong></Link>
                ))}
              </div>
            </div>
          )}
          <div className="card small muted">Member since {new Date(user.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
        </aside>
      </div>
    </main>
  );
}
