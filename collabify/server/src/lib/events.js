/**
 * In-process pub/sub for server-sent events. For multi-instance deployments swap this
 * for Redis pub/sub (see docs/ARCHITECTURE.md) - the interface stays the same.
 */
const listeners = new Map(); // userId -> Set<res>

export function subscribe(userId, res) {
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId).add(res);
  return () => {
    const set = listeners.get(userId);
    set?.delete(res);
    if (set?.size === 0) listeners.delete(userId);
  };
}

export function publish(userId, event, data) {
  const set = listeners.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(payload);
}
