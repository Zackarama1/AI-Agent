import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api, timeAgo } from '../lib/api.js';
import { conversationKey, decryptMessage, encryptMessage } from '../lib/e2ee.js';
import { onEvent } from '../lib/events.js';
import { Avatar, Empty, ErrorBox, Spinner } from '../components/ui.jsx';

function UnlockPrompt() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  return (
    <main className="container page">
      <form
        className="auth-wrap card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await unlock(password);
          } catch {
            setError(new Error('That password could not unlock your messages.'));
          }
        }}
      >
        <h2>🔐 Unlock your messages</h2>
        <p className="muted small">
          Your messages are end-to-end encrypted. Enter your password to unlock your private key on this device.
          It never leaves your browser.
        </p>
        <div className="field">
          <input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        </div>
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-block" style={{ marginTop: 10 }}>Unlock</button>
      </form>
    </main>
  );
}

function Thread({ conversation, me, privateKey, onActivity }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const bodyRef = useRef(null);
  const lastId = useRef(0);

  const keyPromise = useMemo(
    () => (conversation.other.publicKey ? conversationKey(privateKey, conversation.other.publicKey) : Promise.reject(new Error('no key'))),
    [privateKey, conversation.other.publicKey],
  );

  const decryptAll = async (raw) => {
    const key = await keyPromise.catch(() => null);
    return Promise.all(
      raw.map(async (m) => {
        try {
          return { ...m, text: await decryptMessage(key, m) };
        } catch {
          return { ...m, text: null };
        }
      }),
    );
  };

  const fetchNew = async () => {
    const { messages: raw } = await api.get(`/conversations/${conversation.id}/messages?after=${lastId.current}`);
    if (!raw.length) return;
    lastId.current = raw[raw.length - 1].id;
    const dec = await decryptAll(raw);
    setMessages((prev) => {
      const seen = new Set((prev || []).map((m) => m.id));
      return [...(prev || []), ...dec.filter((m) => !seen.has(m.id))];
    });
    api.post(`/conversations/${conversation.id}/read`).then(onActivity).catch(() => {});
  };

  useEffect(() => {
    lastId.current = 0;
    setMessages(null);
    fetchNew().then(() => setMessages((m) => m || []));
    const off = onEvent('message', (m) => m.conversationId === conversation.id && fetchNew());
    const poll = setInterval(fetchNew, 15000); // fallback if the event stream drops
    return () => {
      off();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, keyPromise]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    try {
      const key = await keyPromise;
      const payload = await encryptMessage(key, body);
      setText('');
      await api.post(`/conversations/${conversation.id}/messages`, payload);
      await fetchNew();
      onActivity();
    } catch (err) {
      setError(err.message === 'no key' ? new Error('This user has not set up secure messaging yet.') : err);
    }
  };

  return (
    <div className="chat-main">
      <div className="chat-head">
        <Link to="/messages" className="btn btn-ghost btn-sm menu-toggle">←</Link>
        <Avatar name={conversation.other.name} color={conversation.other.avatarColor} />
        <div className="grow">
          <Link to={`/users/${conversation.other.id}`}><strong>{conversation.other.name}</strong></Link>
          <div className="tiny muted">{conversation.jobTitle ? `Re: ${conversation.jobTitle}` : conversation.other.role}</div>
        </div>
        <span className="lock-note" title="Encrypted on your device with AES-256-GCM. Collabify cannot read these messages.">🔒 End-to-end encrypted</span>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {!messages ? <Spinner /> : messages.length === 0 ? (
          <Empty icon="👋" title={`Say hello to ${conversation.other.name.split(' ')[0]}`}>Messages are encrypted before they leave your device.</Empty>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`bubble ${m.senderId === me.id ? 'mine' : ''}`}>
              {m.text ?? <em style={{ opacity: 0.7 }}>🔒 Unable to decrypt this message on this device</em>}
              <div className="meta">{timeAgo(m.createdAt)}</div>
            </div>
          ))
        )}
      </div>
      {error && <div style={{ padding: '0 14px' }}><ErrorBox error={error} /></div>}
      <form className="chat-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" maxLength={5000} />
        <button className="btn btn-primary" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}

export default function Messages() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, privateKey } = useAuth();
  const [conversations, setConversations] = useState(null);

  const load = () => api.get('/conversations').then((d) => setConversations(d.conversations)).catch(() => setConversations([]));
  useEffect(() => {
    load();
    return onEvent('message', () => setTimeout(load, 200));
  }, []);

  if (user.wrappedPrivateKey && !privateKey) return <UnlockPrompt />;
  const active = conversations?.find((c) => String(c.id) === id);

  return (
    <main className="container" style={{ padding: '24px 20px' }}>
      <div className={`card chat ${active ? 'has-active' : ''}`}>
        <div className="chat-list">
          <div style={{ padding: '16px 16px 10px' }}><h3 style={{ margin: 0 }}>Messages</h3></div>
          {!conversations ? <Spinner /> : conversations.length === 0 ? (
            <Empty icon="💬" title="No conversations yet">
              {user.role === 'student' ? 'Ask a client a question from any job page.' : 'Message applicants from your job posts.'}
            </Empty>
          ) : (
            conversations.map((c) => (
              <a key={c.id} className={`chat-item ${String(c.id) === id ? 'active' : ''}`} href={`/messages/${c.id}`} onClick={(e) => { e.preventDefault(); navigate(`/messages/${c.id}`); }}>
                <Avatar name={c.other.name} color={c.other.avatarColor} size={40} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row between">
                    <strong className="small">{c.other.name}</strong>
                    <span className="tiny muted">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="tiny muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.jobTitle || c.other.role}</div>
                </div>
                {c.unread > 0 && <span className="badge badge-brand">{c.unread}</span>}
              </a>
            ))
          )}
        </div>
        {active ? (
          <Thread key={active.id} conversation={active} me={user} privateKey={privateKey} onActivity={load} />
        ) : (
          <div className="chat-main" style={{ justifyContent: 'center' }}>
            <Empty icon="🔒" title="Select a conversation">All messages on Collabify are end-to-end encrypted.</Empty>
          </div>
        )}
      </div>
    </main>
  );
}
