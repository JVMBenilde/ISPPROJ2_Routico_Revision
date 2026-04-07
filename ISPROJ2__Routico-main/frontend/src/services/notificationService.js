import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import app from '../config/firebase';

// Lazy-init messaging to avoid race conditions with async isSupported()
const getFirebaseMessaging = () => {
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
};

const STORAGE_KEY = 'routico_notifications';

class NotificationService {
  constructor() {
    this.listeners = [];
  }

  saveToStorage(notification) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      stored.unshift({ ...notification, read: false });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.slice(0, 50)));
    } catch {}
  }

  loadFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  markAllAsRead() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const updated = stored.map(n => ({ ...n, read: true }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  }

  clearStorage() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Request permission and get FCM token
  async requestPermission() {
    try {
      if (!('Notification' in window)) {
        console.warn('🔔 Notifications not supported in this browser');
        return null;
      }

      if (Notification.permission === 'granted') {
        return await this.getFCMToken();
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          return await this.getFCMToken();
        }
      }

      return null;
    } catch (error) {
      console.error('🔔 Error requesting permission:', error);
      return null;
    }
  }

  // Get FCM registration token
  async getFCMToken() {
    try {
      const messaging = getFirebaseMessaging();

      if (!messaging) {
        console.warn('🔔 Firebase messaging not available');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });

      if (token) {
        console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
        localStorage.setItem('fcmToken', token);
        await this.sendTokenToBackend(token);
        return token;
      } else {
        console.warn('🔔 No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('🔔 Error getting FCM token:', error);
      return null;
    }
  }

  // Send FCM token to backend
  async sendTokenToBackend(token) {
    try {
      const authToken = localStorage.getItem('authToken');

      if (!authToken) {
        console.warn('🔔 No auth token, skipping device registration');
        return;
      }

      const response = await fetch('http://localhost:3001/api/notifications/register-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ fcmToken: token })
      });

      if (!response.ok) {
        console.error('🔔 Failed to register device:', response.statusText);
      } else {
        console.log('✅ Device registered with backend');
      }
    } catch (error) {
      console.error('🔔 Error registering device:', error);
    }
  }

  // Listen for foreground messages
  onNotification(callback) {
    try {
      const messaging = getFirebaseMessaging();

      if (!messaging) {
        console.warn('🔔 Messaging not available for foreground listening');
        return () => {};
      }

      return onMessage(messaging, (payload) => {
        console.log('📬 Foreground message received:', payload);
        callback(payload);
      });
    } catch (error) {
      console.error('🔔 Error setting up foreground listener:', error);
      return () => {};
    }
  }
}

export default new NotificationService();
