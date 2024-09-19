PROJECT_NAME := "memgpt-428419"
REGION := "us-central1"
REGISTRY_NAME := "letta"
DOCKER_REGISTRY := REGION + "-docker.pkg.dev/" + PROJECT_NAME + "/" + REGISTRY_NAME
HELM_CHARTS_DIR := "helm"
HELM_CHART_NAME := "letta-web"
TAG := "v0.0.2"

build:
    @echo "🚧 Building multi-architecture web service Docker image..."
    docker buildx create --use
    docker buildx build --platform linux/amd64,linux/arm64 -t {{DOCKER_REGISTRY}}/web:{{TAG}} --push .

push: build
    @echo "🚧 Pushing web service Docker image..."
    docker push {{DOCKER_REGISTRY}}/web:{{TAG}}

deploy:
    @echo "🚧 Deploying web service Helm chart..."
    helm upgrade --install {{HELM_CHART_NAME}} {{HELM_CHARTS_DIR}}/{{HELM_CHART_NAME}} \
        --set image.repository={{DOCKER_REGISTRY}}/web \
        --set image.tag={{TAG}}

destroy:
    @echo "🚧 Undeploying web service Helm chart..."
    helm uninstall {{HELM_CHART_NAME}}
