import { router, type Href } from 'expo-router';

/** Clear the navigation stack and land on `href` (used after sign-in and sign-out). */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
