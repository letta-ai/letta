#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
IMAGE_TAG="letta-enterprise:latest"
BUILD_CONTEXT="."
TEMP_DOCKERFILE=""

# Function to cleanup temporary files
cleanup() {
    if [[ -n "$TEMP_DOCKERFILE" && -f "$TEMP_DOCKERFILE" ]]; then
        rm -f "$TEMP_DOCKERFILE"
        echo -e "${BLUE}Cleaned up temporary Dockerfile${NC}"
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Build enterprise Docker image with docker-ui static files injected into core"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG          Docker image tag (default: letta-enterprise:latest)"
    echo "  -c, --context PATH     Build context path (default: .)"
    echo "  --no-cache            Build without using cache"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  LETTA_ENVIRONMENT     Build environment (default: PRODUCTION)"
    echo "  LETTA_VERSION         Version to tag the build"
    echo "  NODE_VERSION          Node.js version for build (default: 22)"
}

# Parse command line arguments
NO_CACHE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -c|--context)
            BUILD_CONTEXT="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}=== Letta Enterprise Docker Build ===${NC}"
echo -e "${YELLOW}Image tag: ${IMAGE_TAG}${NC}"
echo -e "${YELLOW}Build context: ${BUILD_CONTEXT}${NC}"
echo -e "${YELLOW}Environment: ${LETTA_ENVIRONMENT:-PRODUCTION}${NC}"

# Validate build context
if [[ ! -d "$BUILD_CONTEXT" ]]; then
    echo -e "${RED}Error: Build context directory '$BUILD_CONTEXT' does not exist${NC}"
    exit 1
fi

if [[ ! -f "$BUILD_CONTEXT/apps/core/Dockerfile" ]]; then
    echo -e "${RED}Error: Core Dockerfile not found at '$BUILD_CONTEXT/apps/core/Dockerfile'${NC}"
    exit 1
fi

if [[ ! -d "$BUILD_CONTEXT/apps/docker-ui" ]]; then
    echo -e "${RED}Error: Desktop UI directory not found at '$BUILD_CONTEXT/apps/docker-ui'${NC}"
    exit 1
fi

# Create temporary Dockerfile
TEMP_DOCKERFILE=$(mktemp /tmp/Dockerfile.enterprise.XXXXXX)

echo -e "${BLUE}Generating enterprise Dockerfile...${NC}"

# Generate the multi-stage Dockerfile
cat > "$TEMP_DOCKERFILE" << 'EOF'
# Stage 1: Build docker-ui static files
FROM node:22 AS docker-ui-builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Copy docker-ui specific files
COPY apps/docker-ui ./apps/docker-ui
COPY libs ./libs

# Install dependencies and build docker-ui (skip prepare script to avoid husky issues)
RUN npm ci --ignore-scripts
RUN npx nx build docker-ui --prod

# Stage 2: Core application builder (based on existing Dockerfile)
FROM ankane/pgvector:v0.5.1 AS builder

# Install Python and required packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-full \
    build-essential \
    libpq-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

ARG LETTA_ENVIRONMENT=PRODUCTION
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT} \
    UV_NO_PROGRESS=1 \
    UV_PYTHON_PREFERENCE=system \
    UV_CACHE_DIR=/tmp/uv_cache

# Set for other builds
ARG LETTA_VERSION
ENV LETTA_VERSION=${LETTA_VERSION}

WORKDIR /app

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Now install uv and uvx in the virtual environment
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Copy dependency files first
COPY apps/core/pyproject.toml apps/core/uv.lock ./
# Then copy the rest of the application code
COPY apps/core .

RUN uv sync --frozen --no-dev --all-extras --python 3.11

# Stage 3: Runtime with docker-ui static files injected
FROM ankane/pgvector:v0.5.1 AS runtime

# Overridable Node.js version with --build-arg NODE_VERSION
ARG NODE_VERSION=22

RUN apt-get update && \
    # Install curl, Python, and PostgreSQL client libraries
    apt-get install -y curl python3 python3-venv libpq-dev && \
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y nodejs && \
    # Install OpenTelemetry Collector
    curl -L https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.96.0/otelcol-contrib_0.96.0_linux_amd64.tar.gz -o /tmp/otel-collector.tar.gz && \
    tar xzf /tmp/otel-collector.tar.gz -C /usr/local/bin && \
    rm /tmp/otel-collector.tar.gz && \
    mkdir -p /etc/otel && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add OpenTelemetry Collector configs
COPY apps/core/otel/otel-collector-config-file.yaml /etc/otel/config-file.yaml
COPY apps/core/otel/otel-collector-config-clickhouse.yaml /etc/otel/config-clickhouse.yaml
COPY apps/core/otel/otel-collector-config-signoz.yaml /etc/otel/config-signoz.yaml

ARG LETTA_ENVIRONMENT=PRODUCTION
ENV LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT} \
    VIRTUAL_ENV="/app/.venv" \
    PATH="/app/.venv/bin:$PATH" \
    POSTGRES_USER=letta \
    POSTGRES_PASSWORD=letta \
    POSTGRES_DB=letta \
    COMPOSIO_DISABLE_VERSION_CHECK=true

ARG LETTA_VERSION
ENV LETTA_VERSION=${LETTA_VERSION}

WORKDIR /app

# Copy virtual environment and app from builder
COPY --from=builder /app .

# ENTERPRISE: Inject docker-ui static files into core server
COPY --from=docker-ui-builder /app/dist/apps/docker-ui ./letta/server/static_files/

# Copy initialization SQL if it exists
COPY apps/core/init.sql /docker-entrypoint-initdb.d/

EXPOSE 8283 4317 4318

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["./letta/server/startup.sh"]
EOF

echo -e "${GREEN}Enterprise Dockerfile generated${NC}"

# Build the Docker image
echo -e "${BLUE}Building enterprise Docker image...${NC}"

# Set build args
BUILD_ARGS="--build-arg LETTA_ENVIRONMENT=${LETTA_ENVIRONMENT:-PRODUCTION}"
if [[ -n "${LETTA_VERSION:-}" ]]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg LETTA_VERSION=${LETTA_VERSION}"
fi
if [[ -n "${NODE_VERSION:-}" ]]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg NODE_VERSION=${NODE_VERSION}"
fi

# Execute Docker build
if docker build \
    $NO_CACHE \
    $BUILD_ARGS \
    -f "$TEMP_DOCKERFILE" \
    -t "$IMAGE_TAG" \
    "$BUILD_CONTEXT"; then

    echo -e "${GREEN}✅ Successfully built enterprise Docker image: ${IMAGE_TAG}${NC}"
    echo -e "${BLUE}Image includes:${NC}"
    echo -e "  • Core Letta application"
    echo -e "  • Docker-UI static files injected into /app/letta/server/static_files/"
    echo -e "  • PostgreSQL with pgvector"
    echo -e "  • OpenTelemetry Collector"
    echo ""
    echo -e "${YELLOW}To run the image:${NC}"
    echo -e "  docker run -p 8283:8283 ${IMAGE_TAG}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi
