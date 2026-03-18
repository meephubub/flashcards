
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

RUN useradd -m appuser
USER appuser

# Render injects $PORT at runtime — the app reads it automatically
EXPOSE 8080

# Long-running HTTP server (not a one-shot script)
CMD ["python", "main.py"]
