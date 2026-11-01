import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { api, gbp, timeAgo } from '../lib/api.js';
import { Avatar, ErrorBox, Spinner, StatusBadge } from '../components/ui.jsx';

const STEPS = [
  ['awaiting_funding', 'Hired'],
  ['funded', 'Escrow funded'],
  ['submitted', 'Work submitted'],
  ['released', 'Paid'],
];
const LEDGER_LABEL = {
  escrow_deposit: 'Escrow deposit',
  payout: 'Paid to student',
  platform_commission: 'Platform fee',
  escrow_refund: 'Refunded to client',
};

function Timeline({ status }) {
  const order = STEPS.map(([s]) => s);
  const idx = status === 'disputed' ? 2 : order.indexOf(status);
  return (
    <div className="timeline">
      {STEPS.map(([key, label], i) => (
        <div key={key} className={`step ${i <= idx ? 'done' : ''} ${i === idx + 1 ? 'current' : ''}`}>
          <div className="dot">{i <= idx ? '✓' : i + 1}</div>
          {label}
        </div>
      ))}
    </div>
  );
}

function ReviewForm({ contract, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.post(`/contracts/${contract.id}/reviews`, { rating, comment });
          onDone();
        } catch (err) {
          setError(err);
        }
      }}
    >
      <h3>Leave a review</h3>
      <div className="star-input" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} stars`}>★</button>
        ))}
      </div>
      <div className="field">
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was it working together?" style={{ minHeight: 90 }} />
      </div>
      <ErrorBox error={error} />
      <button className="btn btn-primary" style={{ marginTop: 8 }}>Submit review</button>
    </form>
  );
}

export default function ContractDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, reload } = useApi(`/contracts/${id}`);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (error) return <main className="container page"><ErrorBox error={error} /></main>;
  if (!data) return <Spinner />;
  const { contract: c, ledger } = data;
  const isStudent = user.id === c.student.id;
  const isClient = user.id === c.entrepreneur.id;
  const other = isStudent ? c.entrepreneur : c.student;

  const act = async (path, body, confirmText) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/contracts/${c.id}/${path}`, body);
      await reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    const { conversationId } = await api.post('/conversations', { userId: other.id, jobId: c.job.id });
    navigate(`/messages/${conversationId}`);
  };

  return (
    <main className="container page">
      <Link to="/contracts" className="small">← All contracts</Link>
      <div className="layout-side" style={{ marginTop: 14 }}>
        <section className="stack">
          <div className="card">
            <div className="row between">
              <h1 style={{ fontSize: '1.5rem', margin: 0 }}><Link to={`/jobs/${c.job.id}`} style={{ color: 'inherit' }}>{c.job.title}</Link></h1>
              <StatusBadge status={c.status} />
            </div>
            <p className="small muted">Contract #{c.id} · started {timeAgo(c.createdAt)}</p>
            {['cancelled', 'refunded'].includes(c.status) ? null : <Timeline status={c.status} />}
          </div>

          <ErrorBox error={actionError} />

          {c.status === 'awaiting_funding' && isClient && (
            <div className="card">
              <h3>Fund escrow to start the project</h3>
              <p className="small muted">
                {gbp(c.amountPence)} will be held securely. {c.student.name} is notified to begin, and the money is only released when you approve the work.
              </p>
              <div className="row">
                <button className="btn btn-primary" disabled={busy} onClick={() => act('fund')}>🔒 Fund {gbp(c.amountPence)}</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => act('cancel', {}, 'Cancel this contract and reopen the job?')}>Cancel</button>
              </div>
              {c.provider === 'mock' && <p className="tiny muted" style={{ marginTop: 10 }}>Demo payments mode: no real card is charged.</p>}
            </div>
          )}
          {c.status === 'awaiting_funding' && isStudent && (
            <div className="alert alert-info">You're hired! Waiting for {c.entrepreneur.name} to fund escrow. Don't start work until it's funded.</div>
          )}

          {c.status === 'funded' && isStudent && (
            <div className="card">
              <h3>Submit your work</h3>
              <p className="small muted">Escrow is funded. When you're done, share links to your deliverables and a summary.</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Links to files, repo, designs… and a summary of what you delivered." />
              <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy || note.trim().length < 5} onClick={() => act('submit', { note })}>Submit for review</button>
            </div>
          )}
          {c.status === 'funded' && isClient && (
            <div className="alert alert-info">Escrow funded. {c.student.name} is working on it. You can release payment early if the work is already done.</div>
          )}

          {c.submissionNote && (
            <div className="card">
              <h3>Submitted work</h3>
              <p style={{ whiteSpace: 'pre-wrap' }} className="small">{c.submissionNote}</p>
            </div>
          )}

          {['funded', 'submitted'].includes(c.status) && isClient && (
            <div className="card">
              <h3>{c.status === 'submitted' ? 'Review and release payment' : 'Release payment'}</h3>
              <p className="small muted">Releasing pays {c.student.name} {gbp(c.payoutPence)} and completes the project. This can't be undone.</p>
              <button className="btn btn-ok" disabled={busy} onClick={() => act('release', {}, `Release ${gbp(c.amountPence)} from escrow?`)}>✓ Approve & release</button>
            </div>
          )}

          {c.status === 'disputed' && (
            <div className="alert alert-warn"><strong>Under review.</strong> A dispute was opened: "{c.disputeReason}". Our team will contact both parties. Funds stay safely in escrow.</div>
          )}

          {['funded', 'submitted'].includes(c.status) && (
            <div>
              {!showDispute ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowDispute(true)}>Report a problem…</button>
              ) : (
                <div className="card card-flat">
                  <h4>Open a dispute</h4>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what went wrong. Try messaging first, most issues are resolved that way." style={{ minHeight: 90 }} />
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn btn-danger btn-sm" disabled={busy || reason.trim().length < 10} onClick={() => act('dispute', { reason })}>Open dispute</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDispute(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {c.status === 'released' && (
            c.myReview ? (
              <div className="alert alert-ok">You rated this project {'★'.repeat(c.myReview.rating)}. Thanks for the feedback!</div>
            ) : (
              <ReviewForm contract={c} onDone={reload} />
            )
          )}
        </section>

        <aside className="stack">
          <div className="card">
            <h4>Payment breakdown</h4>
            <div className="money-row"><span>Project price</span><strong>{gbp(c.amountPence, { decimals: 2 })}</strong></div>
            <div className="money-row"><span className="muted">Platform fee ({Math.round(c.commissionRate * 100)}%)</span><span className="muted">−{gbp(c.commissionPence, { decimals: 2 })}</span></div>
            <div className="money-row"><span>Student receives</span><strong>{gbp(c.payoutPence, { decimals: 2 })}</strong></div>
          </div>
          <div className="card">
            <h4>{isStudent ? 'Client' : 'Student'}</h4>
            <div className="row">
              <Avatar name={other.name} color={other.avatarColor} />
              <Link to={`/users/${other.id}`}><strong>{other.name}</strong></Link>
            </div>
            <button className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 14 }} onClick={openChat}>💬 Message</button>
          </div>
          {ledger.length > 0 && (
            <div className="card">
              <h4>Escrow activity</h4>
              {ledger.map((e, i) => (
                <div key={i} className="money-row">
                  <span className="small">{LEDGER_LABEL[e.kind] || e.kind}<div className="tiny muted">{timeAgo(e.createdAt)}</div></span>
                  <span className="small">{gbp(e.amountPence, { decimals: 2 })}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
