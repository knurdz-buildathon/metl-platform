FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y git nodejs npm default-jre curl

RUN pip install --no-cache-dir requests nats-py && \
    npm install -g sonarqube-scanner deepsec

COPY src/ .

CMD ["python", "nats_consumer.py"]
