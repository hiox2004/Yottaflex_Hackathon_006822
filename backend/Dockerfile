FROM python:3.12-slim

WORKDIR /app

# Install dependencies from lockfile
COPY backend/requirements.lock /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.lock

# Copy application, database schema and data
COPY backend /app/backend
COPY database /app/database
COPY data /app/data

# Install package in editable/link mode
RUN pip install --no-cache-dir -e /app/backend --no-deps

WORKDIR /app/backend

EXPOSE 8000

CMD ["sh", "-c", "python -m integrity.cli load --scale full && uvicorn integrity.main:app --host 0.0.0.0 --port 8000"]
