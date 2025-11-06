# Quick Start Guide: Tracing Letta with MLX + Proxy

## Your Current Setup

```
┌─────────────────┐
│  Letta Server   │  Port 8283
│  (to be traced) │
└────────┬────────┘
         │
         ↓ http://127.0.0.1:5001
┌─────────────────┐
│  Letta Proxy    │  Port 5001
│  (letta_proxy)  │
└────────┬────────┘
         │
         ↓ http://127.0.0.1:8080
┌─────────────────┐
│  MLX Server     │  Port 8080
│ (mlx_lm.server) │
└─────────────────┘
```

## Step-by-Step Usage

### Step 1: Start MLX + Proxy (Terminal 1)

```bash
./start.sh
```

This will:
- Start `mlx_lm.server` on port 8080
- Start `letta_proxy.py` on port 5001
- Keep running until you press Ctrl+C

**Wait for:** `✅ Setup complete!` message

---

### Step 2: Run Letta with Tracing (Terminal 2)

Open a **new terminal** and run:

```bash
# Recommended: Coverage analysis
./run_letta_with_tracing.sh coverage
```

Other options:
```bash
./run_letta_with_tracing.sh imports   # Just track imports (fast)
./run_letta_with_tracing.sh calls     # Track all calls (very slow)
./run_letta_with_tracing.sh normal    # No tracing
```

---

### Step 3: Test Your Workflow (Terminal 3)

Open **another terminal** and make API calls to test what you actually use:

```bash
# Example: List agents
curl http://localhost:8283/v1/agents

# Example: Create an agent
curl -X POST http://localhost:8283/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-agent",
    "llm_config": {...}
  }'

# Do whatever operations you need Letta to do!
```

---

### Step 4: Stop and Analyze

When done testing:

1. **In Terminal 2** (Letta): Press `Ctrl+C`
   - If using coverage mode, it will auto-generate reports

2. **View Results:**
   ```bash
   # See which files were actually used
   cat /tmp/letta_files_used.txt

   # View detailed HTML report
   open /tmp/letta_coverage_html/index.html
   ```

3. **In Terminal 1** (MLX/Proxy): Press `Ctrl+C` to stop servers

---

## Understanding Results

### Coverage Report (`/tmp/letta_files_used.txt`)

Files are listed by coverage percentage:

```
95.0%  server/rest_api/app.py        ← Core file, heavily used
72.3%  agent.py                       ← Important
45.2%  llm_api/openai.py              ← Moderately used
12.1%  cli/cli.py                     ← Rarely used (CLI stuff)
 0.0%  legacy/old_code.py             ← Never used, can remove!
```

**Rule of thumb:**
- **> 50% coverage** = Core files you need
- **10-50% coverage** = Partially used, check if needed
- **0% coverage** = Unused, safe to remove (but verify!)

---

## Quick Commands Cheat Sheet

```bash
# Start MLX + Proxy
./start.sh

# Run Letta with coverage (recommended)
./run_letta_with_tracing.sh coverage

# Run Letta with import tracking (faster)
./run_letta_with_tracing.sh imports

# Run Letta normally (no tracing)
./run_letta_with_tracing.sh normal

# View coverage results
cat /tmp/letta_files_used.txt
open /tmp/letta_coverage_html/index.html

# View import results
cat /tmp/letta_imports.txt
```

---

## Troubleshooting

### "Connection refused" errors

Make sure `./start.sh` is running and you see:
```
✅ mlx-lm.server is running
✅ Setup complete!
```

### "coverage: command not found"

The script will auto-install it, but you can manually run:
```bash
pip install coverage
```

### Letta can't find the model

Make sure your proxy is correctly translating the `/api/v0/models` endpoint to MLX.

Test the proxy directly:
```bash
curl http://127.0.0.1:5001/api/v0/models
```

### Want to trace a different workflow?

Just run coverage mode multiple times with different API calls to capture all code paths!

---

## Next Steps

After tracing:

1. **Identify core modules** from coverage report
2. **Create a minimal `letta/` directory** with only needed files
3. **Test the minimal setup** to ensure it works
4. **Iterate** - add back files if something breaks

See `TRACING_GUIDE.md` for more advanced usage!
