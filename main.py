# server/main.py
# FastAPI 服务：两步比对流程（咨询师 -> 来访者），内存态会话、不落盘
import os
import sys
import time
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from analyzer import analyze_audio

app = FastAPI(title="Voice Match API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SESSIONS = {}  # token -> {"embedding":..., "meta":..., "ts":...}
TTL = 300  # 秒


def _cleanup():
    now = time.time()
    for k in [k for k, v in SESSIONS.items() if now - v["ts"] > TTL]:
        SESSIONS.pop(k, None)


def _cosine(a, b):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


def _strip(res):
    r = dict(res)
    r.pop("embedding", None)
    return r


def _interpret(c, cli):
    g1 = "女声" if c["gender"] == "female" else "男声" if c["gender"] == "male" else "未知"
    g2 = "女声" if cli["gender"] == "female" else "男声" if cli["gender"] == "male" else "未知"
    sim = cli.get("similarity_percent", 0)
    band = "较高" if sim >= 70 else "中等" if sim >= 40 else "较低"
    lines = []
    lines.append(f"咨询师判定为{g1}（基频~{c['f0_median'] or '—'}Hz），来访者判定为{g2}（基频~{cli['f0_median'] or '—'}Hz）。")
    lines.append(f"两人音色相似度{sim}%，属于{band}水平。")
    if c["gender"] not in ("unknown",) and cli["gender"] not in ("unknown",) and c["gender"] != cli["gender"]:
        lines.append("二者性别音色差异明显，相似度更多反映语速、节奏与共鸣腔等跨性别共有特征。")
    else:
        lines.append("二者性别音色一致，相似度更能反映声道结构与发声习惯的接近程度。")
    lines.append("注：结果为声学特征辅助参考，不构成任何医学或专业诊断结论。")
    return "".join(lines)


@app.get("/health")
def health():
    return {"status": "ok", "librosa": __import__("analyzer").LIBROSA_OK}


@app.post("/api/analyze-step")
async def analyze_step(
    audio: UploadFile = File(...),
    category: str = Form(...),
    token: str = Form(""),
):
    data = await audio.read()
    if not data:
        return {"success": False, "message": "未收到音频"}

    try:
        res = analyze_audio(data)
    except ValueError as e:
        return {"success": False, "message": str(e)}

    if not token:
        tok = uuid.uuid4().hex
        _cleanup()
        SESSIONS[tok] = {"embedding": res["embedding"], "meta": _strip(res), "ts": time.time()}
        out = {"success": True, "step": "counselor", "token": tok}
        out.update(_strip(res))
        if "demo" in res:
            out["demo"] = True
        return out

    if token not in SESSIONS:
        return {"success": False, "message": "会话已失效，请重新录入咨询师音色"}

    counselor = SESSIONS.pop(token)  # 取出即删除，不留存
    sim = _cosine(counselor["embedding"], res["embedding"])
    sim_pct = int(max(0, min(100, round(sim * 100))))
    client_meta = _strip(res)
    client_meta["similarity_percent"] = sim_pct
    interpretation = _interpret(counselor["meta"], client_meta)

    out = {
        "success": True,
        "step": "result",
        "counselor": counselor["meta"],
        "client": client_meta,
        "similarity": round(sim, 4),
        "similarity_percent": sim_pct,
        "interpretation": interpretation,
    }
    if "demo" in res or "demo" in counselor["meta"]:
        out["demo"] = True
    return out


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=80)
