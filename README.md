# Letta Monorepo

This is the monorepo for all internal Letta web projects. It uses [Nx](https://nx.dev) to manage the workspace.


## Table of Contents
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Letta](#letta)
  - [Running Letta Locally](#running-letta-locally)
- [Docs Site](#docs-site)
  - [Running the Docs Site Locally](#running-the-docs-site-locally)
- [View the Component Library](#view-the-component-library)
  - [Running the Component Library Locally](#running-the-component-library-locally)
  - [Adding a new component](#adding-a-new-component)

## Getting Started

### Prerequisites

For windows setup: [Windows Setup](docs/windows-setup.md)

Install `Docker Desktop`: [linky](https://docs.docker.com/desktop/setup/install/mac-install/)

Install the following with Homebrew:
- `docker` - [linky](https://docs.docker.com/get-docker/)
- `just` - [linky](https://github.com/casey/just)
- `uv` - [linky](https://github.com/astral-sh/uv)
- `1password-cli` - [linky](https://support.1password.com/command-line-getting-started/)
- `node` (for npm) - [linky](https://nodejs.org/en/download)
- `postgresql` (to build psycopg2) - [linky](https://formulae.brew.sh/formula/postgresql@14)
```sh
brew install docker just uv 1password-cli node postgresql trufflehog
```

- `nvm` - [linky](https://github.com/nvm-sh/nvm)
```sh
# Install nvm on mac
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

### Setup
Then run the following commands to setup the environment:

```sh
cd ~/Developer

git clone git@github.com:letta-ai/letta-cloud.git --branch main

# Start all supporting services
# (Make sure docker daemon is running)
cd letta-cloud
just start-services

# link 1pass CLI to your account
op account add

# sign into 1password
eval $(op signin)

# Sets up the environment
just setup
```

### Starting the Development Environment
#### Running letta core (OSS Backend)
```sh
# prepares local environment, cloud APIs, migrates your databases
just ready

# starts the server
just core

# starts the server with hot-reload if you prefer
just core-debug
```

#### Running letta web
```sh
# prepares local environment, cloud APIs, migrates your databases
just ready

# starts the cloud api server
# NOTE: run in a different terminal from `just web` (you need core running)
just cloud-api

# starts the cloud api server with hot-reload if you prefer
just dev-cloud-api

# NOTE: run in a different terminal from `just core` to have it running
just web
```



Access the app at [http://localhost:3000](http://localhost:3000)

#### Other useful commands
- `docker logs -f letta-agents` - loads the logs of the letta-agents server

## Docs Site
For our docs and SDK, we use [fern](https://www.buildwithfern.com/)

### Running the Docs Site Locally
To run the docs site, use:

```sh
just preview-docs
```

Access the docs site at [http://localhost:3001](http://localhost:3001)

## View the Component Library
### Running the Component Library Locally
To run the component library, use:

```sh
npm run cl
```

### Adding a new component
To add a new component, run the following command:

```sh
npm run cl:new {component-name}
```

## Development Commands

This project uses [Just](https://github.com/casey/just) as a command runner. Here are some useful commands:

### Authentication and Configuration

- `gcloud` - [linky](https://github.com/gcloud/cli)
```sh
# Install gcloud CLI on mac
brew install --cask google-cloud-sdk
```

- `just authenticate`: Authenticate with Google Cloud and configure Docker.
-  ` just configure-kubectl`: Configure kubectl for the Letta cluster.

Prerequisites for `configure-kubectl`:
```sh
gcloud auth login
gcloud components install kubectl
```

### Building and Deploying

- `just build`: Build the multi-architecture Docker image.
- `just push`: Push the Docker image to the registry.
- `just deploy`: Deploy the Helm chart (includes pushing the image).
Prerequisite for `just deploy` - [linky](https://helm.sh)
```sh
# Install Helm on mac
brew install helm
```
- `just destroy`: Uninstall the Helm chart.

### Debugging and Monitoring

- `just show-env`: Show environment variables on the pod.
- `just show-secret`: Display decoded secrets.
- `just ssh`: SSH into the web service pod.
- `just web-logs`: Get logs from the web service pod.
- `just describe-web`: Describe the web service pod.
- `just migration-logs`: Get logs from the migration job.

To see all available commands, run:

```sh
just list
```

Note: Make sure you have Just installed and properly configured before running these commands.

## CI/CD

This project uses GitHub Actions for continuous integration and continuous deployment (CI/CD). The process is triggered automatically whenever there's a successful Cypress test run on the `main` branch, or manually via workflow dispatch.

### CI/CD Process

1. The deployment workflow is triggered after successful completion of the Cypress Tests workflow on `main`.
2. GitHub Actions executes the steps defined in `.github/workflows/deploy.yml`:
   - Sets up the necessary tools (Node.js, Google Cloud SDK, kubectl, just, Helm)
   - Configures authentication with Google Cloud Platform
   - Builds Docker images using `just build-web-images`
   - Deploys the application using `just deploy`
3. The deployment process includes:
   - Pushing Docker images to the GCP Container Registry
   - Updating the Kubernetes deployment using Helm

### Environment Variables

Environment variables are defined in GitHub Secrets and the workflow file. These variables are used throughout the build and deployment process. Key variables include:

- Project configuration (PROJECT_ID, REGION, etc.)
- Service endpoints and credentials
- Database and Redis configuration
- Authentication settings
- Monitoring tokens (Sentry, PostHog, etc.)

To modify these variables, update either:
- GitHub repository secrets for sensitive values
- Environment variables in `.github/workflows/deploy.yml` for non-sensitive values

# Letta Desktop

## Updating dependencies

If you add a dependency to the repo (`.toml`), make sure to update the section on `letta-desktop` in the `.toml` file, as well as add an import to the package in `letta_desktop/__init__.py`.

Then, run:
```sh
just prepare-desktop
just desktop
```

## Why is my letta desktop "letta" not updating?

There is a weird caching issue with letta, just edit the main.ts file in apps/electron, and it should work (even adding a new line)

# AgentFile.directory

```sh
# Run the necessary services in separate windows
just core
just web
just cloud-api

# Then run the directory site
just afd
```
