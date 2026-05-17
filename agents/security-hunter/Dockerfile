FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git nodejs npm default-jre curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir requests nats-py && \
    npm install -g sonarqube-scanner deepsec

# Build context is monorepo root (../metl-platform)
COPY agents/security-hunter/src/ .

CMD ["python", "nats_consumer.py"]
