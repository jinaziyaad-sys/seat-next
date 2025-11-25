// Rich, musical notification sounds using Web Audio API with ADSR envelopes and harmonics

export type NotificationSoundType = 
  | 'orderReady'      // For patrons - your order is ready!
  | 'tableReady'      // For patrons - your table is ready!
  | 'newOrder'        // For kitchen - new order came in (bright doorbell)
  | 'newWaitlist'     // For merchant - new waitlist entry (soft chime)
  | 'urgent';         // For urgent alerts

let audioContext: AudioContext | null = null;

// Initialize audio context on first user interaction
const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Play a rich tone with ADSR envelope and harmonics
const playRichTone = (
  frequency: number, 
  duration: number, 
  volume: number = 0.8,
  waveType: OscillatorType = 'triangle'
): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      // Create multiple oscillators for richness
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = waveType;
      osc2.type = 'sine';
      osc2.detune.value = 5; // Slight detune for warmth
      
      osc1.frequency.value = frequency;
      osc2.frequency.value = frequency * 2; // Add harmonic
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // ADSR Envelope (Attack, Decay, Sustain, Release)
      const attackTime = 0.02;
      const decayTime = 0.1;
      const sustainLevel = volume * 0.7;
      const releaseTime = 0.15;
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + attackTime); // Attack
      gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime); // Decay
      gainNode.gain.setValueAtTime(sustainLevel, now + duration - releaseTime); // Sustain
      gainNode.gain.linearRampToValueAtTime(0, now + duration); // Release
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
      
      setTimeout(() => resolve(), duration * 1000);
    } catch (error) {
      console.error('Error playing rich tone:', error);
      resolve();
    }
  });
};

// Play a chord (multiple notes simultaneously)
const playChord = async (frequencies: number[], duration: number, volume: number = 0.8) => {
  const promises = frequencies.map(freq => playRichTone(freq, duration, volume * 0.5, 'triangle'));
  await Promise.all(promises);
};

// Vibrate phone with pattern
const vibratePattern = (pattern: number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// New Order Sound - Bright doorbell chime (C5→E5→G5→C6)
const playNewOrderSound = async () => {
  console.log('🍽️ Playing NEW ORDER sound (bright doorbell)');
  await playRichTone(523, 0.25, 0.9, 'triangle');  // C5
  await new Promise(resolve => setTimeout(resolve, 30));
  await playRichTone(659, 0.25, 0.9, 'triangle');  // E5
  await new Promise(resolve => setTimeout(resolve, 30));
  await playRichTone(784, 0.25, 0.9, 'triangle');  // G5
  await new Promise(resolve => setTimeout(resolve, 30));
  await playRichTone(1047, 0.35, 1.0, 'triangle'); // C6 (emphasized)
  vibratePattern([200, 100, 200]);
};

// New Waitlist Sound - Soft welcoming chime (G4→D5)
const playNewWaitlistSound = async () => {
  console.log('👥 Playing NEW WAITLIST sound (soft chime)');
  await playRichTone(392, 0.3, 0.75, 'sine');  // G4
  await new Promise(resolve => setTimeout(resolve, 50));
  await playRichTone(587, 0.4, 0.8, 'sine');   // D5 (perfect 5th)
  vibratePattern([150, 100, 150]);
};

// Order Ready Sound - Triumphant fanfare (C5→G5→C6 with harmony)
const playOrderReadySound = async () => {
  console.log('✅ Playing ORDER READY sound (triumphant)');
  await playChord([523, 659], 0.3, 0.85);  // C5 + E5
  await new Promise(resolve => setTimeout(resolve, 50));
  await playChord([784, 988], 0.3, 0.9);   // G5 + B5
  await new Promise(resolve => setTimeout(resolve, 50));
  await playChord([1047, 1319], 0.4, 1.0); // C6 + E6
  vibratePattern([400, 150, 400]);
};

// Table Ready Sound - Warm inviting chime (E4→A4→E5)
const playTableReadySound = async () => {
  console.log('🪑 Playing TABLE READY sound (warm invitation)');
  await playRichTone(330, 0.3, 0.8, 'triangle');  // E4
  await new Promise(resolve => setTimeout(resolve, 60));
  await playRichTone(440, 0.3, 0.85, 'triangle'); // A4
  await new Promise(resolve => setTimeout(resolve, 60));
  await playRichTone(659, 0.4, 0.9, 'triangle');  // E5
  vibratePattern([400, 150, 400]);
};

// Urgent Sound - Rapid alarm
const playUrgentSound = async () => {
  console.log('⚠️ Playing URGENT sound');
  await playRichTone(1000, 0.2, 1.0, 'square');
  await new Promise(resolve => setTimeout(resolve, 50));
  await playRichTone(800, 0.2, 1.0, 'square');
  await new Promise(resolve => setTimeout(resolve, 50));
  await playRichTone(1000, 0.2, 1.0, 'square');
  vibratePattern([300, 100, 300, 100, 300]);
};

// Main notification sound player
export const playNotificationSound = async (type: NotificationSoundType, repeat: number = 1) => {
  console.log(`🔊 Playing notification: ${type} (${repeat}x)`);

  try {
    getAudioContext();

    for (let i = 0; i < repeat; i++) {
      switch (type) {
        case 'newOrder':
          await playNewOrderSound();
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 400));
          break;

        case 'newWaitlist':
          await playNewWaitlistSound();
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 400));
          break;

        case 'orderReady':
          await playOrderReadySound();
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 500));
          break;

        case 'tableReady':
          await playTableReadySound();
          if (i < repeat - 1) await new Promise(resolve => setTimeout(resolve, 500));
          break;

        case 'urgent':
          await playUrgentSound();
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
    console.log('🎵 Audio context initialized');
  } catch (error) {
    console.error('Failed to initialize audio context:', error);
  }
};
