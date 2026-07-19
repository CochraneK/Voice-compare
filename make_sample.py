# server/make_sample.py
# 生成两段测试用 wav（不同基频，模拟女声/男声），用于冒烟测试
import wave
import numpy as np


def write_wav(path, freq, dur=3.0, sr=16000):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    y = (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * 2 * freq * t)) * 0.4
    y = (y * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(y.tobytes())


if __name__ == "__main__":
    write_wav("counselor.wav", 220)
    write_wav("client.wav", 120)
    print("sample wav written: counselor.wav (220Hz), client.wav (120Hz)")
