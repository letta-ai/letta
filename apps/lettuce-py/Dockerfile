# Use re-tagged memgpt-server image built locally as a required dependency
FROM memgpt-server-local:latest AS runtime

# Set working directory for lettuce-py
WORKDIR /app/lettuce-py

# The base image already has Python 3.11 and virtual environment set up
# We just need to install temporalio in the existing virtual environment
RUN . /app/.venv/bin/activate && pip install --no-cache-dir temporalio

# Copy application code and startup script
COPY worker.py ./
COPY startup.sh .

# Make startup script executable
RUN chmod +x startup.sh

# Set Python to run in unbuffered mode
ENV PYTHONUNBUFFERED=1

# Use the startup script as entrypoint, default to running both services
ENTRYPOINT ["/app/lettuce-py/startup.sh"]
