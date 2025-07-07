#!/bin/bash
# Container management script for Letta Platform

set -e

PLATFORM_DIR="/opt/letta-platform"
COMPOSE_FILE="$PLATFORM_DIR/docker-compose.yml"
ENV_FILE="$PLATFORM_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|pull|build|cleanup}"
    echo ""
    echo "Commands:"
    echo "  start     - Start all services"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  status    - Show service status"
    echo "  logs      - Show logs (optional: service name)"
    echo "  pull      - Pull latest base images"
    echo "  build     - Rebuild custom images"
    echo "  cleanup   - Clean up unused containers and images"
    exit 1
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        error "Docker daemon is not running or accessible"
        exit 1
    fi
}

check_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Docker Compose file not found at $COMPOSE_FILE"
        exit 1
    fi
}

start_services() {
    log "Starting Letta Platform services..."
    cd "$PLATFORM_DIR"
    docker-compose --env-file="$ENV_FILE" up -d
    log "Services started successfully!"

    # Wait a moment and show status
    sleep 5
    show_status
}

stop_services() {
    log "Stopping Letta Platform services..."
    cd "$PLATFORM_DIR"
    docker-compose --env-file="$ENV_FILE" down
    log "Services stopped successfully!"
}

restart_services() {
    log "Restarting Letta Platform services..."
    stop_services
    sleep 3
    start_services
}

show_status() {
    log "Letta Platform Service Status:"
    cd "$PLATFORM_DIR"
    docker-compose --env-file="$ENV_FILE" ps

    echo ""
    log "Container Health Status:"
    docker ps --filter "label=com.docker.compose.project=letta-platform" \
        --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

show_logs() {
    local service="$1"
    cd "$PLATFORM_DIR"

    if [ -n "$service" ]; then
        log "Showing logs for service: $service"
        docker-compose --env-file="$ENV_FILE" logs -f "$service"
    else
        log "Showing logs for all services:"
        docker-compose --env-file="$ENV_FILE" logs -f
    fi
}

pull_images() {
    log "Pulling latest base images..."
    cd "$PLATFORM_DIR"
    docker-compose --env-file="$ENV_FILE" pull
    log "Images pulled successfully!"
}

build_images() {
    log "Rebuilding custom images..."
    cd "$PLATFORM_DIR"
    docker-compose --env-file="$ENV_FILE" build --no-cache
    log "Images built successfully!"
}

cleanup() {
    log "Cleaning up unused containers and images..."

    # Remove stopped containers
    docker container prune -f

    # Remove unused images (excluding base images)
    docker image prune -f

    # Remove unused volumes (be careful with this)
    read -p "Remove unused volumes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
    fi

    # Remove unused networks
    docker network prune -f

    log "Cleanup completed!"
}

# Main script logic
case "${1:-}" in
    start)
        check_docker
        check_compose_file
        start_services
        ;;
    stop)
        check_docker
        check_compose_file
        stop_services
        ;;
    restart)
        check_docker
        check_compose_file
        restart_services
        ;;
    status)
        check_docker
        check_compose_file
        show_status
        ;;
    logs)
        check_docker
        check_compose_file
        show_logs "$2"
        ;;
    pull)
        check_docker
        check_compose_file
        pull_images
        ;;
    build)
        check_docker
        check_compose_file
        build_images
        ;;
    cleanup)
        check_docker
        cleanup
        ;;
    *)
        usage
        ;;
esac
