FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn google-generativeai pydantic openai requests nats-py

COPY src/ .

EXPOSE 8000

CMD ["python", "nats_consumer.py"]
