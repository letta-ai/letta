# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install the Temporal Python SDK dependency
RUN pip install --no-cache-dir temporalio

# Copy application code
COPY worker.py .

# Set Python to run in unbuffered mode
ENV PYTHONUNBUFFERED=1

# Run the worker
CMD ["python", "worker.py"]
