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

- Docker - [linky](https://docs.docker.com/get-docker/)
```sh
# Install Docker on mac
brew install docker
```

- `nvm` - [linky](https://github.com/nvm-sh/nvm)
```sh
# Install nvm on mac
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

- `just` - [linky](https://github.com/casey/just)
```sh
# Install just on mac
brew install just
```

- `1password-cli` - [linky](https://support.1password.com/command-line-getting-started/)
```sh
# Install 1password-cli on mac
brew install 1password-cli
```

### Setup
Then run the following commands to setup the environment:

```sh
cd ~/Developer

git clone git@github.com:letta-ai/letta-cloud.git letta-cloud

# Start all supporting services
just start-services

# sign into 1password
# if haven't linked the 1pass CLI to your account yet, first do: `op account add`
eval $(op signin)

# Setups up the environment
just setup
```

### Starting the Development Environment
#### Running letta core
```
# migrates your databases and starts the web server
just ready

just core
```

#### Running letta web
```
# migrates your databases and starts the web server
just ready

# in a different terminal (you need core running)
just core

# in a different terminal
just web
```



Access the app at [http://localhost:3000](http://localhost:3000)

#### Other useful commands
- `docker logs -f letta-agents` - loads the logs of the letta-agents server

## Docs Site
### Running the Docs Site Locally
To run the docs site, use:

```sh
npm run docs
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

- `just authenticate`: Authenticate with Google Cloud and configure Docker.
- `just configure-kubectl`: Configure kubectl for the Letta cluster.

### Building and Deploying

- `just build`: Build the multi-architecture Docker image.
- `just push`: Push the Docker image to the registry.
- `just deploy`: Deploy the Helm chart (includes pushing the image).
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
   - Builds Docker images using `just deploy-web-on-github`
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
- Monitoring tokens (Sentry, Mixpanel, etc.)

To modify these variables, update either:
- GitHub repository secrets for sensitive values
- Environment variables in `.github/workflows/deploy.yml` for non-sensitive values


# Why is my letta desktop "letta" not updating
There is a weird caching issue with letta, just edit the main.ts file in apps/electron, and it should work (even adding a new line)
