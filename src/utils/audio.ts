// Simple audio utility
// In a real app, you would use a library like Howler.js for better cross-browser support and preloading.
// For now, we use the native HTML5 Audio API.

// Sound effect types
export type SoundType = 'play' | 'pass' | 'win' | 'lose' | 'alert';

// Map sound types to file paths
// Note: You need to add these files to your public/sounds directory
const SOUND_FILES: Record<SoundType, string> = {
    play: '/sounds/play.mp3',
    pass: '/sounds/pass.mp3',
    win: '/sounds/win.mp3',
    lose: '/sounds/lose.mp3',
    alert: '/sounds/alert.mp3'
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
            audioCache[type] = audio;
        }
        
        // Reset to start (allows rapid replay)
        audio.currentTime = 0;
        audio.volume = volume;
        
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Auto-play was prevented
                // console.warn(`Audio play failed for ${type}:`, error);
            });
        }
    } catch (err) {
        console.error(`Error playing sound ${type}:`, err);
    }
};
