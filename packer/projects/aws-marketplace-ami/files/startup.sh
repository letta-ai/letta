#!/bin/bash
# Startup script for Letta AWS Marketplace AMI (Containerized)
# This script runs on first boot to initialize all containerized services

set -e

LOG_FILE="/var/log/letta-startup.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

cleanup() {
    log "Startup script completed with exit code $?"
}

trap cleanup EXIT

log "Starting Letta AWS Marketplace AMI (Containerized) initialization..."

# Wait for system to be fully ready
sleep 10

# Ensure Docker is running
log "Ensuring Docker service is running..."
sudo systemctl start docker
sudo systemctl status docker --no-pager --lines=0

# Wait for Docker to be ready
log "Waiting for Docker daemon to be ready..."
for i in {1..30}; do
    if sudo docker info >/dev/null 2>&1; then
        log "Docker daemon is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        log "ERROR: Docker daemon failed to start within 30 seconds"
        exit 1
    fi
    sleep 1
done

# Load pre-baked container images
log "Loading pre-baked container images..."
cd /opt/letta-platform
if [ -x ./load_images.sh ]; then
    ./load_images.sh
else
    log "WARNING: load_images.sh script not found, containers may need to be pulled"
fi

# Start Letta Platform containers
log "Starting Letta Platform containers..."
sudo docker-compose --env-file=.env up -d

# Wait for containers to be running
log "Waiting for containers to start..."
sleep 15

# Check container status
log "Checking container status..."
sudo docker-compose --env-file=.env ps

# Wait for PostgreSQL to be healthy
log "Waiting for PostgreSQL container to be healthy..."
for i in {1..60}; do
    if sudo docker exec letta-db pg_isready -U letta -d letta >/dev/null 2>&1; then
        log "PostgreSQL container is healthy!"
        break
    fi
    if [ $i -eq 60 ]; then
        log "ERROR: PostgreSQL container failed to become healthy within 60 seconds"
        exit 1
    fi
    sleep 1
done

# Wait for Letta Server API to be ready
log "Waiting for Letta Server API to be ready..."
for i in {1..120}; do
    if curl -f http://localhost:8283/v1/health/ >/dev/null 2>&1; then
        log "Letta Server API is ready!"
        break
    fi
    if [ $i -eq 120 ]; then
        log "WARNING: Letta Server API not responding after 120 seconds, but continuing..."
        break
    fi
    sleep 1
done

# Wait for Letta Web to be ready
log "Waiting for Letta Web to be ready..."
for i in {1..60}; do
    if curl -f http://localhost:8080/login >/dev/null 2>&1; then
        log "Letta Web is ready!"
        break
    fi
    if [ $i -eq 60 ]; then
        log "WARNING: Letta Web not responding after 60 seconds, but continuing..."
        break
    fi
    sleep 1
done

# Final health check
log "Running final health check..."
/opt/health_check.sh

# Create marker file to indicate successful initialization
touch /opt/.letta-initialized

log "Letta AWS Marketplace AMI (Containerized) initialization completed successfully!"

# Show container status
log "Container Status:"
sudo docker-compose --env-file=/opt/letta-platform/.env ps

# Get public IP for access URLs
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

log "Access URLs:"
log "- Letta Server API: http://${PUBLIC_IP}:8283"
log "- Letta Web Interface: http://${PUBLIC_IP}:8080"

log "Management Commands:"
log "- letta-status    : Check platform status"
log "- letta-logs      : View platform logs"
log "- letta-stop      : Stop platform"
log "- letta-start     : Start platform"
