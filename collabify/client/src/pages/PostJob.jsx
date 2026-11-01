import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { api, gbp } from '../lib/api.js';
import { ErrorBox, SkillInput } from '../components/ui.jsx';

export default function PostJob() {
  const navigate = useNavigate();
  const { data: meta } = useApi('/jobs/meta');
  const [form, setForm] = useState({ title: '', description: '', category: '', budget: '', duration: '', skills: [] });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const budgetPence = Math.round(Number(form.budget) * 100) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { job } = await api.post('/jobs', {
        title: form.title,
        description: form.description,
        category: form.category,
        budgetPence,
        duration: form.duration,
        skills: form.skills,
      });
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container page" style={{ maxWidth: 760 }}>
      <h1>Post a project</h1>
      <p className="muted">Describe what you need. Verified students will apply, ranked by how well they match.</p>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="t">Project title</label>
          <input id="t" required minLength={5} maxLength={120} value={form.title} onChange={set('title')} placeholder="e.g. Design a logo and brand kit for a coffee startup" />
        </div>
        <div className="field">
          <label htmlFor="d">Description</label>
          <textarea id="d" required minLength={30} value={form.description} onChange={set('description')} placeholder="Goals, deliverables, any links or context, and how you'll measure success." style={{ minHeight: 180 }} />
        </div>
        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="c">Category</label>
            <select id="c" required value={form.category} onChange={set('category')}>
              <option value="" disabled>Choose…</option>
              {meta?.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="du">Timeline</label>
            <input id="du" value={form.duration} onChange={set('duration')} placeholder="e.g. 2 weeks" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="b">Fixed budget (£)</label>
          <input id="b" type="number" min="10" step="1" required value={form.budget} onChange={set('budget')} placeholder="250" />
          {budgetPence > 0 && <div className="hint">You pay {gbp(budgetPence)} into escrow when you hire. No extra client fees.</div>}
        </div>
        <div className="field">
          <label>Skills needed</label>
          <SkillInput value={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
        </div>
        <ErrorBox error={error} />
        {error?.status === 403 && <p className="small"><Link to="/pricing">Upgrade your plan →</Link></p>}
        <button className="btn btn-primary btn-lg" style={{ marginTop: 10 }} disabled={busy || form.skills.length === 0}>
          {busy ? 'Posting…' : 'Post project'}
        </button>
      </form>
    </main>
  );
}
