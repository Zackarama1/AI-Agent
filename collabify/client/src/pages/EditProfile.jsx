import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';
import { ErrorBox, SkillInput } from '../components/ui.jsx';

function PortfolioEditor({ userId }) {
  const { data, reload } = useApi(`/users/${userId}`);
  const [item, setItem] = useState({ title: '', description: '', url: '' });
  const [error, setError] = useState(null);
  return (
    <div className="card">
      <h3>Portfolio</h3>
      <p className="small muted">Showcase coursework, side projects and past work. Completed Collabify projects are added automatically.</p>
      <div className="stack" style={{ marginBottom: 16 }}>
        {data?.portfolio.map((p) => (
          <div key={p.id} className="row between card card-flat" style={{ padding: 12 }}>
            <div><strong className="small">{p.title}</strong>{p.url && <div className="tiny muted">{p.url}</div>}</div>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await api.del(`/users/me/portfolio/${p.id}`); reload(); }}>Remove</button>
          </div>
        ))}
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await api.post('/users/me/portfolio', item);
          setItem({ title: '', description: '', url: '' });
          reload();
        } catch (err) { setError(err); }
      }}>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <input required placeholder="Title" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />
          <input type="url" placeholder="Link (https://…)" value={item.url} onChange={(e) => setItem({ ...item, url: e.target.value })} />
        </div>
        <textarea style={{ marginTop: 12, minHeight: 70 }} placeholder="Short description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
        <ErrorBox error={error} />
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>+ Add item</button>
      </form>
    </div>
  );
}

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user.name, headline: user.headline, bio: user.bio, location: user.location,
    university: user.university || '', course: user.course || '', graduationYear: user.graduationYear || '',
    company: user.company || '', website: user.website || '', skills: user.skills,
  });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isStudent = user.role === 'student';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const body = { name: form.name, headline: form.headline, bio: form.bio, location: form.location, skills: form.skills };
      if (isStudent) Object.assign(body, { university: form.university, course: form.course, graduationYear: form.graduationYear ? Number(form.graduationYear) : null });
      else Object.assign(body, { company: form.company, website: form.website });
      const { user: updated } = await api.put('/users/me', body);
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <main className="container page stack" style={{ maxWidth: 760 }}>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Edit profile</h1>
        <Link to={`/users/${user.id}`} className="btn btn-ghost btn-sm">View public profile →</Link>
      </div>
      {isStudent && !user.verified && <div className="alert alert-warn">Your student status isn't verified yet. <Link to="/verify">Verify now →</Link></div>}
      <form className="card" onSubmit={submit}>
        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="field"><label>Name</label><input required value={form.name} onChange={set('name')} /></div>
          <div className="field"><label>Location</label><input value={form.location} onChange={set('location')} placeholder="e.g. London, UK" /></div>
        </div>
        <div className="field"><label>Headline</label><input value={form.headline} onChange={set('headline')} maxLength={140} placeholder={isStudent ? 'e.g. Computer Science student · React & UI design' : 'e.g. Founder building the future of coffee delivery'} /></div>
        <div className="field"><label>About</label><textarea value={form.bio} onChange={set('bio')} maxLength={2000} /></div>
        {isStudent ? (
          <div className="grid grid-3" style={{ gap: 16 }}>
            <div className="field"><label>University</label><input value={form.university} onChange={set('university')} /></div>
            <div className="field"><label>Course</label><input value={form.course} onChange={set('course')} /></div>
            <div className="field"><label>Graduation year</label><input type="number" min="1990" max="2040" value={form.graduationYear} onChange={set('graduationYear')} /></div>
          </div>
        ) : (
          <div className="grid grid-2" style={{ gap: 16 }}>
            <div className="field"><label>Company</label><input value={form.company} onChange={set('company')} /></div>
            <div className="field"><label>Website</label><input type="url" value={form.website} onChange={set('website')} placeholder="https://" /></div>
          </div>
        )}
        <div className="field">
          <label>{isStudent ? 'Your skills' : 'Skills you often hire for'}</label>
          <SkillInput value={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
        </div>
        <ErrorBox error={error} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary">Save changes</button>
          {saved && <span className="badge badge-ok">Saved ✓</span>}
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </div>
      </form>
      {isStudent && <PortfolioEditor userId={user.id} />}
    </main>
  );
}
