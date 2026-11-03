import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getApi } from './api';

/** Where Stripe pages send people back to (collabify://stripe-return, or exp://… in Expo Go). */
export const appReturnUrl = () => Linking.createURL('stripe-return');

/**
 * Open a Stripe page (Checkout, Connect onboarding, billing portal) in an auth session that
 * closes itself when Stripe redirects back to the app. Stripe's webhook can land a moment after
 * the redirect, so screens are refreshed a few times afterwards.
 */
export async function openStripe(url: string) {
  await WebBrowser.openAuthSessionAsync(url, appReturnUrl());
  const api = getApi();
  for (const delay of [0, 2000, 5000]) setTimeout(() => api.refresh(), delay);
}
