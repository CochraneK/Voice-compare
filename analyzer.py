# server/analyzer.py
# 轻量声纹分析：MFCC 统计量向量做余弦相似度 + 基频 F0 判性别
# 仅依赖 librosa / numpy；若 librosa 不可用则回退 demo（保证服务可起、契约可测）
import io
import numpy as np

LIBROSA_OK = False
try:
    import librosa
    LIBROSA_OK = True
except Exception as e:  # pragma: no cover
    print("[analyzer] librosa 不可用，启用 demo 模式:", e)


def _load_audio(data: bytes, sr=16000):
    y, _ = librosa.load(io.BytesIO(data), sr=sr, mono=True)
    return y


def _embedding(y, sr=16000, n_mfcc=20):
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc, n_fft=512, hop_length=160)
    mean = mfcc.mean(axis=1)
    std = mfcc.std(axis=1)
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr).mean(axis=1)
    vec = np.concatenate([mean, std, contrast]).astype(np.float32)
    vec = (vec - vec.mean()) / (vec.std() + 1e-8)
    return vec


def _f0(y, sr=16000):
    fmin = librosa.note_to_hz("C2")
    fmax = librosa.note_to_hz("C7")
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=fmin, fmax=fmax, sr=sr, frame_length=1024, hop_length=160
    )
    voiced = f0[voiced_flag]
    return f0, voiced


def _gender(y, sr=16000):
    _, voiced = _f0(y, sr)
    if len(voiced) == 0:
        return "unknown", 0.0, None
    median = float(np.median(voiced))
    if median < 180:
        gender = "male"
        conf = float(np.clip(0.5 + (180 - median) / 100, 0.5, 0.98))
    else:
        gender = "female"
        conf = float(np.clip(0.5 + (median - 180) / 100, 0.5, 0.98))
    return gender, conf, median


def _waveform(y, n=80):
    if len(y) == 0:
        return [0.0] * n
    idx = np.linspace(0, len(y) - 1, n).astype(int)
    env = np.abs(y[idx])
    m = float(env.max()) + 1e-8
    return (env / m).round(4).tolist()


def _pitch(y, sr=16000, n=80):
    f0, _ = _f0(y, sr)
    if len(f0) == 0:
        return [0.0] * n
    xs = np.linspace(0, len(f0) - 1, n)
    curve = np.interp(xs, np.arange(len(f0)), f0)
    curve = np.nan_to_num(curve)
    voiced_mask = np.interp(xs, np.arange(len(f0)), (f0 > 0).astype(float))
    curve = np.where(voiced_mask > 0.5, curve, 0.0)
    mx = float(np.max(curve)) + 1e-8
    return (curve / mx).round(4).tolist()


def analyze_audio(data: bytes) -> dict:
    if not LIBROSA_OK:  # pragma: no cover
        return _demo(data)
    y = _load_audio(data)
    if len(y) < 16000 * 0.5:
        raise ValueError("音频过短，请录制至少 1 秒")
    vec = _embedding(y)
    gender, conf, median = _gender(y)
    return {
        "embedding": vec,
        "gender": gender,
        "gender_conf": round(conf, 2),
        "f0_median": round(median, 1) if median else None,
        "waveform": _waveform(y),
        "pitch": _pitch(y),
    }


def _demo(data: bytes):  # pragma: no cover
    import hashlib

    h = int(hashlib.md5(data).hexdigest(), 16)
    rng = np.random.default_rng(h)
    vec = rng.standard_normal(60).astype(np.float32)
    gender = "female" if h % 2 == 0 else "male"
    median = 210.0 if gender == "female" else 120.0
    return {
        "embedding": vec,
        "gender": gender,
        "gender_conf": 0.8,
        "f0_median": median,
        "waveform": rng.random(80).round(4).tolist(),
        "pitch": (rng.random(80) * 0.6 + 0.2).round(4).tolist(),
        "demo": True,
    }
