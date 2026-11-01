import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { api, gbp } from '../lib/api.js';
import { Empty, ErrorBox, Spinner } from '../components/ui.jsx';

const LABELS = { platform_commission: 'Commission', subscription: 'Subscriptions', featured_listing_fee: 'Featured listings' };

export default function Admin() {
  const { data, reload } = useApi('/stats/admin');
  const { data: pub } = useApi('/stats/public');
  const [error, setError] = useState(null);
  if (!data || !pub) return <Spinner />;
  const total = data.revenue.reduce((s, r) => s + r.totalPence, 0);
  const resolve = async (id, outcome) => {
    if (!confirm(`${outcome === 'release' ? 'Release funds to the student' : 'Refund the client'} for contract #${id}?`)) return;
    try {
      await api.post(`/contracts/${id}/resolve`, { outcome });
      reload();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <main className="container page stack">
      <h1>Platform admin</h1>
      <div className="grid grid-4">
        <div className="card stat"><div className="label">Total revenue</div><div className="value">{gbp(total)}</div></div>
        <div className="card stat"><div className="label">Held in escrow</div><div className="value">{gbp(data.escrowHeldPence)}</div></div>
        <div className="card stat"><div className="label">Verified students</div><div className="value">{pub.verifiedStudents}</div></div>
        <div className="card stat"><div className="label">Entrepreneurs</div><div className="value">{pub.entrepreneurs}</div></div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h3>Revenue by stream</h3>
          {data.revenue.length === 0 ? <p className="muted small">No revenue yet.</p> : data.revenue.map((r) => (
            <div key={r.kind} className="money-row"><span>{LABELS[r.kind] || r.kind} <span className="muted tiny">({r.count})</span></span><strong>{gbp(r.totalPence, { decimals: 2 })}</strong></div>
          ))}
        </div>
        <div className="card">
          <h3>Open disputes</h3>
          <ErrorBox error={error} />
          {data.disputes.length === 0 ? <Empty icon="✅" title="No open disputes" /> : data.disputes.map((d) => (
            <div key={d.id} className="card card-flat" style={{ padding: 14, marginBottom: 10 }}>
              <div className="row between"><Link to={`/contracts/${d.id}`}><strong>{d.jobTitle}</strong></Link><span>{gbp(d.amountPence)}</span></div>
              <p className="small muted" style={{ margin: '6px 0 10px' }}>"{d.reason}"</p>
              <div className="row">
                <button className="btn btn-ok btn-sm" onClick={() => resolve(d.id, 'release')}>Release to student</button>
                <button className="btn btn-danger btn-sm" onClick={() => resolve(d.id, 'refund')}>Refund client</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
