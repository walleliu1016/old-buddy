# 老友时光数据工厂 —— 微信云托管（CloudBase Run）容器镜像
# 部署：微信云托管控制台 → 服务列表 → 新建服务 → 上传本目录（或绑定 GitHub 自动构建）
FROM python:3.11-slim

# 容器默认时区为 UTC，与上海时间差 8 小时；
# 数据工厂含「今日/本周」等时间语义，必须校正时区
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Shanghai

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# 云托管控制台固定监听 80 端口，Dockerfile 必须与之保持一致
ENV PORT=80
EXPOSE 80

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

