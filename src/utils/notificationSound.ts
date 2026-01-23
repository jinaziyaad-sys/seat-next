// Custom MP3 notification sounds with repeat patterns

export type NotificationSoundType = 
  | 'newOrder'        // For merchant - new order (repeat 2x every 10s until approved)
  | 'newWaitlist'     // For merchant - new waitlist entry (repeat 2x once)
  | 'tableReady'      // For patron - table ready (repeat 2x every 25s until seated/cancelled)
  | 'foodReady'       // For patron - food ready (repeat 3x every 10s until collected)
  | 'orderDue'        // For merchant - 1min, 30s, then continuous every 10s when late
  | 'patronArrived';  // For merchant - patron has arrived (repeat 2x once)

// Sound file paths
const SOUND_FILES: Record<NotificationSoundType, string> = {
  newOrder: '/sounds/new-order.mp3',
  newWaitlist: '/sounds/new-waitlist.mp3',
  tableReady: '/sounds/table-ready.mp3',
  foodReady: '/sounds/food-ready.mp3',
  orderDue: '/sounds/order-due.mp3',
  patronArrived: '/sounds/patron-arrived.mp3',
};

// Active interval IDs for continuous sounds (keyed by unique identifier)
const activeIntervals: Map<string, NodeJS.Timeout> = new Map();

// Track cancelled sounds to prevent queued plays from completing
const cancelledSounds: Set<string> = new Set();

// Track currently playing audio elements so we can stop mid-play (prevents "echo" overlap)
const activeAudios: Map<string, Set<HTMLAudioElement>> = new Map();

// Snooze state management
let soundsSnoozed = false;
let snoozeTimeout: NodeJS.Timeout | null = null;
let snoozeEndTime: number | null = null;
const snoozeListeners: Set<(snoozed: boolean, remainingMs: number | null) => void> = new Set();

const notifySnoozeListeners = () => {
  const remaining = snoozeEndTime ? Math.max(0, snoozeEndTime - Date.now()) : null;
  snoozeListeners.forEach(listener => listener(soundsSnoozed, remaining));
};

/**
 * Snooze all sounds for a specified duration in minutes
 */
export const snoozeSounds = (durationMinutes: number) => {
  // Clear any existing snooze timeout
  if (snoozeTimeout) {
    clearTimeout(snoozeTimeout);
    snoozeTimeout = null;
  }
  
  soundsSnoozed = true;
  snoozeEndTime = Date.now() + durationMinutes * 60 * 1000;
  console.log(`🔕 Sounds snoozed for ${durationMinutes} minutes`);
  notifySnoozeListeners();
  
  // Auto-unsnooze after duration
  snoozeTimeout = setTimeout(() => {
    soundsSnoozed = false;
    snoozeEndTime = null;
    snoozeTimeout = null;
    console.log(`🔔 Snooze ended - sounds re-enabled`);
    notifySnoozeListeners();
  }, durationMinutes * 60 * 1000);
};

/**
 * Cancel snooze and re-enable sounds immediately
 */
export const cancelSnooze = () => {
  if (snoozeTimeout) {
    clearTimeout(snoozeTimeout);
    snoozeTimeout = null;
  }
  soundsSnoozed = false;
  snoozeEndTime = null;
  console.log(`🔔 Snooze cancelled - sounds re-enabled`);
  notifySnoozeListeners();
};

/**
 * Check if sounds are currently snoozed
 */
export const isSnoozed = (): boolean => soundsSnoozed;

/**
 * Get remaining snooze time in milliseconds
 */
export const getSnoozeRemaining = (): number | null => {
  if (!snoozeEndTime) return null;
  const remaining = snoozeEndTime - Date.now();
  return remaining > 0 ? remaining : null;
};

/**
 * Subscribe to snooze state changes
 */
export const subscribeToSnooze = (callback: (snoozed: boolean, remainingMs: number | null) => void) => {
  snoozeListeners.add(callback);
  return () => snoozeListeners.delete(callback);
};

// Vibrate phone with pattern (respects snooze)
const vibratePattern = (pattern: number[]) => {
  if (soundsSnoozed) return; // Skip vibration when snoozed
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

const registerAudio = (key: string, audio: HTMLAudioElement) => {
  const set = activeAudios.get(key) ?? new Set<HTMLAudioElement>();
  set.add(audio);
  activeAudios.set(key, set);
};

const unregisterAudio = (key: string, audio: HTMLAudioElement) => {
  const set = activeAudios.get(key);
  if (!set) return;
  set.delete(audio);
  if (set.size === 0) activeAudios.delete(key);
};

// Play a sound file once
const playSound = (type: NotificationSoundType, key?: string): Promise<void> => {
  return new Promise((resolve) => {
    // Check if sounds are snoozed
    if (soundsSnoozed) {
      console.log(`🔕 Sound ${type} skipped - sounds are snoozed`);
      resolve();
      return;
    }

    // Check if this sound has been cancelled before playing
    if (key && cancelledSounds.has(key)) {
      console.log(`🔇 Sound ${key} was cancelled, skipping play`);
      resolve();
      return;
    }

    try {
      const audio = new Audio(SOUND_FILES[type]);
      audio.volume = 1.0;

      if (key) registerAudio(key, audio);

      const cleanup = () => {
        if (key) unregisterAudio(key, audio);
        resolve();
      };

      audio.onended = cleanup;
      audio.onerror = (e) => {
        console.error(`Error playing ${type} sound:`, e);
        cleanup();
      };

      audio.play().catch((error) => {
        console.error(`Failed to play ${type} sound:`, error);
        cleanup();
      });
    } catch (error) {
      console.error(`Error creating audio for ${type}:`, error);
      resolve();
    }
  });
};

// Play a sound N times with a small gap between plays
const playSoundNTimes = async (type: NotificationSoundType, times: number, key?: string, gapMs: number = 1500) => {
  for (let i = 0; i < times; i++) {
    // Check cancellation before each play
    if (key && cancelledSounds.has(key)) {
      console.log(`🔇 Sound ${key} was cancelled, stopping repeat sequence`);
      return;
    }
    await playSound(type, key);
    if (i < times - 1) {
      await new Promise(resolve => setTimeout(resolve, gapMs));
    }
  }
};

/**
 * Play new order sound - repeats 2x every 10 seconds until stopped
 * @param orderId - Unique identifier for the order
 * @returns Stop function to cancel the continuous sound
 */
export const playNewOrderSound = (orderId: string): (() => void) => {
  const key = `newOrder-${orderId}`;
  
  // Stop any existing interval for this order and clear cancellation flag
  stopSound(key);
  cancelledSounds.delete(key);
  
  console.log(`🔔 Starting NEW ORDER sound for ${orderId}`);
  vibratePattern([200, 100, 200]);
  
  // Play immediately
  playSoundNTimes('newOrder', 2, key);
  
  // Then repeat every 10 seconds
  const intervalId = setInterval(() => {
    if (cancelledSounds.has(key)) {
      clearInterval(intervalId);
      activeIntervals.delete(key);
      return;
    }
    console.log(`🔔 Repeating NEW ORDER sound for ${orderId}`);
    vibratePattern([200, 100, 200]);
    playSoundNTimes('newOrder', 2, key);
  }, 10000);
  
  activeIntervals.set(key, intervalId);
  
  return () => stopSound(key);
};

/**
 * Play new waitlist sound - repeats 2x once (no continuous loop)
 */
export const playNewWaitlistSound = async () => {
  console.log(`👥 Playing NEW WAITLIST sound`);
  vibratePattern([150, 100, 150]);
  await playSoundNTimes('newWaitlist', 2);
};

/**
 * Play patron arrived sound - repeats 2x once (no continuous loop)
 * For merchant when patron confirms arrival
 */
export const playPatronArrivedSound = async () => {
  console.log(`🚶 Playing PATRON ARRIVED sound`);
  vibratePattern([300, 150, 300]);
  await playSoundNTimes('patronArrived', 2);
};

/**
 * Play table ready sound - repeats 2x every 25 seconds until stopped
 * @param entryId - Unique identifier for the waitlist entry
 * @returns Stop function to cancel the continuous sound
 */
export const playTableReadySound = (entryId: string): (() => void) => {
  const key = `tableReady-${entryId}`;
  
  // Stop any existing interval for this entry and clear cancellation flag
  stopSound(key);
  cancelledSounds.delete(key);
  
  console.log(`🪑 Starting TABLE READY sound for ${entryId}`);
  vibratePattern([400, 150, 400]);
  
  // Play immediately
  playSoundNTimes('tableReady', 2, key);
  
  // Then repeat every 25 seconds
  const intervalId = setInterval(() => {
    if (cancelledSounds.has(key)) {
      clearInterval(intervalId);
      activeIntervals.delete(key);
      return;
    }
    console.log(`🪑 Repeating TABLE READY sound for ${entryId}`);
    vibratePattern([400, 150, 400]);
    playSoundNTimes('tableReady', 2, key);
  }, 25000);
  
  activeIntervals.set(key, intervalId);
  
  return () => stopSound(key);
};

/**
 * Play food ready sound - repeats 3x every 10 seconds until stopped
 * @param orderId - Unique identifier for the order
 * @returns Stop function to cancel the continuous sound
 */
export const playFoodReadySound = (orderId: string): (() => void) => {
  const key = `foodReady-${orderId}`;
  
  // Stop any existing interval for this order and clear cancellation flag
  stopSound(key);
  cancelledSounds.delete(key);
  
  console.log(`✅ Starting FOOD READY sound for ${orderId}`);
  vibratePattern([400, 150, 400]);
  
  // Play immediately (3 times)
  playSoundNTimes('foodReady', 3, key);
  
  // Then repeat every 10 seconds
  const intervalId = setInterval(() => {
    if (cancelledSounds.has(key)) {
      clearInterval(intervalId);
      activeIntervals.delete(key);
      return;
    }
    console.log(`✅ Repeating FOOD READY sound for ${orderId}`);
    vibratePattern([400, 150, 400]);
    playSoundNTimes('foodReady', 3, key);
  }, 10000);
  
  activeIntervals.set(key, intervalId);
  
  return () => stopSound(key);
};

/**
 * Play order due warning sound
 * Called at 1 min before, 30 sec before, then continuously every 10s when late
 * @param orderId - Unique identifier for the order
 * @param phase - 'oneMin' | 'thirtySec' | 'late'
 * @returns Stop function for late phase only
 */
export const playOrderDueSound = (orderId: string, phase: 'oneMin' | 'thirtySec' | 'late'): (() => void) | void => {
  console.log(`⏰ Playing ORDER DUE sound for ${orderId} - phase: ${phase}`);
  vibratePattern([300, 100, 300, 100, 300]);
  
  if (phase === 'oneMin' || phase === 'thirtySec') {
    // Single play for warning phases
    playSound('orderDue');
    return;
  }
  
  // Late phase - continuous every 10 seconds
  const key = `orderDue-${orderId}`;
  
  // Stop any existing interval for this order and clear cancellation flag
  stopSound(key);
  cancelledSounds.delete(key);
  
  // Play immediately
  playSound('orderDue', key);
  
  // Then repeat every 10 seconds
  const intervalId = setInterval(() => {
    if (cancelledSounds.has(key)) {
      clearInterval(intervalId);
      activeIntervals.delete(key);
      return;
    }
    console.log(`⏰ Repeating ORDER DUE (late) sound for ${orderId}`);
    vibratePattern([300, 100, 300, 100, 300]);
    playSound('orderDue', key);
  }, 10000);
  
  activeIntervals.set(key, intervalId);
  
  return () => stopSound(key);
};

/**
 * Stop a specific continuous sound by key
 * Marks the sound as cancelled to prevent queued plays
 */
export const stopSound = (key: string) => {
  // Add to cancelled set to stop any queued plays
  cancelledSounds.add(key);

  // Stop any in-progress audio immediately (prevents overlap/echo)
  const audios = activeAudios.get(key);
  if (audios) {
    audios.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    });
    activeAudios.delete(key);
  }

  const intervalId = activeIntervals.get(key);
  if (intervalId) {
    console.log(`🔇 Stopping sound: ${key}`);
    clearInterval(intervalId);
    activeIntervals.delete(key);
  }
};

/**
 * Stop all sounds for a specific type and ID
 */
export const stopSoundForId = (type: NotificationSoundType, id: string) => {
  const key = `${type}-${id}`;
  stopSound(key);
};

/**
 * Stop all active continuous sounds
 */
export const stopAllSounds = () => {
  console.log(`🔇 Stopping all ${activeIntervals.size} active sounds`);
  activeIntervals.forEach((intervalId, key) => {
    cancelledSounds.add(key);
    clearInterval(intervalId);
  });
  activeIntervals.clear();
};

/**
 * Check if a sound is currently active
 */
export const isSoundActive = (type: NotificationSoundType, id: string): boolean => {
  const key = `${type}-${id}`;
  return activeIntervals.has(key) && !cancelledSounds.has(key);
};

// Initialize audio context on first user interaction (required by browsers)
export const initializeAudio = () => {
  // Pre-load audio files for faster playback
  Object.values(SOUND_FILES).forEach(src => {
    const audio = new Audio(src);
    audio.preload = 'auto';
  });
  console.log('🎵 Audio files pre-loaded');
};
