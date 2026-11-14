FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies from lockfile
COPY backend/requirements.lock /app/backend/
RUN pip install -r /app/backend/requirements.lock

# Copy application, database schema and data (the backend reads data/ at runtime: REPO_ROOT is /app)
COPY backend /app/backend
COPY database /app/database
COPY data /app/data

# Install package in editable/link mode, then run as an unprivileged user that owns only the data folder
RUN pip install -e /app/backend --no-deps \
 && useradd --create-home --uid 10001 app \
 && chown -R app:app /app/data

WORKDIR /app/backend
USER app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=120s --retries=12 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"]

# bootstrap is idempotent: it generates data/full (seed 20261022) only if missing and loads the
# database only when it is empty, so a normal restart keeps the existing data.
CMD ["sh", "-c", "python -m integrity.cli bootstrap --scale full && uvicorn integrity.main:app --host 0.0.0.0 --port 8000"]
