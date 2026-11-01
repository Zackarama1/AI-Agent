import { Navigate, Route, Routes, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './lib/auth.jsx';
import Nav from './components/Nav.jsx';
import { Spinner } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import PostJob from './pages/PostJob.jsx';
import Contracts from './pages/Contracts.jsx';
import ContractDetail from './pages/ContractDetail.jsx';
import Messages from './pages/Messages.jsx';
import Profile from './pages/Profile.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Verify from './pages/Verify.jsx';
import Pricing from './pages/Pricing.jsx';
import Talent from './pages/Talent.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ children, role }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Landing />} />
        <Route path="/about" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/new" element={<Protected role="entrepreneur"><PostJob /></Protected>} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/talent" element={<Talent />} />
        <Route path="/users/:id" element={<Profile />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/profile/edit" element={<Protected><EditProfile /></Protected>} />
        <Route path="/verify" element={<Protected role="student"><Verify /></Protected>} />
        <Route path="/contracts" element={<Protected><Contracts /></Protected>} />
        <Route path="/contracts/:id" element={<Protected><ContractDetail /></Protected>} />
        <Route path="/messages" element={<Protected><Messages /></Protected>} />
        <Route path="/messages/:id" element={<Protected><Messages /></Protected>} />
        <Route path="/admin" element={<Protected role="admin"><Admin /></Protected>} />
        <Route path="*" element={<div className="container page center"><h1>Page not found</h1><Link to="/">Go home</Link></div>} />
      </Routes>
      {!pathname.startsWith('/messages') && (
        <footer className="footer">
          <div className="container row between">
            <span>© {new Date().getFullYear()} Collabify · Real projects for verified students.</span>
            <span className="row">
              <Link to="/about">About</Link>
              <Link to="/pricing">Pricing</Link>
              <Link to="/jobs">Browse jobs</Link>
            </span>
          </div>
        </footer>
      )}
    </>
  );
}
