#!/bin/bash
# Health check script for Letta AWS Marketplace AMI (Containerized)

set -e

LOG_FILE="/var/log/letta-health.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

check_container() {
    local container_name=$1
    local port=$2
    local endpoint=$3

    log "Checking container $container_name..."

    # Check if container is running
    if ! sudo docker ps --filter "name=$container_name" --filter "status=running" --quiet | grep -q .; then
        log "ERROR: Container $container_name is not running"
        return 1
    fi

    # Check container health status (if healthcheck is defined)
    local health_status=$(sudo docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_name" 2>/dev/null || echo "not-found")
    if [ "$health_status" = "unhealthy" ]; then
        log "ERROR: Container $container_name health check is failing"
        return 1
    elif [ "$health_status" = "healthy" ]; then
        log "✓ Container $container_name health check is passing"
    fi

    # Check if port is accessible
    if [ -n "$port" ]; then
        if ! netstat -tuln | grep -q ":$port "; then
            log "ERROR: Port $port is not accessible"
            return 1
        fi
    fi

    # Check HTTP endpoint if provided
    if [ -n "$endpoint" ]; then
        if ! curl -f "$endpoint" >/dev/null 2>&1; then
            log "ERROR: HTTP endpoint $endpoint is not responding"
            return 1
        fi
    fi

    log "✓ Container $container_name is healthy"
    return 0
}

log "Starting health check for Letta AWS Marketplace AMI (Containerized)..."

# Check Docker daemon
log "Checking Docker daemon..."
if ! sudo docker info >/dev/null 2>&1; then
    log "ERROR: Docker daemon is not running or accessible"
    exit 1
fi
log "✓ Docker daemon is healthy"

# Check Letta Server container (with bundled PostgreSQL)
check_container "letta-server" "8283" "http://localhost:8283/v1/health/" || exit 1

# Check Letta Web container (optional - only if running)
if sudo docker ps | grep -q letta-web; then
    check_container "letta-web" "8080" "http://localhost:8080/login" || exit 1
else
    log "ℹ Letta Web container not running (web interface disabled)"
fi

# Check Docker network
log "Checking Docker network..."
if ! sudo docker network inspect letta-network >/dev/null 2>&1; then
    log "ERROR: Letta network not found"
    exit 1
fi
log "✓ Docker network is healthy"

# Check Docker volumes
log "Checking Docker volumes..."
for volume in letta-postgres-data letta-data letta-logs letta-web-logs; do
    if ! sudo docker volume inspect "$volume" >/dev/null 2>&1; then
        log "WARNING: Volume $volume not found"
    else
        log "✓ Volume $volume exists"
    fi
done

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    log "WARNING: Disk usage is ${DISK_USAGE}% - consider monitoring"
else
    log "✓ Disk usage is healthy (${DISK_USAGE}%)"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ "$MEMORY_USAGE" -gt 85 ]; then
    log "WARNING: Memory usage is ${MEMORY_USAGE}% - consider monitoring"
else
    log "✓ Memory usage is healthy (${MEMORY_USAGE}%)"
fi

# Check Docker resources
log "Checking Docker resource usage..."
DOCKER_DISK_USAGE=$(sudo docker system df --format "table {{.Type}}\t{{.Size}}" | grep -E "(Images|Containers|Local Volumes)" || true)
log "Docker resource usage:"
log "$DOCKER_DISK_USAGE"

log "✅ All health checks passed!"

# Output container status
log "Container Status Summary:"
cd /opt/letta-platform
sudo docker-compose --env-file=.env ps

exit 0
