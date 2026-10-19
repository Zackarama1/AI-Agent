import { useSyncExternalStore } from 'react';
import { NOT_FOUND, REDIRECT, router } from '../router';

export function useRouter() {
  return {
    push: (href: string) => router.navigate(href),
    replace: (href: string) => router.navigate(href),
    refresh: () => router.refresh(),
    back: () => history.back(),
    prefetch: () => undefined,
  };
}

export function usePathname() {
  return useSyncExternalStore(router.subscribe, () => router.path.split('?')[0]);
}

export function redirect(href: string): never {
  router.navigate(href);
  throw Object.assign(new Error(REDIRECT), { digest: `${REDIRECT};${href}` });
}

export function notFound(): never {
  throw Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND });
}
