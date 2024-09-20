PROJECT_NAME := "memgpt-428419"
REGION := "us-central1"
REGISTRY_NAME := "letta"
DOCKER_REGISTRY := REGION + "-docker.pkg.dev/" + PROJECT_NAME + "/" + REGISTRY_NAME
HELM_CHARTS_DIR := "helm"
HELM_CHART_NAME := "letta-web"
TAG := "v0.0.7"

# List all Justfile commands
@list:
    echo "🚧 Listing Justfile commands..."
    just --list

# Authenticate with GCP
authenticate:
    @echo "🔐 Authenticating with Google Cloud..."
    gcloud auth application-default login --project {{PROJECT_NAME}}
    @echo "🔐 Configuring Docker authentication..."
    gcloud auth configure-docker {{REGION}}-docker.pkg.dev --quiet

# Build and push the Docker image to the registry
build:
    @echo "🚧 Building multi-architecture web service Docker image..."
    docker buildx create --use
    docker buildx build --platform linux/amd64,linux/arm64 -t {{DOCKER_REGISTRY}}/web:{{TAG}} --push .

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

# Deploy the Helm chart to local Orbstack cluster
deploy-local:
    @echo "🚧 Deploying web service Helm chart to local Orbstack cluster..."
    gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin https://{{REGION}}-docker.pkg.dev
    kubectl create secret docker-registry gcr-json-key \
        --docker-server={{REGION}}-docker.pkg.dev \
        --docker-username=oauth2accesstoken \
        --docker-password=$(gcloud auth print-access-token) \
        --docker-email=$(gcloud config get-value account) \
        --dry-run=client -o yaml | kubectl apply -f -
    helm upgrade --install {{HELM_CHART_NAME}} {{HELM_CHARTS_DIR}}/{{HELM_CHART_NAME}} \
        --set image.repository={{DOCKER_REGISTRY}}/web \
        --set image.tag={{TAG}} \
        --set imagePullSecrets[0].name=gcr-json-key
