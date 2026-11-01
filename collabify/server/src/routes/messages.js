import { Router } from 'express';
import { z } from 'zod';
import { parse, notFound, forbidden, badRequest } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { publish } from '../lib/events.js';

/**
 * End-to-end encrypted messaging.
 * Clients derive a shared AES-GCM key per conversation via ECDH (P-256) between the two users'
 * keypairs. The server stores and relays only { ciphertext, iv } - it cannot read messages.
 */
const messageSchema = z.object({
  ciphertext: z.string().min(1).max(40_000),
  iv: z.string().min(12).max(64),
});

export function messageRoutes(db) {
  const r = Router();
  r.use(requireAuth);

  const loadConversation = (id, userId) => {
    const c = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!c) throw notFound('Conversation not found');
    if (c.user_a !== userId && c.user_b !== userId) throw forbidden();
    return c;
  };

  const shapeMessage = (m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    ciphertext: m.ciphertext,
    iv: m.iv,
    readAt: m.read_at,
    createdAt: m.created_at,
  });

  r.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, u.id AS other_id, u.name AS other_name, u.avatar_color AS other_color, u.role AS other_role,
                u.public_key AS other_key, j.title AS job_title,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != :me AND m.read_at IS NULL) AS unread
         FROM conversations c
         JOIN users u ON u.id = CASE WHEN c.user_a = :me THEN c.user_b ELSE c.user_a END
         LEFT JOIN jobs j ON j.id = c.job_id
         WHERE c.user_a = :me OR c.user_b = :me
         ORDER BY c.last_message_at DESC`,
      )
      .all({ me: req.user.id });
    res.json({
      conversations: rows.map((c) => ({
        id: c.id,
        jobTitle: c.job_title,
        lastMessageAt: c.last_message_at,
        unread: c.unread,
        other: { id: c.other_id, name: c.other_name, avatarColor: c.other_color, role: c.other_role, publicKey: c.other_key },
      })),
    });
  });

  r.post('/', (req, res) => {
    const { userId, jobId } = parse(z.object({ userId: z.number().int(), jobId: z.number().int().optional() }), req.body);
    if (userId === req.user.id) throw badRequest("You can't message yourself");
    const other = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!other) throw notFound('User not found');
    if (other.role === req.user.role && req.user.role !== 'admin') {
      throw forbidden('Messaging is between students and entrepreneurs');
    }
    if (!other.public_key) throw badRequest('This user has not set up secure messaging yet');
    const [a, b] = req.user.id < userId ? [req.user.id, userId] : [userId, req.user.id];
    db.prepare('INSERT OR IGNORE INTO conversations (user_a, user_b, job_id) VALUES (?, ?, ?)').run(a, b, jobId ?? null);
    const c = db.prepare('SELECT id FROM conversations WHERE user_a = ? AND user_b = ?').get(a, b);
    res.status(201).json({ conversationId: c.id });
  });

  r.get('/:id/messages', (req, res) => {
    loadConversation(req.params.id, req.user.id);
    const after = Number(req.query.after || 0);
    const rows = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT 500')
      .all(req.params.id, after);
    res.json({ messages: rows.map(shapeMessage) });
  });

  r.post('/:id/messages', (req, res) => {
    const c = loadConversation(req.params.id, req.user.id);
    const body = parse(messageSchema, req.body);
    const m = db
      .prepare('INSERT INTO messages (conversation_id, sender_id, ciphertext, iv) VALUES (?, ?, ?, ?) RETURNING *')
      .get(c.id, req.user.id, body.ciphertext, body.iv);
    db.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?").run(c.id);
    const recipient = c.user_a === req.user.id ? c.user_b : c.user_a;
    const shaped = shapeMessage(m);
    publish(recipient, 'message', shaped);
    publish(req.user.id, 'message', shaped);
    res.status(201).json({ message: shaped });
  });

  r.post('/:id/read', (req, res) => {
    const c = loadConversation(req.params.id, req.user.id);
    db.prepare("UPDATE messages SET read_at = datetime('now') WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL").run(
      c.id,
      req.user.id,
    );
    res.json({ ok: true });
  });

  return r;
}
