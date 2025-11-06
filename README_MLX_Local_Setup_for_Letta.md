# MLX Local Setup for Letta

 

This setup allows you to run Letta with a local MLX model via a proxy server.

 

## First-Time Setup

 

### 1. Create Your Configuration File

 

Copy the example configuration:

 

```bash

cp local_mlx_config.json.example local_mlx_config.json

```

 

### 2. Edit Configuration

 

Edit `local_mlx_config.json` with your local paths:

 

```bash

nano local_mlx_config.json

```

 

Example configuration:

 

```json

{

  "BASE_MODEL": "/Users/yourname/Models/Qwen3-235B-A22B-Thinking-2507-8bit",

  "ADAPTER_PATH": "/Users/yourname/Models/adapters/claude",

  "MLX_PORT": 8080,

  "PROXY_PORT": 5001

}

```

 

**Important:** `local_mlx_config.json` is in `.gitignore` and will NOT be committed to git. This keeps your personal paths private.

 

### 3. Install Dependencies

 

Make sure you have the required packages:

 

```bash

pip install flask requests coverage

```

 

And mlx_lm installed:

 

```bash

pip install mlx-lm

```

 

---

 

## Usage

 

### Running MLX + Proxy

 

Start the MLX server and proxy (Terminal 1):

 

```bash

./start_local_claude.sh

```

 

This will:

- Read your configuration from `local_mlx_config.json`

- Start mlx-lm.server with your model and adapter

- Start the proxy server to translate API calls

- Keep running until you press Ctrl+C

 

### Running Letta with Coverage Tracing

 

In another terminal (Terminal 2):

 

```bash

./start_letta_with_coverage.sh

```

 

This will:

- Start Letta server with coverage tracking

- Connect to your proxy automatically

- Generate coverage reports when you stop it (Ctrl+C)

 

### Making API Calls

 

In a third terminal (Terminal 3):

 

```bash

curl http://localhost:8283/v1/agents

```

 

See `COVERAGE_WORKFLOW.md` for complete instructions.

 

---

 

## Architecture

 

```

API Calls → Letta (8283) → Proxy (5001) → MLX (8080)

              ↓

        Coverage Data

```

 

- **MLX Server (8080)**: Runs your local model with adapter

- **Proxy (5001)**: Translates between Letta's API format and MLX's format

- **Letta (8283)**: The main Letta server

 

---

 

## Configuration File Reference

 

| Field | Description | Default |

|-------|-------------|---------|

| `BASE_MODEL` | Path to your base MLX model | Required |

| `ADAPTER_PATH` | Path to your LoRA adapter | Required |

| `MLX_PORT` | Port for mlx-lm.server | 8080 |

| `PROXY_PORT` | Port for the proxy server | 5001 |

 

---

 

## Troubleshooting

 

### "local_mlx_config.json not found"

 

You need to create your configuration file:

 

```bash

cp local_mlx_config.json.example local_mlx_config.json

nano local_mlx_config.json

```

 

### "Base model not found"

 

Check that the path in `local_mlx_config.json` is correct:

 

```bash

ls -la /path/to/your/model

```

 

### Port conflicts

 

If ports 8080 or 5001 are already in use, change them in `local_mlx_config.json`:

 

```json

{

  "MLX_PORT": 8081,

  "PROXY_PORT": 5002

}

```

 

---

 

## Privacy Note

 

**DO NOT commit `local_mlx_config.json` to git!**

 

This file is automatically ignored by `.gitignore` to protect your personal information. Always use `local_mlx_config.json.example` as the template for the repository.