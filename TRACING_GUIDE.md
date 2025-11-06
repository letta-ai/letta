# Letta Code Tracing Guide

You now have 4 different ways to understand what code Letta actually uses!

## Quick Comparison

| Method | Speed | Detail | Best For |
|--------|-------|--------|----------|
| **Static Analysis** | ⚡ Instant | Low | Understanding project structure |
| **Import Tracker** | 🚀 Fast | Medium | Finding used modules |
| **Coverage** | ✅ Normal | High | **RECOMMENDED** - Most reliable |
| **Call Tracer** | 🐌 Very Slow | Extreme | Deep debugging |

---

## Method 1: Static Analysis (No Execution Required)

**Fastest** - Analyzes code without running it.

```bash
cd /home/user/appletta
python analyze_static_deps.py
```

**Output:** `/tmp/letta_static_analysis.txt`

**Use this to:**
- See all external dependencies
- Understand directory structure
- Find what imports what

---

## Method 2: Import Tracker (Lightweight)

**Fast** - Tracks what modules get loaded.

```bash
cd /home/user/appletta
python trace_imports.py
```

Press `Ctrl+C` after the server starts (or after making a few API calls).

**Output:** `/tmp/letta_imports.txt`

**Use this to:**
- Find which modules are actually loaded
- Identify unused code at module level

---

## Method 3: Coverage Analysis (RECOMMENDED) ⭐

**Most reliable** - Industry standard tool.

```bash
cd /home/user/appletta
./trace_with_coverage.sh
```

**Steps:**
1. Script starts Letta server with coverage tracking
2. Make a few API calls to your server (create agent, send message, etc.)
3. Press `Ctrl+C` to stop and generate report

**Outputs:**
- `/tmp/letta_files_used.txt` - **START HERE!** Files sorted by usage %
- `/tmp/letta_coverage_summary.txt` - Coverage summary
- `/tmp/letta_coverage_html/` - Detailed HTML report

**Use this to:**
- See EXACTLY what code runs
- Identify unused files with 0% coverage
- Understand critical vs optional code

---

## Method 4: Function Call Tracer (Advanced)

**Very slow** - Tracks every function call.

```bash
cd /home/user/appletta
python trace_calls.py
```

⚠️ **Warning:** This is VERY slow. Only run for a few seconds!

**Output:** `/tmp/letta_trace.txt`

**Use this to:**
- See which functions are called and how often
- Deep debugging of execution flow

---

## Recommended Workflow

### Step 1: Static Analysis (1 minute)
```bash
python analyze_static_deps.py
cat /tmp/letta_static_analysis.txt
```
Understand the project structure and dependencies.

### Step 2: Coverage Analysis (5 minutes)
```bash
./trace_with_coverage.sh
```

While server is running:
1. Create an agent via API
2. Send it a message
3. List agents
4. Stop with Ctrl+C

### Step 3: Analyze Results
```bash
# See which files were actually used
cat /tmp/letta_files_used.txt

# View detailed HTML report
# (You can copy this to your local machine to view in browser)
ls -lh /tmp/letta_coverage_html/
```

---

## Example: Minimal Letta Setup

After running coverage, look for files with **>50% coverage** - these are your core files!

The files with **0% coverage** can likely be removed for your use case.

Common core areas (you'll verify with coverage):
- `letta/server/` - REST API server
- `letta/agent.py` - Core agent logic
- `letta/llm_api/` - LLM API calls
- `letta/schemas/` - Data models
- `letta/orm/` - Database models

Common areas you might NOT need:
- `letta/client/` - Python client SDK (if you use REST API directly)
- `letta/cli/` - CLI commands (if you only use server mode)
- Various provider integrations you don't use
- Deprecated code in `letta/legacy/` (if it exists)

---

## Tips

1. **Test a realistic workflow** - When running coverage, do the exact operations you need Letta to do
2. **Multiple runs** - Run coverage multiple times with different workflows to capture all paths
3. **Check imports** - Even 0% coverage files might be needed if they define schemas/models
4. **Start conservative** - Keep more code at first, remove gradually

---

## Quick Test Command

To test your working Letta setup before tracing:
```bash
# Start mlx_lm.server (in another terminal)
# Then run your working Letta Docker command
# Then make a simple API call:

curl http://localhost:8283/v1/agents
```

If that works, you're ready to trace!
