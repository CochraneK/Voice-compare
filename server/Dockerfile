# 音色比对后端 — Docker 镜像
FROM python:3.11-slim

# librosa 读 wav 只需 libsndfile（无需 ffmpeg）
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制业务代码
COPY . .

# 云托管要求监听 9000
EXPOSE 9000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]