import { supabase } from '@/integrations/supabase/client';

// Public VAPID key (safe to expose). Must match the VAPID_PUBLIC_KEY secret on the server.
const VAPID_PUBLIC_KEY = 'BGwlewQtKQLB-pr-KDpi2aAYGFGZbxDaJ2zPzRSIG1ioDlIaSi-2UJRjunBQiD_6xF3mqxWB-qmjJae16Us_R4s';

export const areNotificationsSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
};

export const hasNotificationPermission = (): boolean => getNotificationPermission() === 'granted';

const isBlockedServiceWorkerContext = (): boolean => {
  if (typeof window === 'undefined') return true;
  const isPreviewHost = window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com');
  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }
  return isPreviewHost || isInIframe;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || isBlockedServiceWorkerContext()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    const isPushWorker = existing?.active?.scriptURL.endsWith('/push-sw.js')
      || existing?.installing?.scriptURL.endsWith('/push-sw.js')
      || existing?.waiting?.scriptURL.endsWith('/push-sw.js');

    if (existing && isPushWorker) return existing;
    if (existing && !isPushWorker) await existing.unregister();

    const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (e) {
    console.error('SW register failed:', e);
    return null;
  }
}

/**
 * Initialize push notifications: ask permission, register SW, subscribe, save to DB.
 */
export const initializePushNotifications = async (_unused?: string): Promise<boolean> => {
  if (!areNotificationsSupported()) {
    console.log('Push not supported');
    return false;
  }

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await getOrRegisterSW();
    if (!reg) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const json = sub.toJSON();
    const endpoint = json.endpoint!;
    const p256dh = json.keys?.p256dh ?? bufferToBase64(sub.getKey('p256dh'));
    const auth = json.keys?.auth ?? bufferToBase64(sub.getKey('auth'));

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('Save push subscription failed:', error);
      return false;
    }

    // Best-effort: also flag profile so older code paths know notifications are on.
    await supabase.from('profiles').update({ fcm_token: 'webpush' }).eq('id', user.id);

    console.log('Push notifications initialized');
    return true;
  } catch (e) {
    console.error('initializePushNotifications error:', e);
    return false;
  }
};

/**
 * Show a foreground notification (app is open). Background pushes are handled by the SW.
 */
export const sendBrowserNotification = async (
  title: string,
  body: string,
  options?: NotificationOptions
): Promise<void> => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);

  const notifOptions: NotificationOptions = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    ...options,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/push-sw.js')
        ?? await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, notifOptions);
        return;
      }
    }
  } catch (err) {
    console.warn('SW notification failed, falling back:', err);
  }

  try {
    new Notification(title, notifOptions);
  } catch (err) {
    console.warn('Notification constructor failed:', err);
  }
};

export const vibratePhone = (pattern: number | number[] = [200, 100, 200]): void => {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
};

/**
 * Unsubscribe and remove from DB.
 */
export const revokeNotificationPermission = async (): Promise<void> => {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/push-sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) {
    console.warn('Unsubscribe failed:', e);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').update({ fcm_token: null }).eq('id', user.id);
  }
};
