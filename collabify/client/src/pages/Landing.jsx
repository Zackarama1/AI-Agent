import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi.js';
import { gbp } from '../lib/api.js';

const FEATURES = [
  ['🎓', 'Verified students only', 'Every student confirms a university email before they can apply, so you know exactly who you are hiring.'],
  ['🔒', 'Escrow-protected payments', 'Clients fund each project up front. Money is held safely and only released when the work is approved.'],
  ['💬', 'End-to-end encrypted chat', 'Messages are encrypted on your device. Not even Collabify can read your conversations.'],
  ['🎯', 'Smart matching', 'Jobs are ranked by skills overlap, verification and track record, so the right people find each other fast.'],
  ['⭐', 'Two-way ratings', 'After every project both sides leave a review, building trust and a reputation that follows you.'],
  ['📁', 'Career portfolio', 'Completed projects are added to your portfolio automatically, so every gig strengthens your CV.'],
];

export default function Landing() {
  const { data: stats } = useApi('/stats/public');
  return (
    <main>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">🎓 Exclusive to verified university students</span>
          <h1>
            Real projects for students. <span className="gradient-text">Affordable talent</span> for startups.
          </h1>
          <p className="lead">
            Collabify connects ambitious university students with entrepreneurs who need skilled, motivated help, with
            escrow payments, encrypted messaging and fees lower than the big freelance platforms.
          </p>
          <div className="row">
            <Link to="/signup?role=student" className="btn btn-primary btn-lg">I'm a student: find work</Link>
            <Link to="/signup?role=entrepreneur" className="btn btn-secondary btn-lg">I'm hiring: post a job</Link>
          </div>
          {stats && (
            <div className="grid grid-4" style={{ marginTop: 48 }}>
              {[
                ['Verified students', stats.verifiedStudents],
                ['Open projects', stats.openJobs],
                ['Projects completed', stats.completedProjects],
                ['Paid to students', gbp(stats.paidToStudentsPence)],
              ].map(([label, value]) => (
                <div key={label} className="card stat card-flat">
                  <div className="label">{label}</div>
                  <div className="value">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="band band-alt">
        <div className="container">
          <h2 className="center">Built for both sides of the table</h2>
          <p className="center muted" style={{ maxWidth: 620, margin: '0 auto 36px' }}>
            Students gain experience, earn income and build their CV. Entrepreneurs get affordable, motivated talent from
            universities around the world.
          </p>
          <div className="grid grid-2">
            <div className="card">
              <h3>For students</h3>
              {[
                ['Verify your university email', 'Takes 60 seconds and unlocks applications.'],
                ['Apply to matched projects', 'Your feed is ranked by how well your skills fit.'],
                ['Get paid securely', 'Funds sit in escrow before you start, so you always get paid for approved work.'],
              ].map(([t, d], i) => (
                <div key={t} className="row" style={{ alignItems: 'flex-start', marginTop: 16 }}>
                  <span className="step-num">{i + 1}</span>
                  <div className="grow">
                    <strong>{t}</strong>
                    <div className="muted small">{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3>For entrepreneurs</h3>
              {[
                ['Post a project in minutes', 'Set your budget, skills and timeline.'],
                ['Review ranked applicants', 'See match scores, ratings and portfolios side by side.'],
                ['Pay only for approved work', 'Fund escrow, review the delivery, then release payment.'],
              ].map(([t, d], i) => (
                <div key={t} className="row" style={{ alignItems: 'flex-start', marginTop: 16 }}>
                  <span className="step-num">{i + 1}</span>
                  <div className="grow">
                    <strong>{t}</strong>
                    <div className="muted small">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container">
          <h2 className="center" style={{ marginBottom: 36 }}>Everything you need to work together</h2>
          <div className="grid grid-3">
            {FEATURES.map(([icon, title, text]) => (
              <div key={title} className="card card-flat">
                <div className="feature-icon">{icon}</div>
                <h3>{title}</h3>
                <p className="muted small" style={{ margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-alt">
        <div className="container" style={{ maxWidth: 820 }}>
          <h2 className="center">Lower fees. More for students.</h2>
          <p className="center muted" style={{ marginBottom: 28 }}>A flat commission on completed projects only. No fees to apply, no fees to post.</p>
          <div className="table-wrap">
            <table className="compare">
              <thead>
                <tr><th></th><th>Collabify</th><th>Typical freelance marketplaces</th></tr>
              </thead>
              <tbody>
                <tr><td>Commission on completed work</td><td className="us">15% flat</td><td>Up to 20% + client fees</td></tr>
                <tr><td>Verified students</td><td className="us">100%</td><td>No academic checks</td></tr>
                <tr><td>Escrow protection</td><td className="us">Included</td><td>Varies</td></tr>
                <tr><td>Encrypted messaging</td><td className="us">End-to-end</td><td>Platform-readable</td></tr>
                <tr><td>Portfolio built automatically</td><td className="us">Yes</td><td>Manual</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container center">
          <h2>Ready to collaborate?</h2>
          <p className="muted">Join free. Start your first project this week.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/signup" className="btn btn-primary btn-lg">Create your account</Link>
            <Link to="/jobs" className="btn btn-secondary btn-lg">Browse open projects</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
