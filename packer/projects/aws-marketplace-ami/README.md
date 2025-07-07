# Letta AWS Marketplace AMI (Containerized)

This directory contains the Packer configuration to build an AWS Marketplace AMI that runs containerized services using **pre-baked container images**:

1. **PostgreSQL** with pgvector extension (`ankane/pgvector:v0.5.1`)
2. **Letta Server** - AI Agent Platform API (`letta/letta:latest`)
3. **Letta Web** - Web Interface (`letta-web:local`)

All container images are **baked into the AMI** during build time for faster startup and offline deployment. Services run in Docker containers orchestrated with Docker Compose, matching the production deployment architecture used by Letta.

## Prerequisites

- Packer installed
- AWS CLI configured with appropriate permissions
- Valid AWS credentials

## Building the AMI

### Web Interface (Optional)

The AMI includes **conditional web interface support**:

- **Without web container**: Ships with only Letta API server (port 8283) - fully functional
- **With web container**: Ships with both API server and web interface (port 8080)

To include the web interface, build it locally before running Packer:

```bash
# From the letta-cloud project root directory
./packer/projects/aws-marketplace-ami/build-web-image.sh
```

This will:
1. Build the letta-web container locally using `apps/web/Dockerfile`
2. Save it as a tar.gz file in `local-images/`
3. Enable web interface in the AMI automatically

### Quick Start

```bash
# 1. (Optional) Build web container first for web interface
./packer/projects/aws-marketplace-ami/build-web-image.sh

# 2. Build the AMI (from packer directory)
cd packer/projects/aws-marketplace-ami
./build.sh
```

**Note**: The AMI will work without step 1 - it will just ship with API-only access.

### Custom Build

```bash
./build.sh --environment marketplace --region us-west-2
```

## Configuration

### Variables

Edit `variables/marketplace.pkrvars.hcl` to customize:
- AMI name and description
- Instance type for building
- AWS region
- Source AMI settings

### Scripts

The build process uses these scripts:
- `install_docker.sh` - Installs Docker and Docker Compose
- `setup_docker_environment.sh` - Sets up Docker environment and configurations
- `bake_containers.sh` - Pulls and saves container images as tar files in the AMI
- `configure_container_services.sh` - Sets up systemd services for container orchestration
- `setup_startup.sh` - Configures startup scripts and health checks
- `cleanup.sh` - Cleans up containers and AMI before finalization

## Services

The AMI includes containerized services managed by Docker Compose:

### PostgreSQL Container (`letta_db`)
- **Image**: `ankane/pgvector:v0.5.1`
- **Container**: `letta-db`
- **Port**: 5432
- **Database**: `letta`
- **User**: `letta` / `letta123`
- **Features**: pgvector extension enabled
- **Volume**: `letta-postgres-data` for persistent storage

### Letta Server Container (`letta_server`)
- **Image**: `letta/letta:latest` (pre-built)
- **Container**: `letta-server`
- **Port**: 8283 (primary API port)
- **API**: http://localhost:8283
- **Health**: `/v1/health/`
- **Volumes**: `letta-data`, `letta-logs`
- **Database**: Bundled PostgreSQL with pgvector

### Letta Web Container (`letta_web`)
- **Image**: `letta-web:local` (built locally for AMD64)
- **Container**: `letta-web`
- **Port**: 8080
- **Web UI**: http://localhost:8080
- **Health**: `/login`
- **Volume**: `letta-web-logs`
- **Environment**: Connects to Letta Server API

### Container Orchestration
- **Service**: `letta-platform.service` (systemd)
- **Management**: Docker Compose with custom management scripts
- **Network**: `letta-network` (bridge)
- **Architecture**: Matches production Helm chart deployment

## First Boot

The AMI includes a startup service that:
1. Starts Docker daemon and waits for readiness
2. Starts all containers via Docker Compose
3. Waits for PostgreSQL container to be healthy
4. Waits for Letta API to be ready
5. Waits for Letta Web to be ready
6. Runs comprehensive health checks
7. Creates initialization marker

## Management Commands

The AMI includes convenient management commands:
- `letta-start` - Start the platform
- `letta-stop` - Stop the platform
- `letta-status` - Show platform status
- `letta-logs [service]` - View logs
- `letta-platform [command]` - Full management script

## Health Monitoring

- Health check script: `/opt/health_check.sh`
- Checks Docker daemon, containers, networks, and volumes
- Automated health checks run every 5 minutes via cron
- Logs: `/var/log/letta-health.log`

## Logs

- Startup logs: `/var/log/letta-startup.log`
- Health check logs: `/var/log/letta-health.log`
- Container logs: `letta-logs [container-name]`
- Docker logs: `docker-compose logs` in `/opt/letta-platform`

## Customization

### Container Images

The AMI uses pre-built container images that can be customized:

1. **Update image versions** in `/opt/letta-platform/.env`:
   ```bash
   LETTA_SERVER_IMAGE=letta/letta:v1.2.3
   LETTA_WEB_IMAGE=letta-web:local
   POSTGRES_IMAGE=ankane/pgvector:v0.5.1
   ```

2. **Custom initialization** via mounted scripts:
   - `init-letta.sh` - Letta Server container initialization
   - `init-web.sh` - Letta Web container initialization

### Database Configuration

PostgreSQL is configured with:
- Remote connections enabled
- Performance tuning for medium workloads
- Dedicated `letta` database and user

### Security

The AMI includes:
- SSH root login disabled
- Password authentication disabled
- Service users with restricted permissions
- Systemd security hardening

## Testing

After building, test the AMI by:
1. Launching an EC2 instance
2. Checking service status: `systemctl status letta-platform`
3. Running health check: `/opt/health_check.sh`
4. Testing API endpoints:
   - Letta Server: `curl http://localhost:8283/v1/health/`
   - Letta Web: `curl http://localhost:8080/login`

## Troubleshooting

### Build Issues
- Check Packer logs for detailed error messages
- Verify AWS credentials and permissions
- Ensure all required files are present

### Runtime Issues
- Check service logs: `journalctl -u <service-name>`
- Review startup logs: `/var/log/letta-startup.log`
- Run health check: `/opt/health_check.sh`

### Common Problems
1. **PostgreSQL not starting**: Check disk space and permissions
2. **Letta not connecting to DB**: Verify database user and password
3. **Services not starting on boot**: Check systemd service files

## AWS Marketplace Preparation

Before submitting to AWS Marketplace:
1. Test thoroughly on different instance types
2. Ensure all proprietary software licensing is handled
3. Create proper product documentation
4. Configure appropriate AMI sharing permissions
5. Verify all container images are properly baked into the AMI

## Support

For issues with:
- **Letta**: Visit https://letta.com
- **AMI Build Process**: Check this repository's issues
- **AWS Marketplace**: Contact AWS Support
