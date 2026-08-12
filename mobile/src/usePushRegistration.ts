import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { api } from "./api/client";

// Show alerts as banners even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Ask permission, get the Expo push token, and register it with the backend.
// Silently no-ops on simulators or before `eas init` sets a projectId.
export function usePushRegistration() {
  useEffect(() => {
    (async () => {
      try {
        if (!Device.isDevice) return;

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== "granted") {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== "granted") return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.HIGH,
          });
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        if (!projectId || projectId === "REPLACE_WITH_EAS_PROJECT_ID") return;

        const token = (
          await Notifications.getExpoPushTokenAsync({ projectId })
        ).data;
        await api.registerPushToken(token);
      } catch {
        // Push is best-effort; the rest of the app works without it.
      }
    })();
  }, []);
}
