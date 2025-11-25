// Uber-style notification sounds using Web Audio API

export type NotificationSoundType = 
  | 'orderReady'      // For patrons - your order is ready!
  | 'tableReady'      // For patrons - your table is ready!
  | 'newOrder'        // For kitchen - new order came in
  | 'newWaitlist'     // For merchant - new waitlist entry
  | 'urgent';         // For urgent alerts

let audioContext: AudioContext | null = null;

// Initialize audio context on first user interaction
const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Generate a tone at a specific frequency
const playTone = (frequency: number, duration: number, volume: number = 0.8): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);

      setTimeout(() => resolve(), duration * 1000);
    } catch (error) {
      console.error('Error playing tone:', error);
      resolve();
    }
  });
};

// Play a sequence of tones
const playSequence = async (frequencies: number[], duration: number, gap: number, volume: number = 0.8) => {
  for (const freq of frequencies) {
    await playTone(freq, duration, volume);
    if (gap > 0) {
      await new Promise(resolve => setTimeout(resolve, gap));
    }
  }
};

// Vibrate phone with pattern
const vibratePattern = (pattern: number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Main notification sound player
export const playNotificationSound = async (type: NotificationSoundType, repeat: number = 1) => {
  console.log(`Playing notification sound: ${type}, repeat: ${repeat}`);

  try {
    // Ensure audio context is initialized
    getAudioContext();

    for (let i = 0; i < repeat; i++) {
      switch (type) {
        case 'orderReady':
          // 3-note ascending chime (C5→E5→G5) - exciting and positive
          await playSequence([523, 659, 784], 0.2, 50, 0.9);
          vibratePattern([500, 200, 500]);
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 500));
          break;

        case 'tableReady':
          // 3-note ascending chime (G4→C5→E5) - welcoming
          await playSequence([392, 523, 659], 0.2, 50, 0.9);
          vibratePattern([500, 200, 500]);
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 500));
          break;

        case 'newOrder':
          // 2-tone alert (A5→A5) - urgent beep-beep
          await playSequence([880, 880], 0.3, 100, 1.0);
          vibratePattern([200, 100, 200]);
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 400));
          break;

        case 'newWaitlist':
          // 2-tone alert (G5→G5) - attention grabbing
          await playSequence([784, 784], 0.3, 100, 0.95);
          vibratePattern([200, 100, 200]);
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 400));
          break;

        case 'urgent':
          // Rapid 3-tone alarm
          await playSequence([1000, 800, 1000], 0.2, 50, 1.0);
          vibratePattern([300, 100, 300, 100, 300]);
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 300));
          break;
      }
    }
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

// Initialize audio context on first user interaction (required by browsers)
export const initializeAudio = () => {
  try {
    getAudioContext();
    console.log('Audio context initialized');
  } catch (error) {
    console.error('Failed to initialize audio context:', error);
  }
};
