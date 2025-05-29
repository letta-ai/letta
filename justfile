set dotenv-load
set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

PROJECT_NAME := "memgpt-428419"
REGION := "us-central1"
HAS_KUBECTL := `command -v kubectl || echo ""`
CLUSTER_CONTEXT := if HAS_KUBECTL=="" { "letta-dev-us-central1" } else { `kubectl config get-contexts | grep \* | awk '{print $2}' | awk -v FS=_ '{print $4}'` }
REGISTRY_NAME := if CLUSTER_CONTEXT == "letta-dev-us-central1" { "letta-dev-us-central1" } else { "letta" }
DOCKER_REGISTRY := REGION + "-docker.pkg.dev/" + PROJECT_NAME + "/" + REGISTRY_NAME
SYSTEM_ARCH := `uname -m`
BUILD_ARCH := if SYSTEM_ARCH == "x86_64" { "amd64" } else { "arm64" }
HELM_CHARTS_DIR := if CLUSTER_CONTEXT == "letta-dev-us-central1" { "helm/dev" } else { "helm" }
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
configure-kubectl cluster-name="letta":
    @echo "🔧 Configuring kubectl for the Letta cluster..."
    gcloud container clusters get-credentials {{cluster-name}} --region {{REGION}} --project {{PROJECT_NAME}}

# Build the web Docker image
@build-web-ui:
    npm run slack-bot-says "Building web Docker image with tag: {{TAG}}..."
    @echo "🚧 Building web Docker image with tag: {{TAG}}..."
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN docker buildx build --cache-to type=gha --cache-from type=gha --platform linux/{{ BUILD_ARCH }} --target web -t {{DOCKER_REGISTRY}}/web:{{TAG}} . --load --secret id=SENTRY_AUTH_TOKEN --file apps/web/Dockerfile

# Build the migrations Docker image
@build-web-migrations:
    @echo "🚧 Building migrations Docker image with tag: {{TAG}}..."
    docker buildx build --cache-to type=gha --cache-from type=gha --platform linux/{{ BUILD_ARCH }} --target migrations -t {{DOCKER_REGISTRY}}/web-migrations:{{TAG}} . --load --file apps/web/Dockerfile

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
@deploy-web deploy_message="": push-web
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
        --set env.STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
        --set env.WORKOS_CLIENT_ID="${WORKOS_CLIENT_ID}" \
        --set env.WORKOS_API_KEY="${WORKOS_API_KEY}" \
        --set env.NEXT_PUBLIC_STRIPE_PUBLISH_KEY="${NEXT_PUBLIC_STRIPE_PUBLISH_KEY}" \
        --set env.LAUNCH_DARKLY_SDK_KEY="${LAUNCH_DARKLY_SDK_KEY}" \
        --set env.SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN}" \
        --set env.NEXT_PUBLIC_CURRENT_HOST="${NEXT_PUBLIC_CURRENT_HOST}" \
        --set env.REDIS_HOST="${REDIS_HOST}" \
        --set env.HUBSPOT_API_KEY="${HUBSPOT_API_KEY}" \
        --set env.RESEND_API_KEY="${RESEND_API_KEY}" \
        --set env.COMPOSIO_API_KEY="${COMPOSIO_API_KEY}" \
        --set env.E2B_API_KEY="${E2B_API_KEY}" \
        --set env.E2B_SANDBOX_TEMPLATE_ID="${E2B_SANDBOX_TEMPLATE_ID}" \
        --set env.AUTH_GITHUB_CLIENT_ID="${AUTH_GITHUB_CLIENT_ID}" \
        --set env.AUTH_GITHUB_CLIENT_SECRET="${AUTH_GITHUB_CLIENT_SECRET}" \
        --set env.AUTH_GITHUB_REDIRECT_URI="${AUTH_GITHUB_REDIRECT_URI}" \
        --set env.TEMPORAL_LETTUCE_API_HOST="${TEMPORAL_LETTUCE_API_HOST}" \
        --set env.TEMPORAL_LETTUCE_CA_PEM="${TEMPORAL_LETTUCE_CA_PEM}" \
        --set env.TEMPORAL_LETTUCE_CA_KEY="${TEMPORAL_LETTUCE_CA_KEY}" \
        --set env.TEMPORAL_LETTUCE_NAMESPACE="${TEMPORAL_LETTUCE_NAMESPACE:-lettuce.tmhou}" \
        --set env.TWILIO_SID="${TWILIO_SID}" \
        --set env.TWILIO_SECRET="${TWILIO_SECRET}" \
        --set env.CLICKHOUSE_ENDPOINT=${CLICKHOUSE_ENDPOINT} \
        --set env.CLICKHOUSE_DATABASE=${CLICKHOUSE_DATABASE} \
        --set env.CLICKHOUSE_USERNAME=${CLICKHOUSE_USERNAME} \
        --set env.CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}

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
    docker buildx build --platform linux/{{ BUILD_ARCH }} -t {{DOCKER_REGISTRY}}/memgpt-server:{{TAG}} . --load --file libs/config-core-deploy/Dockerfile

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
        --set secrets.GROK_API_KEY=${GROK_API_KEY} \
        --set secrets.GEMINI_API_KEY=${GEMINI_API_KEY} \
        --set secrets.SENTRY_DSN=${SENTRY_DSN} \
        --set secrets.E2B_API_KEY=${E2B_API_KEY} \
        --set secrets.E2B_SANDBOX_TEMPLATE_ID=${E2B_SANDBOX_TEMPLATE_ID} \
        --set secrets.TAVILY_API_KEY=${TAVILY_API_KEY} \
        --set secrets.LETTA_LOAD_DEFAULT_EXTERNAL_TOOLS=True \
        --set secrets.LETTA_OTEL_EXPORTER_OTLP_ENDPOINT=${LETTA_OTEL_EXPORTER_OTLP_ENDPOINT} \
        --set secrets.CLICKHOUSE_ENDPOINT=${CLICKHOUSE_ENDPOINT} \
        --set secrets.CLICKHOUSE_DATABASE=${CLICKHOUSE_DATABASE} \
        --set secrets.CLICKHOUSE_USERNAME=${CLICKHOUSE_USERNAME} \
        --set secrets.CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD} \
        --set secrets.LETTA_USE_EXPERIMENTAL=${LETTA_USE_EXPERIMENTAL} \
        --set secrets.LETTA_DISABLE_SQLALCHEMY_POOLING=${LETTA_DISABLE_SQLALCHEMY_POOLING} \
        --set secrets.LETTA_UVICORN_WORKERS=${LETTA_UVICORN_WORKERS} \
        --set secrets.LETTA_PG_POOL_SIZE=${LETTA_PG_POOL_SIZE} \
        --set secrets.LETTA_PG_MAX_OVERFLOW=${LETTA_PG_MAX_OVERFLOW} \
        --set env.LETTA_DEFAULT_LLM_HANDLE=${LETTA_DEFAULT_LLM_HANDLE} \
        --set env.LETTA_DEFAULT_EMBEDDING_HANDLE=${LETTA_DEFAULT_EMBEDDING_HANDLE} \
        --set secrets.MCP_READ_FROM_CONFIG=false

# Deploy Grafana
deploy-grafana:
    echo "🚧 Deploying Grafana..."
    helm upgrade --install grafana {{HELM_CHARTS_DIR}}/grafana \
        --set grafana.adminPassword=${GRAFANA_ADMIN_PASSWORD} \

# Get migration job logs
web-migration-logs:
    kubectl logs job/{{WEB_HELM_CHART_NAME}}-migration

core-migration-logs:
    kubectl logs job/{{CORE_HELM_CHART_NAME}}-migration

grafana:
    #!/usr/bin/env bash
    device_id=$(python3 -c 'import uuid; print(uuid.getnode())')
    echo "🚧 Connecting to Grafana..."
    echo "View Traces at http://localhost:3002/d/dc738af7-6c30-4b42-aef2-f967d65638af/letta-dev-traces?orgId=1&var-deviceid=$device_id&kiosk=tv&autologin=true&username=admin&password=${GRAFANA_ADMIN_PASSWORD}"
    kubectl port-forward service/grafana 3002:3002

# starts up cool dev environment
dev:
    @echo "🚧 Starting up dev environment..."
    tmuxinator start


check-github-status:
    @echo "🚧 Checking GitHub status..."
    npm run check-github-status

setup-cloud-api:
    @echo "🚧 Setting up the cloud API..."
    cd apps/cloud-api && npm install

cloud-api: setup-cloud-api
    @echo "🚧 Running the cloud API..."
    cd apps/cloud-api && npm run build && npm run start

dev-cloud-api: setup-cloud-api
    @echo "🚧 Starting up the cloud API..."
    cd apps/cloud-api && npm run dev

# Trigger the cloud API deployment workflow (defaults to current branch if none specified)
trigger-cloud-api-deploy branch="" deploy_message="":
    #!/usr/bin/env bash
    if [ -z "{{branch}}" ]; then
        BRANCH=$(git branch --show-current)
    else
        BRANCH="{{branch}}"
    fi
    echo "🚀 Triggering cloud API deployment workflow on branch: $BRANCH"
    gh workflow run "🕸🚀 Deploy Cloud API" --ref $BRANCH

build-cloud-api:
    @echo "🚧 Building cloud API Docker image with tag: {{TAG}}..."
    docker buildx build --platform linux/{{ BUILD_ARCH }} --target cloud-api -t {{DOCKER_REGISTRY}}/cloud-api:{{TAG}} . --load --file apps/cloud-api/Dockerfile

push-cloud-api:
    @echo "🚀 Pushing Docker images to registry with tag: {{TAG}}..."
    docker push {{DOCKER_REGISTRY}}/cloud-api:{{TAG}}

test-cloud-api:
    @echo "🚧 Running tests for cloud API..."
    cd apps/cloud-api && cp -R node_modules ../../
    cd apps/cloud-api && npm run test:e2e

database-compatibility:
    @echo "🚧 Running database database-compatibility tests..."
    cd apps/cloud-api && cp -R node_modules ../../
    cd apps/cloud-api && npm run test:branch-regression

migrate-cloud-db:
    @echo "🚧 Migrating the cloud API database..."
    cd libs/service-database && npm ci
    cd libs/service-database && npx drizzle-kit migrate --config ./drizzle.config.ts
    rm -rf libs/service-database/node_modules

# Deploy the cloud API Helm chart
deploy-cloud-api: push-cloud-api
    @echo "🚧 Deploying cloud API Helm chart..."
    kubectl delete job cloud-api-migrations --ignore-not-found || true
    npm run slack-bot-says "Deploying cloud API service with tag: {{TAG}}..."
    helm upgrade --install cloud-api {{HELM_CHARTS_DIR}}/cloud-api \
        --set image.repository={{DOCKER_REGISTRY}}/cloud-api \
        --set image.tag={{TAG}} \
        --set-string "podAnnotations.kubectl\.kubernetes\.io/restartedAt"="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --set env.LETTA_AGENTS_ENDPOINT="${LETTA_AGENTS_ENDPOINT}" \
        --set env.HOST="0.0.0.0" \
        --set env.PORT="8080" \
        --set service.port=80 \
        --set service.type=LoadBalancer \
        --set ingress.enabled=true \
        --set ingress.hosts[0].host=api.letta.com \
        --set "ingress.hosts[0].paths[0].path=/(.*)" \
        --set livenessProbe.httpGet.path="/" \
        --set livenessProbe.httpGet.port=8080 \
        --set readinessProbe.httpGet.path="/" \
        --set readinessProbe.httpGet.port=8080 \
        --set env.DATABASE_URL="${DATABASE_URL}" \
        --set env.LAUNCH_DARKLY_SDK_KEY="${LAUNCH_DARKLY_SDK_KEY}" \
        --set env.REDIS_HOST="${REDIS_HOST}" \
        --set env.TEMPORAL_LETTUCE_API_HOST="${TEMPORAL_LETTUCE_API_HOST}" \
        --set env.TEMPORAL_LETTUCE_CA_PEM="${TEMPORAL_LETTUCE_CA_PEM}" \
        --set env.TEMPORAL_LETTUCE_CA_KEY="${TEMPORAL_LETTUCE_CA_KEY}" \
        --set env.STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
        --set env.OPENAI_API_KEY="${OPENAI_API_KEY}" \
        --set env.STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}" \
        --set env.CLICKHOUSE_ENDPOINT=${CLICKHOUSE_ENDPOINT} \
        --set env.CLICKHOUSE_DATABASE=${CLICKHOUSE_DATABASE} \
        --set env.CLICKHOUSE_USERNAME=${CLICKHOUSE_USERNAME} \
        --set env.CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD} \
        --set env.COMPOSIO_API_KEY="${COMPOSIO_API_KEY}"


    npm run slack-bot-says "Successfully deployed cloud API service with tag: {{TAG}}."


undertaker:
    @echo "🚧 Running the undertaker..."
    cd apps/credit-undertaker && npm run dev

# Trigger the undertaker deployment workflow (defaults to current branch if none specified)
trigger-undertaker-deploy branch="" deploy_message="":
    #!/usr/bin/env bash
    if [ -z "{{branch}}" ]; then
        BRANCH=$(git branch --show-current)
    else
        BRANCH="{{branch}}"
    fi
    echo "🚀 Triggering undertaker deployment workflow on branch: $BRANCH"
    gh workflow run "🕸🚀 Deploy Undertaker" --ref $BRANCH

build-undertaker:
  @echo "🚧 Building web Docker image with tag: {{TAG}}..."
  @mkdir -p /tmp/.buildx-cache
  docker buildx build --platform linux/{{ BUILD_ARCH }} --target undertaker \
      --cache-from type=local,src=/tmp/.buildx-cache \
      --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max \
      -t {{DOCKER_REGISTRY}}/undertaker:{{TAG}} . --load --file apps/credit-undertaker/Dockerfile
  @echo "🚧 Moving cache..."
  @rm -rf /tmp/.buildx-cache
  @mv /tmp/.buildx-cache-new /tmp/.buildx-cache

@push-undertaker:
    @echo "🚀 Pushing Docker images to registry with tag: {{TAG}}..."
    docker push {{DOCKER_REGISTRY}}/undertaker:{{TAG}}

@deploy-undertaker: push-undertaker
    @echo "🚧 Deploying Helm chart..."
    helm upgrade --install credit-undertaker {{HELM_CHARTS_DIR}}/credit-undertaker \
        --set image.repository={{DOCKER_REGISTRY}}/undertaker \
        --set image.tag={{TAG}} \
        --set-string "podAnnotations.kubectl\.kubernetes\.io/restartedAt"="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --set env.LETTA_PG_PASSWORD=${LETTA_PG_PASSWORD} \
        --set env.LETTA_PG_USER=${LETTA_PG_USER} \
        --set env.LETTA_PG_DB=${LETTA_PG_DB} \
        --set env.LETTA_PG_HOST=${LETTA_PG_HOST} \
        --set env.LETTA_PG_PORT=${LETTA_PG_PORT} \
        --set env.REDIS_HOST="${REDIS_HOST}" \
        --set env.RESEND_API_KEY="${RESEND_API_KEY}" \
        --set env.STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
        --set env.DATABASE_URL="${DATABASE_URL}"

    npm run slack-bot-says "Successfully deployed credit undertaker service with tag: {{TAG}}."

# Build all Docker images for GitHub Actions with cache management
build-web-images:
    npm run slack-bot-says "Building Docker images for GitHub Actions with tag: {{TAG}}..."
    @echo "🚧 Building web Docker image with tag: {{TAG}}..."
    @mkdir -p /tmp/.buildx-cache
    docker buildx build --platform linux/{{ BUILD_ARCH }} --target web \
        --cache-from type=local,src=/tmp/.buildx-cache \
        --cache-to type=local,dest=/tmp/.buildx-cache-new,mode=max \
        -t {{DOCKER_REGISTRY}}/web:{{TAG}} . --load --secret id=SENTRY_AUTH_TOKEN --file apps/web/Dockerfile

    @echo "🚧 Building migrations Docker image with tag: {{TAG}}..."
    docker buildx build --platform linux/{{ BUILD_ARCH }} --target migrations \
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

core-debug:
    npm run core:debug

web:
    cd apps/web && npx next dev --turbopack

web-slow:
    npm run web:dev:slow

setup-desktop:
  @echo "🚧 Setting up the desktop app..."
  cd apps/desktop-electron && npm install
  npm i --no-save nx-electron@^20.0.2
  cd apps/desktop-electron && npm run desktop:deps


ready:
  @echo "🚧 Updating your local environment..."
  source ~/.nvm/nvm.sh && nvm use || true
  npm install
  npx nx reset
  npm run core:install
  just setup-cloud-api
  just setup-desktop
  @echo "Migrating the database..."
  npm run web:database:migrate
  npm run core:database:migrate

start-services:
    @echo "🚧 Starting up postgres, redis..."
    docker compose up -d redis postgres

build-local-env:
    @echo "Attaching environment variables..."
    op inject -i .env.template -o .env

test-build-local-env:
    @echo "Attaching environment variables..."
    op inject -i .env.template -o .env.test


setup:
    @echo "🚧 Setting up the project..."
    just build-local-env
    @echo "Installing dependencies..."
    npm install
    npm run core:install
    @echo "Setting up the database..."
    npm run web:database:migrate
    npm run core:database:migrate

    echo "{}" > apps/web/flag.overrides.json
    @echo "✅ Project setup complete. You should be able to run your services, just run 'just web' or 'just core'."


lettuce:
    # Check if temporal server is running at localhost:8088
    # curl -s http://localhost:8233/metrics > /dev/null || (echo "\n\n\n\n🚨 Temporal server is not running. Please start it with 'just start-temporal'." && exit 1)
    @echo "🚧 Running lettuce..."

    temporal operator search-attribute create --name="OrganizationId" --type="Text"

    temporal operator search-attribute create --name="Id" --type="Text"

    npm run lettuce:dev

build-lettuce:
    @echo "🚧 Building cloud API Docker image with tag: {{TAG}}..."
    docker buildx build --platform linux/{{ BUILD_ARCH }} --target lettuce -t {{DOCKER_REGISTRY}}/lettuce:{{TAG}} . --load --file apps/lettuce/Dockerfile

push-lettuce:
    @echo "🚀 Pushing Docker images to registry with tag: {{TAG}}..."
    docker push {{DOCKER_REGISTRY}}/lettuce:{{TAG}}


start-temporal:
    @echo "🚧 Starting Temporal server..."
    temporal server start-dev

desktop:
    @echo "🚧 Starting up the desktop app..."
    npm run desktop:dev

# TODO move the cleaning here / wiping here
# And in download-postgres-binaries, only download if they don't exist already
clean-desktop-resources:
    @echo "Cleaning existing bundled Postgres folder..."

download-postgres-binaries-macos:
    # Download the postgres binaries (MacOS) and place them into the resources directory
    @echo "Cleaning existing bundled Postgres folder..."
    @rm -rf $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16
    @mkdir -p $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16
    @echo "Downloading binaries into folder..."
    ./scripts/desktop-builders/download-postgres.sh $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16
    # Remove "pgAdmin 4.app" if it exists, costs ~700M
    @rm -rf $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16/"pgAdmin 4.app"

download-postgres-binaries-windows-sh:
    # Download the postgres binaries (Windows x64) and place them into the resources directory
    @echo "Cleaning existing bundled Postgres folder..."
    @rm -rf $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64
    @mkdir -p $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64
    @echo "Downloading binaries into folder..."
    ./scripts/desktop-builders/download-postgres-windows.sh $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64
    # Remove "pgAdmin 4.app" if it exists, costs ~700M
    @rm -rf $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64/"pgAdmin 4"

download-postgres-binaries-windows:
    # Download the postgres binaries (Windows x64) and place them into the resources directory
    @echo "Cleaning existing bundled Postgres folder..."
    @if [ -d "$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64" ]; then rm -rf "$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64"; fi
    @mkdir -p "$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64"
    @echo "Downloading binaries into folder..."
    @./scripts/desktop-builders/download-postgres-windows.sh "$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64"
    # Remove pgAdmin if it exists
    @if [ -d "$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64/pgAdmin 4" ]; then rm -rf "$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64/pgAdmin 4"; fi

build-pgvector-macos:
    @echo "Building pgvector extension (v0.8.0) for portability..."
    ./scripts/desktop-builders/build-pgvector.sh

# Modified version of the build-pgvector-windows recipe that passes VS_PATH
build-pgvector-windows:
    @echo "Building pgvector extension (v0.8.0) for portability..."
    @if [[ -n "${VS_PATH}" ]]; then \
        echo "Using Visual Studio at: ${VS_PATH}"; \
        export VS_PATH="${VS_PATH}"; \
    fi
    @cmd /c "scripts\desktop-builders\build-pgvector-windows.bat $(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16-windows-x64"

rebuild-deps:
    # Rebuild Node/JS dependencies.
    @echo "Rebuilding dependencies..."
    @node scripts/desktop-builders/src/generators/build-python-app/build-python-app.js --rebuildDependencies

prepare-desktop-postgres-windows: download-postgres-binaries-windows build-pgvector-windows
    @echo "Downloaded and prepared Windows postgres+pgvector binaries"

prepare-desktop-postgres-macos: download-postgres-binaries-macos build-pgvector-macos
    @echo "Downloaded and prepared MacOS postgres+pgvector binaries"

# TODO split out into two different builds, one for Mac, one for Windows
prepare-desktop: rebuild-deps
    # The master target that runs all steps sequentially.
    @echo "Desktop app prepared (prod copies)."

build-desktop: setup-desktop
    @echo "Packaging the desktop app..."
    npx nx generate @letta-cloud/desktop-builders:build-desktop-app

package-desktop:
    @echo "Packaging the desktop app..."
    npx nx package desktop-electron --verbose

release-desktop:
    @echo "Packaging the desktop app..."
    npx nx release desktop-electron

package-desktop-test:
    @echo "Packaging the desktop app..."
    npx nx package-smoke desktop-electron


docs:
    @echo "🚧 Startings docs page..."
    npx nx dev docs

setup-pg-vector:
    @echo "Setting up pg-vector..."
    apps/desktop-electron/scripts/install-pgvector.sh


# Trigger the OSS sync workflow (defaults to current branch if none specified)
trigger-sync branch="":
    #!/usr/bin/env bash
    if [ -z "{{branch}}" ]; then
        BRANCH=$(git branch --show-current)
    else
        BRANCH="{{branch}}"
    fi
    echo "🔄 Triggering OSS sync workflow on branch: $BRANCH"
    gh workflow run "Sync With OSS" --ref $BRANCH

push-core-to-oss name="":
    #!/usr/bin/env bash
    if [ -z "{{name}}" ]; then
        BRANCH=$(git branch --show-current)
    else
        BRANCH="{{name}}"
    fi
    echo "🚀 Pushing core to OSS..."
    git subtree push --prefix apps/core git@github.com:letta-ai/letta.git $BRANCH


pull-oss-to-core:
    @echo "🚀 Pulling OSS into core..."
    # Use SYNC_PAT if available, otherwise use default git credentials
    if [ ! -z "${GH_TOKEN:-}" ]; then \
        git subtree pull --prefix apps/core "https://${GH_TOKEN}@github.com/letta-ai/letta.git" main; \
    else \
        git subtree pull --prefix apps/core git@github.com:letta-ai/letta.git main; \
    fi

# Create or update the PR from the integration branch into main
@generate-integration-pr: pull-oss-to-core
    #!/usr/bin/env bash
    echo "🔀 Generating or updating OSS integration PR..."

    # Delete integration branch if it exists, then create it pointing to current HEAD
    git branch -D letta-oss-integration 2>/dev/null || true
    git branch letta-oss-integration HEAD

    # Push integration branch (force in case of filter-repo changes)
    if [ ! -z "${GH_TOKEN:-}" ]; then
        remote_url="https://${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
        git remote set-url origin "${remote_url}"
    fi
    git push -u origin letta-oss-integration --force

    # Check if a PR already exists
    existing_pr=$(gh pr list --base main --head letta-oss-integration --json number -q '.[0].number')

    if [ -z "$existing_pr" ]; then
      # Create a new PR
      gh pr create \
        --base main \
        --head letta-oss-integration \
        --title "chore: sync changes from OSS repository" \
        --body "Automated PR to pull changes from OSS into private repo"
      echo "✅ Created new pull request."
    else
      # Otherwise just note that we updated the existing PR
      echo "✅ PR #$existing_pr already exists; branch has been updated."
    fi

env:
    @echo "🚧 Setting up the environment..."
    op inject -i .env.template -o .env


emails:
    @echo "🚧 Running the email viewer..."
    npm run emails:dev

@deploy-lettuce: push-lettuce
    @echo "🚧 Deploying lettuce Helm chart..."
    npm run slack-bot-says "Deploying lettuce service with tag: {{TAG}}..."
    helm upgrade --install lettuce {{HELM_CHARTS_DIR}}/lettuce \
        --set image.repository={{DOCKER_REGISTRY}}/lettuce \
        --set image.tag={{TAG}} \
        --set-string "podAnnotations.kubectl\.kubernetes\.io/restartedAt"="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --set env.DATABASE_URL="${DATABASE_URL}" \
        --set env.LETTA_AGENTS_ENDPOINT="${LETTA_AGENTS_ENDPOINT}" \
        --set env.RESEND_API_KEY="${RESEND_API_KEY}" \
        --set env.NEXT_PUBLIC_CURRENT_HOST="${NEXT_PUBLIC_CURRENT_HOST}" \
        --set env.REDIS_HOST="${REDIS_HOST}" \
        --set env.REDIS_PORT="${REDIS_PORT}" \
        --set env.PORT="${PORT}" \
        --set env.TEMPORAL_LETTUCE_API_HOST="${TEMPORAL_LETTUCE_API_HOST}" \
        --set env.TEMPORAL_LETTUCE_CA_PEM="${TEMPORAL_LETTUCE_CA_PEM}" \
        --set env.TEMPORAL_LETTUCE_CA_KEY="${TEMPORAL_LETTUCE_CA_KEY}" \
        --set env.TEMPORAL_LETTUCE_NAMESPACE="${TEMPORAL_LETTUCE_NAMESPACE:-lettuce.tmhou}"

    npm run slack-bot-says "Successfully deployed lettuce service with tag: {{TAG}}."

# Trigger the lettuce deployment workflow (defaults to current branch if none specified)
trigger-lettuce-deploy branch="" deploy_message="":
    #!/usr/bin/env bash
    if [ -z "{{branch}}" ]; then
        BRANCH=$(git branch --show-current)
    else
        BRANCH="{{branch}}"
    fi
    echo "🚀 Triggering lettuce deployment workflow on branch: $BRANCH"
    gh workflow run "🕸️🚀 Deploy Lettuce" --ref $BRANCH

build-model-proxy:
    @echo "🚧 Building model-proxy Docker image with tag: {{TAG}}..."
    docker buildx build --progress=plain --platform=linux/{{ BUILD_ARCH }} -t {{DOCKER_REGISTRY}}/model-proxy:{{TAG}} . --load --file apps/model-proxy/Dockerfile

push-model-proxy:
    @echo "🚀 Pushing Docker images to registry with tag: {{TAG}}..."
    docker push {{DOCKER_REGISTRY}}/model-proxy:{{TAG}}

@deploy-model-proxy: push-model-proxy
    @echo "🚧 Deploying model-proxy Helm chart..."
    npm run slack-bot-says "Deploying model-proxy service with tag: {{TAG}}..."
    helm upgrade --install model-proxy {{HELM_CHARTS_DIR}}/model-proxy \
        --set image.repository={{DOCKER_REGISTRY}}/model-proxy \
        --set image.tag={{TAG}} \
        --set-string "podAnnotations.kubectl\.kubernetes\.io/restartedAt"="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --set env.GCP_PUBSUB_PROJECT_ID="${GCP_PUBSUB_PROJECT_ID}" \
        --set env.GCP_PUBSUB_TOPIC_ID="${GCP_PUBSUB_TOPIC_ID}" \
        --set env.OPENAI_API_KEY="${OPENAI_API_KEY}"

    npm run slack-bot-says "Successfully deployed model-proxy service with tag: {{TAG}}."

# Trigger the model-proxy deployment workflow (defaults to current branch if none specified)
trigger-model-proxy-deploy branch="" deploy_message="":
    #!/usr/bin/env bash
    if [ -z "{{branch}}" ]; then
        BRANCH=$(git branch --show-current)
    else
        BRANCH="{{branch}}"
    fi
    echo "🚀 Triggering model-proxy deployment workflow on branch: $BRANCH"
    gh workflow run "🕸️🚀 Deploy model-proxy" --ref $BRANCH
