# 老友时光数据工厂 —— 微信云托管（CloudBase Run）容器镜像
# 在云开发控制台「云托管」→ 新建服务 → 上传本目录（或绑定 GitHub）即可部署
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# 云托管默认监听 80 端口（可在服务设置里改）
ENV PORT=80
EXPOSE 80

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
