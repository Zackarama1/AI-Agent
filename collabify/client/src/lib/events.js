// One shared EventSource per tab for live messages & notifications.
const handlers = new Map();
let source = null;

export function connectEvents() {
  if (source) return;
  source = new EventSource('/api/stream');
  for (const type of ['message', 'notification']) {
    source.addEventListener(type, (e) => {
      const data = JSON.parse(e.data);
      for (const h of handlers.get(type) || []) h(data);
    });
  }
}

export function disconnectEvents() {
  source?.close();
  source = null;
}

export function onEvent(type, handler) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(handler);
  return () => handlers.get(type).delete(handler);
}
