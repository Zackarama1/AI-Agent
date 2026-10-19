// In-memory router for the browser-only preview build. Next.js navigation
// shims (next/link, next/navigation) talk to this instead of a server.
type Listener = () => void;

let path = '/';
let revision = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export const router = {
  get path() {
    return path;
  },
  get revision() {
    return revision;
  },
  navigate(href: string) {
    path = href.startsWith('/') ? href : `/${href}`;
    revision++;
    emit();
    window.scrollTo(0, 0);
  },
  refresh() {
    revision++;
    emit();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

export const REDIRECT = 'NEXT_REDIRECT';
export const NOT_FOUND = 'NEXT_NOT_FOUND';
