# Letta Web Monorepo

This is the monorepo for all internal Letta web projects. It uses [Nx](https://nx.dev) to manage the workspace.

## Getting Started

### Prerequisites
* Docker
* `nvm` from [here](https://github.com/nvm-sh/nvm) and then run:


Run the following commands
```sh
nvm use
```

Then run the following commands to setup the environment:

```sh
npm install
npm run setup
```

## Running Letta Locally

To run the dev server for your app, use:

```sh
docker compose up -d redis postgres
npm run dev
```

## Adding Component to the Library
To pull from shadCN run this:
```
nx run component-library:add-component {component-name}
```
