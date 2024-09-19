PROJECT_NAME := "memgpt-428419"
REGION := "us-central1"
REGISTRY_NAME := "letta"
DOCKER_REGISTRY := REGION + "-docker.pkg.dev/" + PROJECT_NAME + "/" + REGISTRY_NAME
HELM_CHARTS_DIR := "helm"
HELM_CHART_NAME := "letta-web"
TAG := "v0.0.4"

@list:
    echo "🚧 Listing Justfile commands..."
    just --list

# Build and push the Docker image to the registry
build:
    @echo "🚧 Building multi-architecture web service Docker image..."
    docker buildx create --use
    docker buildx build --platform linux/amd64 -t {{DOCKER_REGISTRY}}/web:{{TAG}} --push .

# Deploy the Helm chart
deploy:
    @echo "🚧 Deploying web service Helm chart..."
    helm upgrade --install {{HELM_CHART_NAME}} {{HELM_CHARTS_DIR}}/{{HELM_CHART_NAME}} \
        --set image.repository={{DOCKER_REGISTRY}}/web \
        --set image.tag={{TAG}}

# Destroy the Helm chart
destroy:
    @echo "🚧 Undeploying web service Helm chart..."
    helm uninstall {{HELM_CHART_NAME}}
