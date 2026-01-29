# Letta Helm Chart

A Helm chart for deploying [Letta AI](https://github.com/letta-ai/letta) - a platform for building stateful agents with advanced memory capabilities.

## Introduction

This chart deploys the Letta AI platform on a Kubernetes cluster using the Helm package manager. It includes:

- **PostgreSQL Database** with pgvector extension for vector storage
- **Letta Server** - The main application server
- **Nginx** - Reverse proxy for routing requests

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PersistentVolume provisioner support in the underlying infrastructure
- (Optional) Ingress controller if you plan to use Ingress

## Installation

### Quick Start

```bash
# Install from local chart directory
helm install letta ./chart

# Or install with custom values
helm install letta ./chart -f my-values.yaml
```

### Install with Custom Values

```bash
# Install with custom values file
helm install letta ./chart -f my-values.yaml

# Install with inline value overrides
helm install letta ./chart \
  --set database.postgres.password=mySecurePassword \
  --set server.image.tag=v0.15.1
```

### Install with Secrets

For production deployments, it's **strongly recommended** to use Kubernetes Secrets for all sensitive data. The chart supports two approaches:

#### Option 1: Let Helm Create the Secret (Recommended)

The chart can automatically create a secret from values:

```bash
helm install letta ./chart \
  --set secrets.create=true \
  --set secrets.databasePassword=your-secure-password \
  --set secrets.openaiApiKey=your-openai-key \
  --set secrets.anthropicApiKey=your-anthropic-key \
  --set secrets.groqApiKey=your-groq-key
```

Or use a values file:

```yaml
# secrets-values.yaml
secrets:
  create: true
  databasePassword: "your-secure-password"
  openaiApiKey: "sk-..."
  anthropicApiKey: "sk-ant-..."
  groqApiKey: "gsk_..."
  azureApiKey: "your-azure-key"
  geminiApiKey: "your-gemini-key"
  openllmApiKey: "your-openllm-key"

externalDatabase:
  enabled: true
  host: "db.example.com"
  # These will be stored in the secret
  user: "letta"
  password: "secure-password"
  database: "letta"
```

```bash
helm install letta ./chart -f secrets-values.yaml
```

#### Option 2: Use Existing Secret

If you prefer to manage secrets separately:

```bash
# Create secret manually
kubectl create secret generic letta-secrets \
  --from-literal=database-password=secure-password \
  --from-literal=openai-api-key=sk-... \
  --from-literal=anthropic-api-key=sk-ant-... \
  --from-literal=external-database-host=db.example.com \
  --from-literal=external-database-password=secure-password

# Reference it in values
helm install letta ./chart \
  --set secrets.create=false \
  --set secrets.existingSecret=letta-secrets
```

**Note**: When using `existingSecret`, ensure the secret keys match the expected names (see Secrets Parameters section below).

## Configuration

The following table lists the configurable parameters and their default values:

### Global Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.serviceAccount.create` | Create a service account | `true` |
| `global.serviceAccount.name` | Service account name | `""` (auto-generated) |
| `global.imagePullSecrets` | Image pull secrets | `[]` |
| `global.nodeSelector` | Node selector | `{}` |
| `global.tolerations` | Tolerations | `[]` |
| `global.affinity` | Affinity rules | `{}` |

### Database Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `database.enabled` | Enable database deployment | `true` |
| `database.image.repository` | Database image repository | `ankane/pgvector` |
| `database.image.tag` | Database image tag | `v0.5.1` |
| `database.persistence.enabled` | Enable persistent storage | `true` |
| `database.persistence.size` | Storage size | `10Gi` |
| `database.persistence.storageClass` | Storage class | `""` (default) |
| `database.postgres.user` | PostgreSQL user | `letta` |
| `database.postgres.password` | PostgreSQL password | `letta` |
| `database.postgres.database` | PostgreSQL database name | `letta` |
| `database.resources.requests.memory` | Memory request | `512Mi` |
| `database.resources.requests.cpu` | CPU request | `250m` |
| `database.resources.limits.memory` | Memory limit | `2Gi` |
| `database.resources.limits.cpu` | CPU limit | `1000m` |

### External Database Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `externalDatabase.enabled` | Use external database instead of internal | `false` |
| `externalDatabase.host` | External database hostname or IP | `""` |
| `externalDatabase.port` | External database port | `5432` |
| `externalDatabase.user` | External database user | `letta` |
| `externalDatabase.password` | External database password | `""` |
| `externalDatabase.database` | External database name | `letta` |
| `externalDatabase.uri` | Full connection URI (optional, takes precedence) | `""` |

### Server Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `server.enabled` | Enable server deployment | `true` |
| `server.image.repository` | Server image repository | `letta/letta` |
| `server.image.tag` | Server image tag | `latest` |
| `server.replicaCount` | Number of server replicas | `1` |
| `server.ports.http` | HTTP port | `8083` |
| `server.ports.api` | API port | `8283` |
| `server.healthChecks.enabled` | Enable health checks | `false` |
| `server.healthChecks.livenessProbe.*` | Liveness probe configuration | See values.yaml |
| `server.healthChecks.readinessProbe.*` | Readiness probe configuration | See values.yaml |
| `server.resources.requests.memory` | Memory request | `1Gi` |
| `server.resources.requests.cpu` | CPU request | `500m` |
| `server.resources.limits.memory` | Memory limit | `4Gi` |
| `server.resources.limits.cpu` | CPU limit | `2000m` |
| `server.env.*` | Environment variables | See values.yaml |

### Nginx Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `nginx.enabled` | Enable nginx deployment | `true` |
| `nginx.image.repository` | Nginx image repository | `nginx` |
| `nginx.image.tag` | Nginx image tag | `stable-alpine3.17-slim` |
| `nginx.healthChecks.enabled` | Enable health checks | `false` |
| `nginx.healthChecks.livenessProbe.*` | Liveness probe configuration | See values.yaml |
| `nginx.healthChecks.readinessProbe.*` | Readiness probe configuration | See values.yaml |
| `nginx.service.type` | Service type | `LoadBalancer` |
| `nginx.service.port` | Service port | `80` |

### Ingress Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable Ingress | `false` |
| `ingress.className` | Ingress class name (e.g., "nginx", "traefik") | `""` |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.hosts` | Ingress hosts configuration | `[]` |
| `ingress.tls` | TLS configuration | `[]` |
| `ingress.serviceName` | Service to route to ("nginx" or "server") | `nginx` |
| `ingress.servicePort` | Port of the selected service | `80` |

### Secrets Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `secrets.create` | Create a new secret | `true` |
| `secrets.existingSecret` | Name of existing secret to use | `""` |
| `secrets.name` | Secret name (auto-generated if empty) | `""` |
| `secrets.databasePassword` | Internal database password | `""` |
| `secrets.externalDatabaseHost` | External database host | `""` |
| `secrets.externalDatabaseUser` | External database user | `""` |
| `secrets.externalDatabasePassword` | External database password | `""` |
| `secrets.externalDatabaseName` | External database name | `""` |
| `secrets.externalDatabaseUri` | External database full URI | `""` |
| `secrets.openaiApiKey` | OpenAI API key | `""` |
| `secrets.groqApiKey` | Groq API key | `""` |
| `secrets.anthropicApiKey` | Anthropic API key | `""` |
| `secrets.azureApiKey` | Azure API key | `""` |
| `secrets.geminiApiKey` | Gemini API key | `""` |
| `secrets.openllmApiKey` | OpenLLM API key | `""` |
| `secrets.clickhouseUsername` | ClickHouse username | `""` |
| `secrets.clickhousePassword` | ClickHouse password | `""` |

**Secret Key Names**: When using `existingSecret`, the secret must contain these keys:
- `database-password`
- `external-database-host`, `external-database-user`, `external-database-password`, `external-database-name`, `external-database-uri`
- `openai-api-key`, `groq-api-key`, `anthropic-api-key`, `azure-api-key`, `gemini-api-key`, `openllm-api-key`
- `clickhouse-username`, `clickhouse-password`

## Usage Examples

### Development Setup

```yaml
# dev-values.yaml
server:
  replicaCount: 1
  image:
    tag: latest
  env:
    LETTA_DEBUG: "True"

database:
  persistence:
    size: 5Gi

nginx:
  service:
    type: ClusterIP
```

```bash
helm install letta-dev ./chart -f dev-values.yaml
```

### Production Setup

```yaml
# prod-values.yaml
server:
  replicaCount: 3
  image:
    tag: "0.15.1"
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "8Gi"
      cpu: "4000m"

database:
  postgres:
    password: "CHANGE_ME_SECURE_PASSWORD"
  persistence:
    size: 100Gi
    storageClass: "fast-ssd"
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "8Gi"
      cpu: "4000m"

nginx:
  service:
    type: ClusterIP

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: letta.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: letta-tls
      hosts:
        - letta.example.com
```

```bash
helm install letta-prod ./chart -f prod-values.yaml
```

### Using External Database

If you want to use an external PostgreSQL database (e.g., AWS RDS, Google Cloud SQL, Azure Database):

```yaml
# external-db-values.yaml
database:
  enabled: false  # Disable internal database

externalDatabase:
  enabled: true
  host: "your-db-host.example.com"
  port: 5432
  user: "letta"
  password: "your-secure-password"  # Will be stored in secret if secrets.create=true
  database: "letta"
  # Optional: Use full URI instead of individual fields
  # uri: "postgresql://user:password@host:5432/database"

# Recommended: Store credentials in secrets
secrets:
  create: true
  externalDatabaseHost: "your-db-host.example.com"
  externalDatabaseUser: "letta"
  externalDatabasePassword: "your-secure-password"
  externalDatabaseName: "letta"
  # Or use full URI
  # externalDatabaseUri: "postgresql://user:password@host:5432/database"
```

Or install with inline values:

```bash
helm install letta ./chart \
  --set database.enabled=false \
  --set externalDatabase.enabled=true \
  --set externalDatabase.host=db.example.com \
  --set externalDatabase.password=secret
```

**Note**: When using external database, the internal database deployment and init container will be disabled automatically.

## Upgrading

```bash
# Upgrade with new values
helm upgrade letta ./chart -f my-values.yaml

# Upgrade to a specific version
helm upgrade letta ./chart \
  --set server.image.tag=v0.15.1

# Check upgrade status
helm status letta
```

## Uninstallation

```bash
# Uninstall the release
helm uninstall letta

# Note: This will delete all resources including PVCs by default
# To keep data, delete the PVC manually after uninstall:
# kubectl delete pvc <pvc-name>
```

## Architecture

The chart deploys the following components:

```
┌─────────────────┐
│   Ingress/Nginx │
│   (Port 80)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Letta Server   │
│  (Port 8283)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL DB  │
│  (Port 5432)    │
│  + pgvector     │
└─────────────────┘
```

### Components

1. **Database (PostgreSQL + pgvector)**
   - Stores agent state, memory, and vector embeddings
   - Uses PersistentVolumeClaim for data persistence
   - Includes health checks and initialization scripts

2. **Server (Letta Application)**
   - Main application server
   - Exposes HTTP (8083) and API (8283) ports
   - Connects to database and handles agent operations
   - Includes init container to wait for database readiness

3. **Nginx (Reverse Proxy)**
   - Routes external traffic to the server
   - Configurable via ConfigMap
   - Optional Ingress support

## Troubleshooting

### Check Pod Status

```bash
# List all pods
kubectl get pods -l app.kubernetes.io/name=letta

# Check pod logs
kubectl logs -l app.kubernetes.io/component=server
kubectl logs -l app.kubernetes.io/component=database
kubectl logs -l app.kubernetes.io/component=nginx

# Describe pod for events
kubectl describe pod <pod-name>
```

### Database Connection Issues

```bash
# Check database service
kubectl get svc -l app.kubernetes.io/component=database

# Test database connection from server pod
kubectl exec -it <server-pod-name> -- psql $LETTA_PG_URI
```

### Persistent Volume Issues

```bash
# Check PVC status
kubectl get pvc

# Check PV status
kubectl get pv

# Describe PVC for details
kubectl describe pvc <pvc-name>
```

### Common Issues

1. **Database not ready**: Check database pod logs and ensure PVC is bound
2. **Server can't connect to DB**: Verify service name and connection string
3. **Image pull errors**: Ensure image pull secrets are configured correctly
4. **Resource constraints**: Check node resources and adjust resource limits

## Security Considerations

1. **Secrets Management**: 
   - **Never commit secrets to values.yaml or git repositories**
   - Always use Kubernetes Secrets for sensitive data (passwords, API keys, database credentials)
   - Use `--set` flags or secret management tools (Sealed Secrets, External Secrets Operator, Vault, etc.)
   - When using `secrets.create=true`, values are base64 encoded in the secret
   - For production, prefer `secrets.existingSecret` with secrets created via `kubectl` or secret management tools

2. **Database Password**: Change the default database password in production and store it in secrets

3. **API Keys**: All API keys are automatically stored in secrets when `secrets.create=true` and referenced via `secretKeyRef` in the deployment

4. **External Database**: When using external databases, store all credentials (host, user, password, URI) in secrets

5. **Network Policies**: Consider implementing NetworkPolicies to restrict pod-to-pod communication

6. **RBAC**: The chart creates a ServiceAccount. Configure RBAC as needed for your security requirements

7. **TLS/SSL**: Enable TLS for production deployments using Ingress with TLS certificates

## Contributing

Contributions are welcome! Please ensure that:

1. All templates follow Kubernetes best practices
2. Values are properly documented
3. Tests are added for new features
4. Chart version is incremented appropriately

## License

This chart is licensed under the same license as the Letta project (Apache License 2.0).

## Support

For issues and questions:
- GitHub Issues: https://github.com/letta-ai/letta/issues
- Documentation: https://docs.letta.com

