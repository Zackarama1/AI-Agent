import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getApi } from './api';

const supported = Platform.OS !== 'web';

if (supported) {
  // Show notifications as banners even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Ask for permission and register this phone for push. Quietly does nothing on simulators,
 * on web, in demo mode, or before the app has an EAS project id (set up with `eas init`).
 */
export async function registerForPush() {
  const api = getApi();
  if (!supported || !Device.isDevice || api.mode !== 'supabase') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.registerPushToken(token.data, Platform.OS);
}

function openLink(response: Notifications.NotificationResponse | null) {
  const link = response?.notification.request.content.data?.link;
  if (typeof link !== 'string' || !link.startsWith('/')) return;
  getApi().refresh();
  router.push(link as Href);
}

/** Register once signed in, and open the linked screen when a notification is tapped. */
export function usePush(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    registerForPush().catch(() => {});
    if (!supported) return;
    // App opened by tapping a notification while it was closed…
    Notifications.getLastNotificationResponseAsync().then((r) => {
      openLink(r);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });
    // …or tapped while the app is running.
    const sub = Notifications.addNotificationResponseReceivedListener(openLink);
    return () => sub.remove();
  }, [signedIn]);
}
