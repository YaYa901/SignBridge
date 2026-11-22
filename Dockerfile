FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 ENV=production DATABASE_PATH=/app/data/signbridge.db
WORKDIR /app/backend
COPY backend/requirements*.txt backend/requirements.lock ./
RUN pip install --no-cache-dir -r requirements.txt \
    && groupadd --gid 10001 signbridge \
    && useradd --uid 10001 --gid 10001 --no-create-home signbridge \
    && mkdir -p /app/data \
    && chown -R 10001:10001 /app
COPY --chown=10001:10001 backend/ ./
COPY --from=frontend --chown=10001:10001 /build/frontend/dist /app/frontend/dist
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
