// Simple audio utility
// In a real app, you would use a library like Howler.js for better cross-browser support and preloading.
// For now, we use the native HTML5 Audio API.

// Sound effect types
export type SoundType = 'play' | 'pass' | 'win' | 'lose' | 'alert' | 'start' | 'click' | 'error' | 'countdown';

// Map sound types to file paths
// Note: You need to add these files to your public/sounds directory
const SOUND_FILES: Record<SoundType, string> = {
    play: '/sounds/play.wav',
    pass: '/sounds/pass.wav',
    win: '/sounds/win.wav',
    lose: '/sounds/lose.wav',
    alert: '/sounds/alert.wav',
    start: '/sounds/start.wav',
    click: '/sounds/click.wav',
    error: '/sounds/error.wav',
    countdown: '/sounds/countdown.wav'
};

// Cache audio objects to avoid recreating them
const audioCache: Partial<Record<SoundType, HTMLAudioElement>> = {};

// Preload sounds
export const preloadSounds = () => {
    Object.entries(SOUND_FILES).forEach(([type, src]) => {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audioCache[type as SoundType] = audio;
    });
};

export const playSound = (type: SoundType, volume = 0.5) => {
    try {
        let audio = audioCache[type];
        
        // Create if not cached
        if (!audio) {
            audio = new Audio(SOUND_FILES[type]);
            // Add error handling
            audio.onerror = (e) => {
                console.warn(`[Audio] Failed to load sound: ${type}`, e);
            };
            audioCache[type] = audio;
        }
        
        // Reset to start (allows rapid replay)
        audio.currentTime = 0;
        audio.volume = volume;
        
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Auto-play was prevented
                console.warn(`[Audio] Play failed for ${type}:`, error);
            });
        }
    } catch (err) {
        console.error(`Error playing sound ${type}:`, err);
    }
};
