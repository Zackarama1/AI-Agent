import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { ErrorBox } from '../components/ui.jsx';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email, form.password);
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/dashboard'));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container page">
      <div className="auth-wrap card">
        <h1 style={{ fontSize: '1.6rem' }}>Welcome back</h1>
        <p className="muted">Log in to your Collabify account.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="small muted center" style={{ marginTop: 18 }}>
          New to Collabify? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}

export function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'entrepreneur' ? 'entrepreneur' : 'student');
  const [form, setForm] = useState({ name: '', email: '', password: '', university: '', company: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        role,
        name: form.name,
        email: form.email,
        password: form.password,
        ...(role === 'student' ? { university: form.university || undefined } : { company: form.company || undefined }),
      });
      navigate(role === 'student' ? '/verify' : '/dashboard');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container page">
      <div className="auth-wrap card">
        <h1 style={{ fontSize: '1.6rem' }}>Join Collabify</h1>
        <p className="muted">Free to join. Choose how you'll use Collabify.</p>
        <div className="role-pick">
          <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}>
            <strong>🎓 Student</strong>
            <span>Find paid projects</span>
          </button>
          <button type="button" className={role === 'entrepreneur' ? 'active' : ''} onClick={() => setRole('entrepreneur')}>
            <strong>🚀 Entrepreneur</strong>
            <span>Hire student talent</span>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" required autoComplete="name" value={form.name} onChange={set('name')} />
          </div>
          {role === 'student' ? (
            <div className="field">
              <label htmlFor="uni">University</label>
              <input id="uni" placeholder="e.g. University of Manchester" value={form.university} onChange={set('university')} />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="company">Company / startup</label>
              <input id="company" placeholder="e.g. Brightside Labs" value={form.company} onChange={set('company')} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
            {role === 'student' && <div className="hint">You'll verify your university email on the next step.</div>}
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
            <div className="hint">At least 8 characters. It also protects your encrypted messages.</div>
          </div>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy}>
            {busy ? 'Creating your account…' : 'Create account'}
          </button>
        </form>
        <p className="small muted center" style={{ marginTop: 18 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
