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

// Track ALL currently playing audio elements (including one-off sounds without a key)
const allActiveAudios: Set<HTMLAudioElement> = new Set();

// Snooze state management
let soundsSnoozed = false;
let snoozeTimeout: NodeJS.Timeout | null = null;
let snoozeEndTime: number | null = null;
const snoozeListeners: Set<(snoozed: boolean, remainingMs: number | null) => void> = new Set();

// Keep snooze state on globalThis so it survives Vite HMR and also applies to any
// legacy intervals/callbacks that may still be running.
const SNOOZE_FLAG_KEY = "__lovable_sounds_snoozed__";
const SNOOZE_END_KEY = "__lovable_sounds_snooze_end__";
const PLAY_PATCH_KEY = "__lovable_sounds_play_patched__";
const GLOBAL_AUDIO_SET_KEY = "__lovable_active_audio_elements__";
const SNOOZE_ENFORCER_KEY = "__lovable_snooze_enforcer_interval__";
const FORCE_MUTE_KEY = "__lovable_sounds_force_mute__";
const SNOOZE_STORAGE_KEY = "__lovable_sounds_snooze_state_v1__";
const STORAGE_LISTENER_KEY = "__lovable_sounds_storage_listener__";

const getGlobalSnoozed = (): boolean => (globalThis as any)[SNOOZE_FLAG_KEY] === true;
const setGlobalSnoozed = (value: boolean) => {
  (globalThis as any)[SNOOZE_FLAG_KEY] = value;
  soundsSnoozed = value;
};

const getForceMute = (): boolean => (globalThis as any)[FORCE_MUTE_KEY] === true;
const setForceMute = (value: boolean) => {
  (globalThis as any)[FORCE_MUTE_KEY] = value;
};
const getGlobalSnoozeEnd = (): number | null => {
  const v = (globalThis as any)[SNOOZE_END_KEY];
  return typeof v === "number" ? v : null;
};
const setGlobalSnoozeEnd = (value: number | null) => {
  (globalThis as any)[SNOOZE_END_KEY] = value;
  snoozeEndTime = value;
};

const getGlobalAudioSet = (): Set<HTMLMediaElement> => {
  const existing = (globalThis as any)[GLOBAL_AUDIO_SET_KEY];
  if (existing && existing instanceof Set) return existing as Set<HTMLMediaElement>;
  const created = new Set<HTMLMediaElement>();
  (globalThis as any)[GLOBAL_AUDIO_SET_KEY] = created;
  return created;
};

const clearSnoozeEnforcer = () => {
  const existing = (globalThis as any)[SNOOZE_ENFORCER_KEY];
  if (existing) {
    clearInterval(existing);
    (globalThis as any)[SNOOZE_ENFORCER_KEY] = null;
  }
};

const clearLocalSnoozeTimeout = () => {
  if (snoozeTimeout) {
    clearTimeout(snoozeTimeout);
    snoozeTimeout = null;
  }
};

const restoreNotificationAudioDefaults = () => {
  // If any old audio elements were muted during snooze, make sure they can play again.
  // (We only touch our /sounds/ audio.)
  const set = getGlobalAudioSet();
  set.forEach((el) => {
    try {
      const src = (el as any).currentSrc || (el as any).src;
      if (typeof src !== "string" || !src.includes("/sounds/")) return;
      (el as any).muted = false;
      // If volume was forced to 0 during snooze, restore to full volume.
      // Our playSound() also sets volume per play, so this is mainly defensive.
      (el as any).volume = 1;
    } catch {
      // ignore
    }
  });
};

const writeSnoozeToStorage = (snoozed: boolean, end: number | null) => {
  try {
    if (!snoozed || !end) {
      localStorage.removeItem(SNOOZE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      SNOOZE_STORAGE_KEY,
      JSON.stringify({ snoozed: true, end })
    );
  } catch {
    // ignore (storage may be blocked)
  }
};

const readSnoozeFromStorage = (): { snoozed: boolean; end: number | null } | null => {
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const end = typeof parsed?.end === "number" ? parsed.end : null;
    const snoozed = parsed?.snoozed === true && !!end && end > Date.now();
    return { snoozed, end: snoozed ? end : null };
  } catch {
    return null;
  }
};

// Initialize local state from global (important after HMR)
soundsSnoozed = getGlobalSnoozed();
snoozeEndTime = getGlobalSnoozeEnd();

const applySnoozeState = (snoozed: boolean, end: number | null, persist: boolean) => {
  // Keep global flags in sync for stale closures + HMR.
  setForceMute(snoozed);
  setGlobalSnoozed(snoozed);
  setGlobalSnoozeEnd(snoozed ? end : null);

  if (snoozed && end) {
    // Stop immediately in *this* tab.
    stopAllCurrentlyPlayingAudio();
    stopAllGlobalAudio();
    startSnoozeEnforcer();

    // Make sure this tab also ends snooze at the right time.
    clearLocalSnoozeTimeout();
    const ms = Math.max(0, end - Date.now());
    snoozeTimeout = setTimeout(() => {
      applySnoozeState(false, null, true);
      console.log(`🔔 Snooze ended - sounds re-enabled`);
      notifySnoozeListeners();
    }, ms);
  } else {
    clearLocalSnoozeTimeout();
    clearSnoozeEnforcer();
    restoreNotificationAudioDefaults();
  }

  if (persist) writeSnoozeToStorage(snoozed, snoozed ? end : null);
};

// Cross-tab sync: if another tab snoozes, this tab must mute too.
if (typeof window !== "undefined" && (globalThis as any)[STORAGE_LISTENER_KEY] !== true) {
  (globalThis as any)[STORAGE_LISTENER_KEY] = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== SNOOZE_STORAGE_KEY) return;
    const state = readSnoozeFromStorage();
    applySnoozeState(state?.snoozed === true, state?.end ?? null, false);
    notifySnoozeListeners();
  });
}

// If another tab already snoozed before this module loaded, honor it.
const existingCrossTab = typeof window !== "undefined" ? readSnoozeFromStorage() : null;
if (existingCrossTab?.snoozed && existingCrossTab.end) {
  applySnoozeState(true, existingCrossTab.end, false);
  notifySnoozeListeners();
}

// Patch media playback so that any Audio created anywhere in the app (including
// stale HMR closures) cannot play our notification MP3s while snoozed.
if ((globalThis as any)[PLAY_PATCH_KEY] !== true && typeof HTMLMediaElement !== "undefined") {
  (globalThis as any)[PLAY_PATCH_KEY] = true;
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args: any[]) {
    try {
      // Track any media element that attempts to play so we can silence it on snooze.
      getGlobalAudioSet().add(this as unknown as HTMLMediaElement);

      const src = (this as any).currentSrc || (this as any).src;
      // During snooze we enforce a hard mute for our notification MP3s.
      // This avoids race conditions where a sound starts in the same tick as snooze.
      if ((getGlobalSnoozed() || getForceMute()) && typeof src === "string" && src.includes("/sounds/")) {
        try {
          // Mute first (instant), then pause/reset.
          (this as any).muted = true;
          (this as any).volume = 0;
          (this as any).pause?.();
          (this as any).currentTime = 0;
        } catch {
          // ignore
        }
        return Promise.resolve();
      }
    } catch {
      // ignore
    }
    return originalPlay.apply(this, args as any);
  };
}

function notifySnoozeListeners() {
  const remaining = snoozeEndTime ? Math.max(0, snoozeEndTime - Date.now()) : null;
  snoozeListeners.forEach((listener) => listener(soundsSnoozed, remaining));
}

// Immediately silence any in-progress audio (does not cancel intervals; just stops current playback)
const stopAllCurrentlyPlayingAudio = () => {
  // Stop audio tracked globally (includes one-off sounds)
  let stoppedCount = 0;
  allActiveAudios.forEach((audio) => {
    try {
      // Mute immediately (helps on Safari/Chrome edge cases)
      audio.muted = true;
      audio.volume = 0;
      audio.pause();
      audio.currentTime = 0;
      stoppedCount++;
    } catch {
      // ignore
    }
  });

  // Also stop any audio tracked by keyed sounds (covers the case where HMR updated
  // playSound tracking while previously created audio instances are only in activeAudios)
  activeAudios.forEach((audios) => {
    audios.forEach((audio) => {
      try {
        audio.muted = true;
        audio.volume = 0;
        audio.pause();
        audio.currentTime = 0;
        stoppedCount++;
      } catch {
        // ignore
      }
    });
  });

  console.log(`🔕 Snooze: stopped ${stoppedCount} in-progress audio instance(s)`);
  allActiveAudios.clear();
  activeAudios.clear();
};

// Hard stop for any audio elements that ever attempted to play (across HMR instances)
const stopAllGlobalAudio = () => {
  const set = getGlobalAudioSet();
  let stopped = 0;
  set.forEach((el) => {
    try {
      const src = (el as any).currentSrc || (el as any).src;
      // Only affect our notification sounds.
      if (typeof src !== "string" || !src.includes("/sounds/")) return;
      // Mute first, then pause/reset.
      (el as any).muted = true;
      (el as any).volume = 0;
      el.pause?.();
      el.currentTime = 0;
      stopped++;
    } catch {
      // ignore
    }
  });
  // Keep the set around; new audio elements will be added over time.
  console.log(`🔕 Snooze: globally stopped ${stopped} media element(s)`);
};

const startSnoozeEnforcer = () => {
  clearSnoozeEnforcer();
  // While snoozed, keep silencing any notification audio that attempts to play.
  (globalThis as any)[SNOOZE_ENFORCER_KEY] = setInterval(() => {
    if (!getGlobalSnoozed()) return;
    stopAllGlobalAudio();
  }, 250);
};

/**
 * Snooze all sounds for a specified duration in minutes
 */
export const snoozeSounds = (durationMinutes: number) => {
  const end = Date.now() + durationMinutes * 60 * 1000;
  applySnoozeState(true, end, true);
  console.log(`🔕 Sounds snoozed for ${durationMinutes} minutes`);
  notifySnoozeListeners();
};

/**
 * Cancel snooze and re-enable sounds immediately
 */
export const cancelSnooze = () => {
  applySnoozeState(false, null, true);
  console.log(`🔔 Snooze cancelled - sounds re-enabled`);
  notifySnoozeListeners();
};

/**
 * Check if sounds are currently snoozed
 */
export const isSnoozed = (): boolean => getGlobalSnoozed();

/**
 * Get remaining snooze time in milliseconds
 */
export const getSnoozeRemaining = (): number | null => {
  const end = getGlobalSnoozeEnd();
  if (!end) return null;
  const remaining = end - Date.now();
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
  if (getGlobalSnoozed()) return; // Skip vibration when snoozed
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
    if (getGlobalSnoozed() || getForceMute()) {
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
      // Even if snooze flips between check and play(), this ensures silence.
      if (getGlobalSnoozed() || getForceMute()) {
        audio.muted = true;
        audio.volume = 0;
      } else {
        audio.volume = 1.0;
      }

      // Track one-off + keyed sounds so snooze can immediately silence any in-progress playback.
      allActiveAudios.add(audio);

      if (key) registerAudio(key, audio);

      const cleanup = () => {
        allActiveAudios.delete(audio);
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
