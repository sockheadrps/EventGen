FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# We use 0.0.0.0 so it's reachable outside the container
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]