import { publish } from './events.js';

export function notify(db, userId, kind, text, link = '') {
  const row = db
    .prepare('INSERT INTO notifications (user_id, kind, text, link) VALUES (?, ?, ?, ?) RETURNING *')
    .get(userId, kind, text, link);
  publish(userId, 'notification', row);
  return row;
}
