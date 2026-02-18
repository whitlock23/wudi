import wave
import math
import struct
import random
import os

# Create sounds directory if not exists
os.makedirs("public/sounds", exist_ok=True)

SAMPLE_RATE = 44100

def generate_tone(freq, duration, volume=0.5):
    """Generate a sine wave tone."""
    n_samples = int(SAMPLE_RATE * duration)
    data = []
    for i in range(n_samples):
        val = volume * math.sin(2 * math.pi * freq * i / SAMPLE_RATE)
        data.append(int(val * 32767.0))
    return data

def generate_square(freq, duration, volume=0.5):
    """Generate a square wave tone (buzzer)."""
    n_samples = int(SAMPLE_RATE * duration)
    data = []
    for i in range(n_samples):
        phase = (freq * i / SAMPLE_RATE) % 1
        val = volume if phase < 0.5 else -volume
        data.append(int(val * 32767.0))
    return data

def generate_noise(duration, volume=0.5):
    """Generate white noise."""
    n_samples = int(SAMPLE_RATE * duration)
    data = []
    for i in range(n_samples):
        val = volume * (random.random() * 2 - 1)
        data.append(int(val * 32767.0))
    return data

def generate_sweep(start_freq, end_freq, duration, volume=0.5):
    """Generate a frequency sweep (chirp)."""
    n_samples = int(SAMPLE_RATE * duration)
    data = []
    for i in range(n_samples):
        # Linear sweep
        t = i / SAMPLE_RATE
        freq = start_freq + (end_freq - start_freq) * (t / duration)
        # Integrate frequency to get phase
        phase = 2 * math.pi * (start_freq * t + 0.5 * (end_freq - start_freq) * t**2 / duration)
        val = volume * math.sin(phase)
        data.append(int(val * 32767.0))
    return data

def save_wav(filename, data):
    with wave.open(filename, 'w') as f:
        f.setnchannels(1) # Mono
        f.setsampwidth(2) # 16-bit
        f.setframerate(SAMPLE_RATE)
        for sample in data:
            f.writeframes(struct.pack('<h', sample))
    print(f"Generated: {filename}")

# 1. Play Card (Short High Tone)
play_data = generate_tone(880, 0.1, 0.6) # A5
save_wav("public/sounds/play.wav", play_data)

# 2. Pass (Short Low Tone)
pass_data = generate_tone(220, 0.15, 0.6) # A3
save_wav("public/sounds/pass.wav", pass_data)

# 3. Click (Very Short High Tone)
click_data = generate_tone(1500, 0.03, 0.3)
save_wav("public/sounds/click.wav", click_data)

# 4. Start Game (Rising Sweep)
start_data = generate_sweep(440, 880, 0.5, 0.5)
save_wav("public/sounds/start.wav", start_data)

# 5. Win (Major Arpeggio C-E-G-C)
win_data = []
win_data.extend(generate_tone(523.25, 0.15, 0.6)) # C5
win_data.extend(generate_tone(659.25, 0.15, 0.6)) # E5
win_data.extend(generate_tone(783.99, 0.15, 0.6)) # G5
win_data.extend(generate_tone(1046.50, 0.4, 0.6)) # C6
save_wav("public/sounds/win.wav", win_data)

# 6. Lose (Minor Descending)
lose_data = []
lose_data.extend(generate_tone(783.99, 0.2, 0.6)) # G5
lose_data.extend(generate_tone(622.25, 0.2, 0.6)) # Eb5
lose_data.extend(generate_tone(523.25, 0.4, 0.6)) # C5
save_wav("public/sounds/lose.wav", lose_data)

# 7. Alert (Two-tone Siren)
alert_data = []
for _ in range(3):
    alert_data.extend(generate_tone(800, 0.1, 0.5))
    alert_data.extend(generate_tone(600, 0.1, 0.5))
save_wav("public/sounds/alert.wav", alert_data)

# 8. Error (Buzzer)
error_data = generate_square(150, 0.3, 0.5)
save_wav("public/sounds/error.wav", error_data)

# 9. Countdown (Tick)
countdown_data = generate_noise(0.05, 0.7)
save_wav("public/sounds/countdown.wav", countdown_data)
