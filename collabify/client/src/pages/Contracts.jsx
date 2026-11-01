import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { gbp, timeAgo } from '../lib/api.js';
import { Avatar, Empty, Spinner, StatusBadge } from '../components/ui.jsx';

export default function Contracts() {
  const { user } = useAuth();
  const { data } = useApi('/contracts');
  return (
    <main className="container page">
      <h1>Contracts</h1>
      <p className="muted">Every contract is protected by escrow from funding to release.</p>
      {!data ? <Spinner /> : data.contracts.length === 0 ? (
        <div className="card">
          <Empty icon="📄" title="No contracts yet">
            {user.role === 'student' ? <Link to="/jobs">Find a project to apply for →</Link> : <Link to="/jobs/new">Post a project to start hiring →</Link>}
          </Empty>
        </div>
      ) : (
        <div className="stack">
          {data.contracts.map((c) => {
            const other = user.id === c.student.id ? c.entrepreneur : c.student;
            return (
              <Link key={c.id} to={`/contracts/${c.id}`} className="card card-link row between">
                <div className="row">
                  <Avatar name={other.name} color={other.avatarColor} />
                  <div>
                    <strong>{c.job.title}</strong>
                    <div className="small muted">with {other.name} · updated {timeAgo(c.updatedAt)}</div>
                  </div>
                </div>
                <div className="row">
                  <strong>{gbp(user.role === 'student' ? c.payoutPence : c.amountPence)}</strong>
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
