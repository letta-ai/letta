# Letta Web Monorepo

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

- Docker
- `nvm` from [here](https://github.com/nvm-sh/nvm) and then run:

Run the following commands

```sh
nvm use
```

Then run the following commands to setup the environment:

```sh
npm install
npm run setup
```


## Letta

## Running Letta Locally

To run the dev server for your app, use:

```sh
docker compose up -d redis postgres
npm run dev
```

Access the app at [http://localhost:3000](http://localhost:3000)

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
