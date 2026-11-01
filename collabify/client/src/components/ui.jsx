import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Collabify home">
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <circle cx="12.5" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="19.5" cy="16" r="6" fill="none" stroke="#a5f3fc" strokeWidth="3" />
      </svg>
      Collabify
    </Link>
  );
}

export function Avatar({ name = '?', color = '#6d5dfc', size = 36 }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="alert alert-error">{error.message || String(error)}</div>;
}

export function Empty({ icon = '✨', title, children }) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <strong>{title}</strong>
      {children && <div className="small" style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

export function Stars({ value }) {
  if (!value) return <span className="muted small">No reviews yet</span>;
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★'.repeat(full)}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(5 - full)}</span>
    </span>
  );
}

export function MatchScore({ score }) {
  if (score == null) return null;
  return (
    <span className="match" title="How well your skills and track record match this job">
      <span className="match-bar">
        <span style={{ width: `${score}%` }} />
      </span>
      {score}% match
    </span>
  );
}

export function VerifiedBadge() {
  return <span className="badge badge-ok" title="Academic email verified">✓ Verified student</span>;
}

const STATUS_STYLE = {
  open: 'badge-ok', in_progress: 'badge-brand', completed: 'badge', closed: 'badge',
  pending: 'badge-warn', accepted: 'badge-ok', rejected: 'badge', withdrawn: 'badge',
  awaiting_funding: 'badge-warn', funded: 'badge-brand', submitted: 'badge-brand', released: 'badge-ok',
  disputed: 'badge-danger', refunded: 'badge', cancelled: 'badge',
};
const STATUS_LABEL = {
  in_progress: 'In progress', awaiting_funding: 'Awaiting funding', funded: 'Funded · in escrow',
  submitted: 'Work submitted', released: 'Paid',
};
export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_STYLE[status] || ''}`}>
      {STATUS_LABEL[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function SkillInput({ value, onChange, placeholder = 'Type a skill and press Enter' }) {
  const add = (raw) => {
    const s = raw.trim().replace(/,$/, '');
    if (s && !value.some((v) => v.toLowerCase() === s.toLowerCase())) onChange([...value, s]);
  };
  return (
    <div>
      <input
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        onBlur={(e) => {
          add(e.currentTarget.value);
          e.currentTarget.value = '';
        }}
      />
      {value.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {value.map((s) => (
            <button type="button" key={s} className="chip" style={{ cursor: 'pointer' }} onClick={() => onChange(value.filter((v) => v !== s))} title="Remove">
              {s} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
