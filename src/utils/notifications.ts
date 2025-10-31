import { supabase } from '@/integrations/supabase/client';

/**
 * Check if notifications are supported
 */
export const areNotificationsSupported = (): boolean => {
  return 'Notification' in window;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!areNotificationsSupported()) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Initialize push notifications for the current user
 * Simplified version - requests permission and saves to profile
 */
export const initializePushNotifications = async (_firebaseProjectId: string): Promise<boolean> => {
  if (!areNotificationsSupported()) {
    console.log('Notifications not supported in this browser');
    return false;
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Save permission status to user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user');
      return false;
    }

    // Generate a simple token (in production, use FCM token)
    const simpleToken = `browser-${user.id}-${Date.now()}`;
    
    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: simpleToken })
      .eq('id', user.id);

    if (error) {
      console.error('Error saving notification token:', error);
      return false;
    }

    console.log('Push notifications initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
};

/**
 * Send a browser notification (works when app is open)
 */
export const sendBrowserNotification = async (
  title: string,
  body: string,
  options?: NotificationOptions
): Promise<void> => {
  if (!areNotificationsSupported()) {
    console.log('Notifications not supported');
    return;
  }

  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    // Vibrate first
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    
    // Show notification
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      ...options,
    });
  }
};

/**
 * Vibrate the phone
 */
export const vibratePhone = (pattern: number | number[] = [200, 100, 200]): void => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

/**
 * Check if user has granted notification permission
 */
export const hasNotificationPermission = (): boolean => {
  return getNotificationPermission() === 'granted';
};

/**
 * Revoke notification permission (clear FCM token)
 */
export const revokeNotificationPermission = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({ fcm_token: null })
    .eq('id', user.id);
};
