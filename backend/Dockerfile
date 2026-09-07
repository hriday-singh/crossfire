FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (useful for some pdf/image parsing libs like onnxruntime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Store sqlite db in /app/data so it can be mounted as a volume
ENV SQLITE_DB_PATH=/app/data/crossfire.db
ENV PORT=8000

RUN mkdir -p /app/data && chown -R nobody:nogroup /app/data

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
