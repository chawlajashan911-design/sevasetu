# ─── Stage 1: Build React Frontend ───────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies with npm ci for deterministic builds
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source files and compile Vite SPA
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Python Backend & Unified Production Runner ─────────────────────
FROM python:3.11-slim AS runner
WORKDIR /app

# Prevent Python from writing .pyc files and buffer stdout/stderr for real-time logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install runtime OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend Python requirements
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend application source
COPY backend/ /app/backend/

# Copy compiled frontend distribution from builder stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose default port (Render will dynamically supply $PORT at runtime)
EXPOSE 8000

# Start Uvicorn bound to 0.0.0.0 and dynamically assigned PORT
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
