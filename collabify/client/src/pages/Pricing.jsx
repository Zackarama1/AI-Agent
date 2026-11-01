import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { api, gbp } from '../lib/api.js';
import { ErrorBox, Spinner } from '../components/ui.jsx';

const ENTREPRENEUR_FEATURES = {
  free: ['Up to 2 active listings', 'Escrow-protected payments', 'Encrypted messaging', 'Ranked applicants'],
  growth: ['Up to 10 active listings', 'Priority placement in search', 'Everything in Starter'],
  scale: ['Unlimited active listings', 'Priority placement in search', 'Everything in Growth'],
};
const STUDENT_FEATURES = {
  free: ['Apply to unlimited projects', 'Escrow-protected pay', 'Auto-built portfolio', '15% fee on completed work'],
  premium: ['Reduced 10% fee on completed work', 'Boosted in talent search', 'Premium profile badge'],
};

function PlanCard({ plan, features, current, onChoose, highlight, busy, cta }) {
  return (
    <div className={`card plan-card ${highlight ? 'featured' : ''}`}>
      {highlight && <span className="badge badge-brand" style={{ position: 'absolute', top: -12, left: 20 }}>Most popular</span>}
      <h3>{plan.name}</h3>
      <div className="price">{plan.pricePence ? gbp(plan.pricePence) : 'Free'}{plan.pricePence > 0 && <small> /month</small>}</div>
      <ul>{features.map((f) => <li key={f}>{f}</li>)}</ul>
      {current ? (
        <button className="btn btn-secondary btn-block" disabled>Current plan</button>
      ) : onChoose ? (
        <button className={`btn ${highlight ? 'btn-primary' : 'btn-secondary'} btn-block`} disabled={busy} onClick={onChoose}>{cta}</button>
      ) : (
        <Link to="/signup" className={`btn ${highlight ? 'btn-primary' : 'btn-secondary'} btn-block`}>Get started</Link>
      )}
    </div>
  );
}

export default function Pricing() {
  const { user, setUser } = useAuth();
  const { data } = useApi('/billing/plans');
  const [tab, setTab] = useState(user?.role === 'student' ? 'student' : 'entrepreneur');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!data) return <Spinner />;
  const choose = (planId, label) => async () => {
    if (!confirm(`Switch to ${label}?`)) return;
    setBusy(true);
    setError(null);
    try {
      setUser((await api.post('/billing/subscribe', { plan: planId })).user);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const canChoose = (role) => user && user.role === role;

  return (
    <main className="container page">
      <div className="center" style={{ marginBottom: 32 }}>
        <h1>Simple, fair pricing</h1>
        <p className="muted" style={{ maxWidth: 560, margin: '0 auto 20px' }}>
          Joining is free. Collabify takes a flat {Math.round(data.commissionRate * 100)}% commission only when a project is completed and paid,
          well below typical freelance marketplaces.
        </p>
        <div className="tabs" style={{ margin: '0 auto' }}>
          <button className={tab === 'entrepreneur' ? 'active' : ''} onClick={() => setTab('entrepreneur')}>For entrepreneurs</button>
          <button className={tab === 'student' ? 'active' : ''} onClick={() => setTab('student')}>For students</button>
        </div>
      </div>
      <ErrorBox error={error} />
      {tab === 'entrepreneur' ? (
        <>
          <div className="grid grid-3" style={{ marginTop: 16 }}>
            {data.entrepreneur.map((p) => (
              <PlanCard key={p.id} plan={p} features={ENTREPRENEUR_FEATURES[p.id]} highlight={p.id === 'growth'} busy={busy}
                current={user?.role === 'entrepreneur' && user.plan === p.id}
                onChoose={canChoose('entrepreneur') ? choose(p.id, p.name) : null}
                cta={p.pricePence ? `Upgrade to ${p.name}` : 'Downgrade'} />
            ))}
          </div>
          <div className="card card-flat center" style={{ marginTop: 24 }}>
            <strong>★ Featured listings: {gbp(data.featuredListing.feePence, { decimals: 2 })}</strong>
            <span className="muted"> · Pin any project to the top of search for {data.featuredListing.days} days. Available from your job page.</span>
          </div>
        </>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 16, maxWidth: 760, marginInline: 'auto' }}>
          {data.student.map((p) => (
            <PlanCard key={p.id} plan={p} features={STUDENT_FEATURES[p.id]} highlight={p.id === 'premium'} busy={busy}
              current={user?.role === 'student' && user.plan === p.id}
              onChoose={canChoose('student') ? choose(p.id, p.name) : null}
              cta={p.pricePence ? 'Go Premium' : 'Switch to free'} />
          ))}
        </div>
      )}
      <p className="center tiny muted" style={{ marginTop: 24 }}>Prices in GBP. Subscriptions renew monthly and can be cancelled any time.</p>
    </main>
  );
}
