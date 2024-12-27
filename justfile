set dotenv-load

PROJECT_NAME := "memgpt-428419"
REGION := "us-central1"
REGISTRY_NAME := "letta"
DOCKER_REGISTRY := REGION + "-docker.pkg.dev/" + PROJECT_NAME + "/" + REGISTRY_NAME
HELM_CHARTS_DIR := "helm"
WEB_HELM_CHART_NAME := "letta-web"
CORE_HELM_CHART_NAME := "memgpt-server"
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
@build-web-ui:
    npm run slack-bot-says "Building web Docker image with tag: {{TAG}}..."
    @echo "🚧 Building web Docker image with tag: {{TAG}}..."
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN docker buildx build --platform linux/amd64 --target web -t {{DOCKER_REGISTRY}}/web:{{TAG}} . --load --secret id=SENTRY_AUTH_TOKEN --file apps/web/Dockerfile

# Build the migrations Docker image
@build-web-migrations:
    @echo "🚧 Building migrations Docker image with tag: {{TAG}}..."
    docker buildx build --platform linux/amd64 --target migrations -t {{DOCKER_REGISTRY}}/web-migrations:{{TAG}} . --load --file apps/web/Dockerfile

# Build all Docker images synchronously
@build-web: build-web-ui build-web-migrations
    @echo "✅ All Docker images built successfully."
    npm run slack-bot-says "Docker image with tag: {{TAG}} built successfully."

# Push the Docker images to the registry
@push-web:
    @echo "🚀 Pushing Docker images to registry with tag: {{TAG}}..."
    docker push {{DOCKER_REGISTRY}}/web:{{TAG}}
    docker push {{DOCKER_REGISTRY}}/web-migrations:{{TAG}}

# Deploy the Helm chart
@deploy-web: push-web
    @echo "🚧 Deploying Helm chart..."
    kubectl delete job {{WEB_HELM_CHART_NAME}}-migration --ignore-not-found
    npm run slack-bot-says "Deploying web service Helm chart with tag: {{TAG}}..."
    helm upgrade --install {{WEB_HELM_CHART_NAME}} {{HELM_CHARTS_DIR}}/{{WEB_HELM_CHART_NAME}} \
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
        --set env.NEXT_PUBLIC_MIXPANEL_TOKEN="${MIXPANEL_TOKEN}" \
        --set env.LAUNCH_DARKLY_SDK_KEY="${LAUNCH_DARKLY_SDK_KEY}" \
        --set env.SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN}" \
        --set env.NEXT_PUBLIC_CURRENT_HOST="${NEXT_PUBLIC_CURRENT_HOST}" \
        --set env.REDIS_HOST="${REDIS_HOST}" \
        --set env.HUBSPOT_API_KEY="${HUBSPOT_API_KEY}" \
        --set env.COMPOSIO_API_KEY="${COMPOSIO_API_KEY}" \
        --set env.E2B_API_KEY="${E2B_API_KEY}" \
        --set env.E2B_SANDBOX_TEMPLATE_ID="${E2B_SANDBOX_TEMPLATE_ID}" \
        --set env.AUTH_GITHUB_CLIENT_ID="${AUTH_GITHUB_CLIENT_ID}" \
        --set env.AUTH_GITHUB_CLIENT_SECRET="${AUTH_GITHUB_CLIENT_SECRET}" \
        --set env.AUTH_GITHUB_REDIRECT_URI="${AUTH_GITHUB_REDIRECT_URI}"

    npm run slack-bot-says "Successfully deployed web service Helm chart with tag: {{TAG}}."

# Destroy the Helm chart
destroy:
    @echo "🚧 Undeploying web service Helm chart..."
    helm uninstall {{WEB_HELM_CHART_NAME}}
    helm uninstall {{CORE_HELM_CHART_NAME}}

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

# Core stuff
@build-core:
    echo "🚧 Building multi-architecture Docker images with tag: {{TAG}}..."
    docker buildx create --use
    docker buildx build --progress=plain --platform linux/amd64 -t {{DOCKER_REGISTRY}}/memgpt-server:{{TAG}} . --load --file libs/core-deploy-configs/Dockerfile

# Push the Docker images to the registry
@push-core:
    echo "🚀 Pushing Docker images to registry with tag: {{TAG}}..."
    docker push {{DOCKER_REGISTRY}}/memgpt-server:{{TAG}}

# Deploy the Helm chart
@deploy-core deploy_message="": push-core
    echo "🚧 Deploying Helm chart..."
    helm upgrade --install {{CORE_HELM_CHART_NAME}} {{HELM_CHARTS_DIR}}/{{CORE_HELM_CHART_NAME}} \
        --set deployMessage='{{deploy_message}}' \
        --set image.repository={{DOCKER_REGISTRY}}/memgpt-server \
        --set image.tag={{TAG}} \
        --set-string "podAnnotations.kubectl\.kubernetes\.io/restartedAt"="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --set secrets.OPENAI_API_KEY=${OPENAI_API_KEY} \
        --set secrets.COMPOSIO_API_KEY=${COMPOSIO_API_KEY} \
        --set secrets.LETTA_PG_PASSWORD=${LETTA_PG_PASSWORD} \
        --set secrets.LETTA_PG_USER=${LETTA_PG_USER} \
        --set secrets.LETTA_PG_DB=${LETTA_PG_DB} \
        --set secrets.LETTA_PG_HOST=${LETTA_PG_HOST} \
        --set secrets.LETTA_PG_PORT=${LETTA_PG_PORT} \
        --set secrets.MEMGPT_SERVER_PASS=${MEMGPT_SERVER_PASS} \
        --set secrets.TOGETHER_API_KEY=${TOGETHER_API_KEY} \
        --set secrets.ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
        --set secrets.SENTRY_DSN=${SENTRY_DSN} \
        --set secrets.E2B_API_KEY=${E2B_API_KEY} \
        --set secrets.E2B_SANDBOX_TEMPLATE_ID=${E2B_SANDBOX_TEMPLATE_ID} \
        --set secrets.LETTA_LOAD_DEFAULT_EXTERNAL_TOOLS=True


# Get migration job logs
web-migration-logs:
    kubectl logs job/{{WEB_HELM_CHART_NAME}}-migration

core-migration-logs:
    kubectl logs job/{{CORE_HELM_CHART_NAME}}-migration


# starts up cool dev environment
dev:
    @echo "🚧 Starting up dev environment..."
    tmuxinator start


check-github-status:
    @echo "🚧 Checking GitHub status..."
    npm run check-github-status

# Build all Docker images for GitHub Actions with cache management
deploy-web-on-github:
    npm run slack-bot-says "Building Docker images for GitHub Actions with tag: {{TAG}}..."
    @echo "🚧 Building web Docker image with tag: {{TAG}}..."
    @mkdir -p /tmp/.buildx-cache
    docker buildx build --platform linux/amd64 --target web \
        --cache-from type=local,src=/tmp/.buildx-cache \
        --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max \
        -t {{DOCKER_REGISTRY}}/web:{{TAG}} . --load --secret id=SENTRY_AUTH_TOKEN --file apps/web/Dockerfile

    @echo "🚧 Building migrations Docker image with tag: {{TAG}}..."
    docker buildx build --platform linux/amd64 --target migrations \
        --cache-from type=local,src=/tmp/.buildx-cache \
        --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max \
        -t {{DOCKER_REGISTRY}}/web-migrations:{{TAG}} . --load --file apps/web/Dockerfile

    @echo "🚧 Moving cache..."
    @rm -rf /tmp/.buildx-cache
    @mv /tmp/.buildx-cache-new /tmp/.buildx-cache

    @echo "✅ All Docker images built successfully."
    npm run slack-bot-says "Docker images with tag: {{TAG}} built successfully."

# Processes the letta core api into a consumable sdk and openapi spec for documentation and downstream consumption
stage-api:
    @echo "🚧 Syncing API..."
    npm run core:generate-web-sdk

# Takes the staged API and pushes it to docs
publish-api:
    @echo "🚧 Publishing API..."
    # Generates an openapi spec from any public web api endpoints
    npm run web:generate-web-only-openapi-spec
    # Merges the core api and web api openapi specs and moves it to the docs folder
    npm run docs:publish-api

preview-docs:
    @echo "🚧 Previewing docs..."
    npm run docs:dev

core:
    npm run core:dev

web:
    npm run web:dev

ready:
  @echo "🚧 Updating your local environment..."
  npm run core:install
  npm install




start-services:
    @echo "🚧 Starting up postgres, redis..."
    docker compose up -d redis postgres temporal

setup:
    @echo "🚧 Setting up the project..."
    @echo "Attaching environment variables..."
    op inject -i .env.template -o .env
    @echo "Installing dependencies..."
    npm run core:install
    npm install
    @echo "Setting up the database..."
    npm run web:database:migrate
    npm run core:database:migrate

    echo "{}" > apps/web/flag.overrides.json
    @echo "✅ Project setup complete. You should be able to run your services, just run 'just web' or 'just core'."


lettuce:
    # Check if temporal server is running at localhost:8088
    curl -s http://localhost:8233/metrics > /dev/null || (echo "\n\n\n\n🚨 Temporal server is not running. Please start it with 'just start-temporal'." && exit 1)
    @echo "🚧 Running lettuce..."
    npm run lettuce:dev

start-temporal:
    @echo "🚧 Starting Temporal server..."
    temporal server start-dev


push-core-to-oss $name:
    @echo "🚀 Pushing core to OSS..."
    ./scripts/oss-sync-scripts/push.sh $name


pull-oss-to-core:
    @echo "🚀 Pushing core to OSS..."
    ./scripts/oss-sync-scripts/pull.sh


desktop:
    @echo "🚧 Starting up the desktop app..."
    npm run desktop:dev
