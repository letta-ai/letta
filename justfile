set dotenv-load

PROJECT_NAME := "memgpt-428419"
REGION := "us-central1"
REGISTRY_NAME := "letta"
DOCKER_REGISTRY := REGION + "-docker.pkg.dev/" + PROJECT_NAME + "/" + REGISTRY_NAME
HELM_CHARTS_DIR := "helm"
HELM_CHART_NAME := "letta-web"
REDIS_HOST := "10.167.199.148"
TAG := env_var_or_default("TAG", "latest")

# List all Justfile commands
@list:
    echo "🚧 Listing Justfile commands..."
    just --list

# Authenticate with GCP
authenticate:
    @echo "🔐 Authenticating with Google Cloud..."
    gcloud auth application-default login --project {{PROJECT_NAME}}

# Configure Docker authentication
configure-docker:
    @echo "🔐 Configuring Docker authentication..."
    gcloud auth configure-docker {{REGION}}-docker.pkg.dev --quiet

# Configure kubectl
configure-kubectl:
    @echo "🔧 Configuring kubectl for the Letta cluster..."
    gcloud container clusters get-credentials letta --region {{REGION}} --project {{PROJECT_NAME}}

# Build the web Docker image
build-web:
    npm run slack-bot-says "Building web Docker image with tag: {{TAG}}..."
    @echo "🚧 Building web Docker image with tag: {{TAG}}..."
    docker buildx build --platform linux/amd64 --target web -t {{DOCKER_REGISTRY}}/web:{{TAG}} . --load

# Build the migrations Docker image
build-migrations:
    @echo "🚧 Building migrations Docker image with tag: {{TAG}}..."
    docker buildx build --platform linux/amd64 --target migrations -t {{DOCKER_REGISTRY}}/web-migrations:{{TAG}} . --load

# Build all Docker images synchronously
build: build-web build-migrations
    @echo "✅ All Docker images built successfully."
    npm run slack-bot-says "Docker image with tag: {{TAG}} built successfully."

# Push the Docker images to the registry
push:
    @echo "🚀 Pushing Docker images to registry with tag: {{TAG}}..."
    docker push {{DOCKER_REGISTRY}}/web:{{TAG}}
    docker push {{DOCKER_REGISTRY}}/web-migrations:{{TAG}}

# Deploy the Helm chart
deploy: push
    @echo "🚧 Deploying Helm chart..."
    kubectl delete job {{HELM_CHART_NAME}}-migration --ignore-not-found
    npm run slack-bot-says "Deploying web service Helm chart with tag: {{TAG}}..."
    helm upgrade --install {{HELM_CHART_NAME}} {{HELM_CHARTS_DIR}}/{{HELM_CHART_NAME}} \
        --force \
        --set image.repository={{DOCKER_REGISTRY}}/web \
        --set image.tag={{TAG}} \
        --set-string "podAnnotations.kubectl\.kubernetes\.io/restartedAt"="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --set env.DATABASE_URL="${DATABASE_URL}" \
        --set env.GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
        --set env.GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
        --set env.GOOGLE_REDIRECT_URI="${GOOGLE_REDIRECT_URI}" \
        --set env.LETTA_AGENTS_ENDPOINT="${LETTA_AGENTS_ENDPOINT}" \
        --set env.MIXPANEL_TOKEN="${MIXPANEL_TOKEN}" \
        --set env.LAUNCH_DARKLY_SDK_KEY="${LAUNCH_DARKLY_SDK_KEY}" \
        --set env.SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN}" \
        --set env.NEXT_PUBLIC_CURRENT_HOST="${NEXT_PUBLIC_CURRENT_HOST}" \
        --set env.REDIS_HOST="${REDIS_HOST}"
    npm run slack-bot-says "Successfully deployed web service Helm chart with tag: {{TAG}}."

# Destroy the Helm chart
destroy:
    @echo "🚧 Undeploying web service Helm chart..."
    helm uninstall {{HELM_CHART_NAME}}

# Show environment variables on the pod
show-env:
    @echo "🚧 Showing environment variables..."
    kubectl exec -it $(kubectl get pods -l app.kubernetes.io/name=letta-web -o jsonpath="{.items[0].metadata.name}") -- env

# Show secret
@show-secret:
    echo "🚧 Showing secret..."
    kubectl get secret letta-web-env -o jsonpath='{.data}' | jq -r 'to_entries[] | "\(.key) \(.value | @base64d)"'

# SSH into the pod
ssh:
    kubectl exec -it $(kubectl get pods -l app.kubernetes.io/name=letta-web -o jsonpath="{.items[0].metadata.name}") -- /bin/sh

# Get logs
web-logs:
    kubectl logs $(kubectl get pods -l app.kubernetes.io/name=letta-web -o jsonpath="{.items[0].metadata.name}")

# Describe the pod
describe-web:
    kubectl describe pod $(kubectl get pods -l app.kubernetes.io/name=letta-web -o jsonpath="{.items[0].metadata.name}")

# Get migration job logs
migration-logs:
    kubectl logs job/{{HELM_CHART_NAME}}-migration
