import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { gbp, timeAgo } from '../lib/api.js';
import { Empty, Spinner, StatusBadge } from '../components/ui.jsx';
import { JobCard } from './Jobs.jsx';

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function ContractsList({ contracts, role }) {
  if (!contracts) return <Spinner />;
  const active = contracts.filter((c) => !['released', 'refunded', 'cancelled'].includes(c.status));
  if (!active.length) return <Empty icon="📄" title="No active contracts" />;
  return (
    <div className="stack">
      {active.map((c) => (
        <Link key={c.id} to={`/contracts/${c.id}`} className="card card-flat card-link">
          <div className="row between">
            <strong>{c.job.title}</strong>
            <StatusBadge status={c.status} />
          </div>
          <div className="small muted">
            {role === 'student' ? `with ${c.entrepreneur.name}` : `with ${c.student.name}`} · {gbp(role === 'student' ? c.payoutPence : c.amountPence)}
          </div>
        </Link>
      ))}
    </div>
  );
}

function StudentDashboard({ user }) {
  const { data: summary } = useApi('/billing/summary');
  const { data: rec } = useApi(user.verified ? '/jobs/recommended' : null);
  const { data: apps } = useApi('/applications/mine');
  const { data: contracts } = useApi('/contracts');
  const s = summary?.summary;

  return (
    <>
      {!user.verified && (
        <div className="alert alert-warn row between">
          <span><strong>Verify your student status</strong> to start applying for projects. It takes about a minute.</span>
          <Link to="/verify" className="btn btn-primary btn-sm">Verify now</Link>
        </div>
      )}
      {user.verified && user.skills.length === 0 && (
        <div className="alert alert-info row between">
          <span>Add your skills to get better job matches.</span>
          <Link to="/profile/edit" className="btn btn-secondary btn-sm">Add skills</Link>
        </div>
      )}
      <div className="grid grid-4">
        <Stat label="Total earned" value={gbp(s?.earned)} />
        <Stat label="In escrow" value={gbp(s?.inEscrow)} />
        <Stat label="Active projects" value={s?.active ?? '–'} />
        <Stat label="Completed" value={s?.completed ?? '–'} />
      </div>
      <div className="layout-side">
        <section>
          <div className="section-title">
            <h2>Recommended for you</h2>
            <Link to="/jobs" className="small">Browse all →</Link>
          </div>
          {!user.verified ? (
            <Empty icon="🎓" title="Verify to see matched projects" />
          ) : !rec ? (
            <Spinner />
          ) : rec.jobs.length === 0 ? (
            <Empty icon="🔍" title="No new matches right now">Check back soon, new projects are posted daily.</Empty>
          ) : (
            <div className="stack">{rec.jobs.slice(0, 6).map((j) => <JobCard key={j.id} job={j} />)}</div>
          )}
        </section>
        <aside className="stack">
          <div className="card">
            <h3>Active contracts</h3>
            <ContractsList contracts={contracts?.contracts} role="student" />
          </div>
          <div className="card">
            <h3>My applications</h3>
            {!apps ? <Spinner /> : apps.applications.length === 0 ? <p className="muted small">No applications yet.</p> : (
              <div className="stack">
                {apps.applications.slice(0, 8).map((a) => (
                  <div key={a.id} className="row between small">
                    <Link to={a.contractId ? `/contracts/${a.contractId}` : `/jobs/${a.jobId}`} className="grow">{a.jobTitle}</Link>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function EntrepreneurDashboard() {
  const { data: summary } = useApi('/billing/summary');
  const { data: jobs } = useApi('/jobs/mine');
  const { data: contracts } = useApi('/contracts');
  const s = summary?.summary;
  return (
    <>
      <div className="grid grid-4">
        <Stat label="Total spent" value={gbp(s?.spent)} />
        <Stat label="Held in escrow" value={gbp(s?.inEscrow)} />
        <Stat label="Active projects" value={s?.active ?? '–'} />
        <Stat label="Completed" value={s?.completed ?? '–'} />
      </div>
      <div className="layout-side">
        <section>
          <div className="section-title">
            <h2>Your job posts</h2>
            <Link to="/jobs/new" className="btn btn-primary btn-sm">+ Post a job</Link>
          </div>
          {!jobs ? <Spinner /> : jobs.jobs.length === 0 ? (
            <div className="card"><Empty icon="🚀" title="Post your first project">Students apply within hours. You only pay for work you approve.</Empty></div>
          ) : (
            <div className="stack">
              {jobs.jobs.map((j) => (
                <Link key={j.id} to={`/jobs/${j.id}`} className="card card-link">
                  <div className="row between">
                    <strong>{j.title}</strong>
                    <span className="row">
                      {j.featured && <span className="badge badge-brand">★ Featured</span>}
                      <StatusBadge status={j.status} />
                    </span>
                  </div>
                  <div className="small muted">
                    {gbp(j.budgetPence)} · {j.applicationCount} applicant{j.applicationCount === 1 ? '' : 's'} · posted {timeAgo(j.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside className="stack">
          <div className="card">
            <h3>Active contracts</h3>
            <ContractsList contracts={contracts?.contracts} role="entrepreneur" />
          </div>
          <div className="card">
            <h3>Find talent faster</h3>
            <p className="small muted">Upgrade for priority placement and more active listings, or browse verified students directly.</p>
            <div className="row">
              <Link to="/talent" className="btn btn-secondary btn-sm">Browse students</Link>
              <Link to="/pricing" className="btn btn-ghost btn-sm">See plans</Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <main className="container page stack">
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 4 }}>Hi {user.name.split(' ')[0]} 👋</h1>
          <p className="muted" style={{ margin: 0 }}>
            {user.role === 'student' ? 'Here is what is happening with your projects.' : 'Here is an overview of your hiring.'}
          </p>
        </div>
        <Link to="/profile/edit" className="btn btn-secondary btn-sm">Edit profile</Link>
      </div>
      {user.role === 'student' ? <StudentDashboard user={user} /> : <EntrepreneurDashboard />}
    </main>
  );
}
