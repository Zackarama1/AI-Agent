import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Landing route for collabify://stripe-return. On iOS the auth session usually catches the
 * redirect first; if the link opens the app directly (e.g. on Android), go back to where we were.
 */
export default function StripeReturn() {
  const canGoBack = router.canGoBack();
  useEffect(() => {
    if (canGoBack) router.back();
  }, [canGoBack]);
  return canGoBack ? null : <Redirect href="/" />;
}
