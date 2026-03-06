# Define base node image to build the React frontend
FROM node:20-alpine AS build-stage
WORKDIR /frontend

# Install dependencies and build
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV NODE_ENV=production
RUN npm run build

# Define Python image to serve the backend + frontend statically
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy built frontend assets from the node stage into the 'static' directory
COPY --from=build-stage /frontend/dist /app/static

# Ensure data directory exists for persistent SQLite database
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["sh", "-c", "if [ -f /app/secrets/cert.pem ] && [ -f /app/secrets/key.pem ]; then exec uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-certfile=/app/secrets/cert.pem --ssl-keyfile=/app/secrets/key.pem; else exec uvicorn main:app --host 0.0.0.0 --port 8000; fi"]
