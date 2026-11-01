import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { ErrorBox, VerifiedBadge } from '../components/ui.jsx';

export default function Verify() {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (user.verified) {
    return (
      <main className="container page">
        <div className="auth-wrap card center">
          <div style={{ fontSize: '2.5rem' }}>🎓</div>
          <h1 style={{ fontSize: '1.5rem' }}>You're verified</h1>
          <p><VerifiedBadge /></p>
          <p className="muted">Verified via {user.academicEmail}. You can apply to any open project.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/profile/edit" className="btn btn-secondary">Complete profile</Link>
            <Link to="/jobs" className="btn btn-primary">Find projects</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container page">
      <div className="auth-wrap card">
        <h1 style={{ fontSize: '1.5rem' }}>Verify your student status</h1>
        <p className="muted">
          Collabify is exclusive to university students. Enter your university email (for example
          <code> name@uni.ac.uk</code> or <code>name@college.edu</code>) and we'll send you a 6-digit code.
        </p>
        {!sent ? (
          <form onSubmit={(e) => { e.preventDefault(); run(async () => setSent(await api.post('/verification/request', { academicEmail: email }))); }}>
            <div className="field">
              <label htmlFor="ae">University email</label>
              <input id="ae" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.ac.uk" />
            </div>
            <ErrorBox error={error} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy}>Send code</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); run(async () => setUser((await api.post('/verification/confirm', { code })).user)); }}>
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              We sent a code to <strong>{sent.sentTo}</strong>.
              {sent.devCode && <> Development mode: your code is <strong>{sent.devCode}</strong>.</>}
            </div>
            <div className="field">
              <label htmlFor="code">Verification code</label>
              <input id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: '0.4em', fontSize: '1.3rem', textAlign: 'center' }} />
            </div>
            <ErrorBox error={error} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy}>Verify</button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setSent(null); setCode(''); }}>Use a different email</button>
          </form>
        )}
      </div>
    </main>
  );
}
