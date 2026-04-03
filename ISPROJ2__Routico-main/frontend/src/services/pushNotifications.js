import app from '../config/firebase';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const PUSH_TOKEN_STORAGE_KEY = 'routico_push_token';

const getStoredPushToken = () => sessionStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

const setStoredPushToken = (token) => {
  if (!token) return;
  sessionStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
};

const clearStoredPushToken = () => {
  sessionStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
};

const requestBrowserPushToken = async () => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return null;
  }

  const messagingSupported = await isSupported();
  if (!messagingSupported) {
    return null;
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return null;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return null;
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  return token || null;
};

export const registerPushNotifications = async (authToken) => {
  if (!authToken) return;

  const pushToken = await requestBrowserPushToken();
  if (!pushToken) return;

  await fetch('http://localhost:3001/api/notifications/device-token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: pushToken, platform: 'web' })
  });

  setStoredPushToken(pushToken);
};

export const unregisterPushNotifications = async (authToken) => {
  const pushToken = getStoredPushToken();
  if (!authToken || !pushToken) {
    clearStoredPushToken();
    return;
  }

  await fetch('http://localhost:3001/api/notifications/device-token', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: pushToken })
  });

  clearStoredPushToken();
};
