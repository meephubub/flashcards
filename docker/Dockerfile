FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY app.log .

RUN useradd -m appuser

# ✅ Fix permissions BEFORE switching user
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["python", "main.py"]
