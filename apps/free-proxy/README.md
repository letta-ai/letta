# ⚡🦙 MemGPT OpenAI Proxy Server

```sh
# Start with:
uvicorn main:app
```

## Overview

This is a proxy server that ingests OpenAI compatible traffic, and routes it to LLM endpoints (using MemGPT prompt formatting logic).

The intended use is for this server to sit behind the public address `api.memgpt.ai` and be an OpenAI proxy endpoint that MemGPT client instances can point to. To the user, the endpoint should appear static and require no reconfiguration, even if we change the models behind the endpoint (or adjust the routing policies).

On the proxy server itself we can route the traffic in different ways, eg:

- to a vLLM completions endpoint (using the custom MemGPT prompt formatting code)
- to OpenAI / Azure (no rewriting of the request, just forwarding)
- both, for scale-to-zero and scaling during spikes in requests (OpenAI/Azure on cold start, and to vLLM during high traffic)

```text
[MemGPT client]
  -(OpenAI ChatCompletion request)->
    [Proxy server routing policy]
      -(OpenAI ChatCompletion request)->
      or
      -(MemGPT model_wrapper Completion request)->
        [LLM endpoint]
      <-
    [Proxy server return]
  <-
[MemGPT client]
```

## Usage (conda)

### Installation

```sh
conda create -n memgpt-proxy python=3.11 -y
conda activate memgpt-proxy

pip install -r requirements.txt
```

### Running the server

To start the server, run:
```sh
uvicorn main:app
```

During development, use `--reload` to auto-restart the server on code changes:
```sh
uvicorn main:app --reload
```

## Usage (Docker)

To build the docker container:
```sh
docker build -t memgpt-proxy-app .
```

To run the docker container (proxy will be listening on port 8000):
```sh
docker run -d -p 8000:80 memgpt-proxy-app
```

### Pushing the container (internal-only)
Push the docker container for deployments:
```
docker build -t sarahwooders/memgpt-proxy-app:latest .
docker push sarahwooders/memgpt-proxy-app:latest
```


# Testing the entire stack

To test the entire FastAPI (API server) + Prometheus (metrics DB) + Grafana (observability dashboard) stack, use the provided `docker-compose`:

```sh
docker-compose up
```

Now you should be able to access the following:

- You can hit the API proxy server on `localhost:8000` (internally, Prometheus is querying `host.docker.internal:80`)
- You can access the Prometheus dashboard at `localhost:9090`
- You can access the Grafana dashboard at `localhost:3000`

Because everything will be freshly initialized, you need to connect Grafana to Prometheus:

- Go to the sidebar / hamburger menu, and click "Connections"
- Search for "Prometheus", and click to add a new connection
- In the "Connection Server URL", use `http://host.docker.internal:9090` (because we're running with docker-compose)

Now you should be able to create a dashboard in Grafana using the FastAPI HTTP data.
