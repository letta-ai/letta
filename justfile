set dotenv-load

PROJECT_NAME := "memgpt-428419"
REGION := "us-central1"
REGISTRY_NAME := "letta"
DOCKER_REGISTRY := REGION + "-docker.pkg.dev/" + PROJECT_NAME + "/" + REGISTRY_NAME
HELM_CHARTS_DIR := "helm"
HELM_CHART_NAME := "letta-web"
TAG := "v0.0.7"

REDIS_HOST := "10.167.199.148"
POSTGRES_PRIVATE_IP := "10.104.0.3"
DATABASE_URL := "postgres://staff:${PG_PASSWORD}@${POSTGRES_PRIVATE_IP}:5432/letta"

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

configure-kubectl:
    @echo "🔧 Configuring kubectl for the Letta cluster..."
    gcloud container clusters get-credentials letta --region {{REGION}} --project {{PROJECT_NAME}}

# Build and push the Docker image to the registry
build:
    @echo "🚧 Building multi-architecture web service Docker image..."
    docker buildx create --use
    docker buildx build --platform linux/amd64,linux/arm64 -t {{DOCKER_REGISTRY}}/web:{{TAG}} --push .

migrate:
    @echo "🚧 Running database migrations..."
    DATABASE_URL={{DATABASE_URL}} npm run database:migrate


# Deploy the Helm chart
deploy:
    @echo "🚧 Deploying Helm chart..."
    @helm upgrade --install {{HELM_CHART_NAME}} {{HELM_CHARTS_DIR}}/{{HELM_CHART_NAME}} \
        --set image.repository={{DOCKER_REGISTRY}}/web \
        --set image.tag={{TAG}} \
        --set env.DATABASE_URL="${DATABASE_URL}" \
        --set env.GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
        --set env.GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
        --set env.GOOGLE_REDIRECT_URI="${GOOGLE_REDIRECT_URI}" \
        --set env.LETTA_AGENTS_ENDPOINT="${LETTA_AGENTS_ENDPOINT}" \
        --set env.REDIS_HOST="${REDIS_HOST}"

# Destroy the Helm chart
destroy:
    @echo "🚧 Undeploying web service Helm chart..."
    helm uninstall {{HELM_CHART_NAME}}

# Show environment variables on the pod
show-env:
    @echo "🚧 Showing environment variables..."
    kubectl exec -it $(kubectl get pods -l app.kubernetes.io/name=letta-web -o jsonpath="{.items[0].metadata.name}") -- env

# Show secret
show-secret:
    #!/usr/bin/env zsh
    @echo "🚧 Showing secret..."
    kubectl get secret letta-web-env -o yaml | grep -v '^\s*[^:]*:\s*$' | sed 's/: /: /' | awk '{print $1 " " (NF > 1 ? $2 : "")}' | while read key value; do
        if [ -n "$value" ]; then
            echo "$key $(echo $value | base64 --decode)"
        else
            echo "$key"
        fi
    done
