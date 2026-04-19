# Same as backend/Dockerfile — kept for: docker build -f Dockerfile .
# Prefer backend/Dockerfile + railway.json for Railway deploys.
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
EXPOSE 8000
# Use python -m uvicorn so PATH is reliable; PORT is always set by Railway.
CMD ["sh", "-c", "exec python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
