import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api, timeAgo } from '../lib/api.js';
import { connectEvents, disconnectEvents, onEvent } from '../lib/events.js';
import { Avatar, Logo } from './ui.jsx';

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const ref = useRef(null);
  const load = () => api.get('/notifications').then(setData).catch(() => {});

  useEffect(() => {
    load();
    return onEvent('notification', load);
  }, []);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = async () => {
    setOpen(!open);
    if (!open && data.unread) {
      await api.post('/notifications/read');
      setTimeout(load, 1500);
    }
  };

  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={toggle} aria-label="Notifications">
        🔔{data.unread > 0 && <span className="dot-count">{data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown-panel">
          {data.notifications.length === 0 && <div className="item muted">You're all caught up.</div>}
          {data.notifications.map((n) => (
            <Link key={n.id} to={n.link || '#'} className={`item ${n.readAt ? '' : 'unread'}`} onClick={() => setOpen(false)}>
              {n.text}
              <div className="tiny muted">{timeAgo(n.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!user) return disconnectEvents();
    connectEvents();
    const load = () =>
      api.get('/conversations').then((d) => setUnreadMsgs(d.conversations.reduce((s, c) => s + c.unread, 0))).catch(() => {});
    load();
    const off = onEvent('message', () => setTimeout(load, 300));
    const t = setInterval(load, 30000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [user, location.pathname]);

  const links = !user
    ? [['/jobs', 'Find work'], ['/talent', 'Find talent'], ['/pricing', 'Pricing']]
    : user.role === 'student'
      ? [['/dashboard', 'Dashboard'], ['/jobs', 'Find work'], ['/contracts', 'Contracts'], ['/messages', `Messages${unreadMsgs ? ` (${unreadMsgs})` : ''}`]]
      : user.role === 'admin'
        ? [['/admin', 'Admin'], ['/jobs', 'Jobs']]
        : [['/dashboard', 'Dashboard'], ['/talent', 'Find talent'], ['/contracts', 'Contracts'], ['/messages', `Messages${unreadMsgs ? ` (${unreadMsgs})` : ''}`]];

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Logo />
        <nav className={`nav-links ${menu ? 'open' : ''}`}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          {user?.role === 'entrepreneur' && <NavLink to="/pricing">Plans</NavLink>}
        </nav>
        <div className="nav-right">
          {user ? (
            <>
              {user.role === 'entrepreneur' && (
                <Link to="/jobs/new" className="btn btn-primary btn-sm">
                  + Post a job
                </Link>
              )}
              <Notifications />
              <Link to={`/users/${user.id}`} title="Your profile">
                <Avatar name={user.name} color={user.avatarColor} size={36} />
              </Link>
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Join free
              </Link>
            </>
          )}
          <button className="icon-btn menu-toggle" onClick={() => setMenu(!menu)} aria-label="Menu">
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}
