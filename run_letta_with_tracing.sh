#!/bin/bash

# Configuration for Letta to use the proxy
PROXY_PORT=${LETTA_PROXY_PORT:-5001}
LETTA_HOST="0.0.0.0"
LETTA_PORT="8283"

# Tracing mode (coverage, imports, calls, or normal)
MODE=${1:-coverage}

echo "🔍 Starting Letta with tracing mode: $MODE"
echo ""
echo "Configuration:"
echo "  Proxy URL: http://127.0.0.1:$PROXY_PORT"
echo "  Letta Server: http://$LETTA_HOST:$LETTA_PORT"
echo ""

# Set environment variables for Letta to use the proxy
export LMSTUDIO_BASE_URL="http://127.0.0.1:$PROXY_PORT"
export OPENAI_API_KEY="dummy-key"

# Optional: Set other Letta configs
# export LETTA_PG_URI="postgresql://letta:letta@localhost:5432/letta"

case $MODE in
    coverage)
        echo "📊 Running with COVERAGE analysis (recommended)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Instructions:"
        echo "  1. Wait for server to start"
        echo "  2. Make API calls to test your workflow:"
        echo "     - Create an agent"
        echo "     - Send messages"
        echo "     - List agents, etc."
        echo "  3. Press Ctrl+C when done"
        echo ""
        echo "Results will be saved to:"
        echo "  - /tmp/letta_files_used.txt (files by coverage %)"
        echo "  - /tmp/letta_coverage_html/ (detailed HTML report)"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""

        # Check if coverage is installed
        if ! command -v coverage &> /dev/null; then
            echo "Installing coverage tool..."
            pip install coverage
        fi

        # Run with coverage
        coverage run --source=letta -m letta.cli.cli server --host $LETTA_HOST --port $LETTA_PORT

        # Generate reports
        echo ""
        echo "Generating coverage reports..."
        coverage report --omit="*/tests/*,*/test_*" > /tmp/letta_coverage_summary.txt
        coverage html --omit="*/tests/*,*/test_*" -d /tmp/letta_coverage_html
        coverage json --omit="*/tests/*,*/test_*" -o /tmp/letta_coverage.json

        # Parse JSON to get used files
        python3 -c "
import json
with open('/tmp/letta_coverage.json') as f:
    data = json.load(f)

files_used = []
for filepath, info in data['files'].items():
    if 'letta/' in filepath:
        rel_path = filepath.split('letta/')[-1]
        percent = info['summary']['percent_covered']
        files_used.append((rel_path, percent))

files_used.sort(key=lambda x: x[1], reverse=True)

with open('/tmp/letta_files_used.txt', 'w') as out:
    out.write('FILES ACTUALLY USED (sorted by % coverage):\n')
    out.write('=' * 80 + '\n')
    for filepath, percent in files_used:
        if percent > 0:
            out.write(f'{percent:5.1f}%  {filepath}\n')

print(f'\n✅ Found {len([f for f in files_used if f[1] > 0])} files actually used')
"

        echo ""
        echo "✅ Coverage analysis complete!"
        echo ""
        echo "View results:"
        echo "  cat /tmp/letta_files_used.txt"
        echo "  open /tmp/letta_coverage_html/index.html"
        ;;

    imports)
        echo "📦 Running with IMPORT tracking"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "This will track which modules Letta loads."
        echo "Press Ctrl+C after server starts (or after API calls)."
        echo ""
        echo "Results will be saved to: /tmp/letta_imports.txt"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""

        python trace_imports.py

        echo ""
        echo "✅ Import tracking complete!"
        echo "View results: cat /tmp/letta_imports.txt"
        ;;

    calls)
        echo "🔬 Running with FUNCTION CALL tracking (SLOW!)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "⚠️  WARNING: This is VERY slow!"
        echo "Only run for a few seconds to test."
        echo ""
        echo "Results will be saved to: /tmp/letta_trace.txt"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""

        python trace_calls.py

        echo ""
        echo "✅ Call tracking complete!"
        echo "View results: cat /tmp/letta_trace.txt"
        ;;

    normal)
        echo "🚀 Running Letta normally (no tracing)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""

        # Check if letta command exists
        if ! command -v letta &> /dev/null; then
            echo "Running via Python module..."
            python -m letta.cli.cli server --host $LETTA_HOST --port $LETTA_PORT
        else
            echo "Running via letta command..."
            letta server --host $LETTA_HOST --port $LETTA_PORT
        fi
        ;;

    *)
        echo "❌ Unknown mode: $MODE"
        echo ""
        echo "Usage: $0 [mode]"
        echo ""
        echo "Available modes:"
        echo "  coverage  - Full coverage analysis (recommended)"
        echo "  imports   - Track module imports only"
        echo "  calls     - Track function calls (very slow)"
        echo "  normal    - Run without tracing"
        echo ""
        echo "Example:"
        echo "  $0 coverage"
        exit 1
        ;;
esac
