# Build from repository ROOT:  docker build -f backend/Dockerfile .
# Railway: leave "Root Directory" empty (monorepo root). Do NOT set it to `backend`
# or COPY paths will fail.
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
EXPOSE 8000
CMD ["sh", "-c", "exec python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
